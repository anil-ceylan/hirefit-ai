import { clampScore, scoreBand } from "./evidenceTypes.js";
import { evaluateEvidence } from "./evaluateEvidence.js";
import { evidenceImprovementText, evidenceSetExplanation } from "./evidenceExplanations.js";

const FIELD_LABELS_TR = {
  title: "başlık",
  description: "açıklama",
  source_type: "kanıt kaynağı",
  role_context: "hedef rol bağlantısı",
  occurred_at: "tarih",
};

const FIELD_LABELS_EN = {
  title: "title",
  description: "description",
  source_type: "evidence source",
  role_context: "target-role context",
  occurred_at: "date",
};

function tr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function weightedTopAverage(items) {
  const sorted = [...items].sort((a, b) => b.normalized_weight - a.normalized_weight).slice(0, 6);
  if (!sorted.length) return 0;
  const weightSum = sorted.reduce((sum, _, index) => sum + 1 / (index + 1), 0);
  return sorted.reduce((sum, item, index) => sum + item.normalized_weight / (index + 1), 0) / weightSum;
}

function confidenceScore(items, contradictions) {
  if (!items.length) return 0;
  const sourceCount = new Set(items.map((item) => item.source || item.source_type)).size;
  const verifiedish = items.filter((item) => item.quality_breakdown?.factors?.source_quality >= 68).length;
  const strongCount = items.filter((item) => item.normalized_weight >= 66).length;
  const missingPenalty = Math.min(20, items.reduce((sum, item) => sum + item.missing_fields.length, 0) * 1.5);
  const contradictionPenalty = Math.min(24, contradictions.length * 5);
  return clampScore(sourceCount * 11 + verifiedish * 9 + strongCount * 8 - missingPenalty - contradictionPenalty, 0, 100);
}

function roleSpecificScore(items) {
  const relevant = items.filter((item) => item.quality_breakdown?.factors?.role_alignment >= 50);
  return clampScore(weightedTopAverage(relevant));
}

function isMissingEvidencePlaceholder(item) {
  return /missing|gap|eksik|açık|acik/i.test(String(item?.type || ""));
}

function fieldGaps(items, lang) {
  const labels = tr(lang) ? FIELD_LABELS_TR : FIELD_LABELS_EN;
  const counts = new Map();
  for (const item of items) {
    for (const field of item.missing_fields || []) counts.set(field, (counts.get(field) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([field, count]) => ({ field, label: labels[field] || field, count }));
}

export function evaluateEvidenceSet(input = [], { roleContext = "", lang = "EN", now = new Date(), roleWeights = {} } = {}) {
  const evaluated = input.map((item) => evaluateEvidence(item, { roleContext, now, roleWeights }));
  const contradictions = evaluated.flatMap((item) => (item.contradictions || []).map((id) => ({ id, evidenceId: item.id })));
  const strongestPool = evaluated.filter((item) => !isMissingEvidencePlaceholder(item));
  const strongestEvidence = [...(strongestPool.length ? strongestPool : evaluated)]
    .sort((a, b) => b.normalized_weight - a.normalized_weight)
    .slice(0, 3);
  const weakestEvidence = [...evaluated].sort((a, b) => a.normalized_weight - b.normalized_weight).slice(0, 3);
  const overallEvidenceQuality = clampScore(weightedTopAverage(evaluated));
  const report = {
    evidenceItems: evaluated,
    overallEvidenceQuality,
    confidenceScore: confidenceScore(evaluated, contradictions),
    roleSpecificEvidenceScore: roleSpecificScore(evaluated),
    qualityBand: scoreBand(overallEvidenceQuality),
    qualityBreakdown: {
      itemCount: evaluated.length,
      verifiedSourceCount: evaluated.filter((item) => item.quality_breakdown?.factors?.source_quality >= 68).length,
      strongEvidenceCount: evaluated.filter((item) => item.normalized_weight >= 66).length,
      contradictionCount: contradictions.length,
    },
    strongestEvidence,
    weakestEvidence,
    missingEvidenceFields: fieldGaps(evaluated, lang),
    contradictionFlags: contradictions,
  };
  return {
    ...report,
    explanationText: evidenceSetExplanation(report, lang),
    recommendedEvidenceImprovement: evidenceImprovementText(report, lang),
  };
}
