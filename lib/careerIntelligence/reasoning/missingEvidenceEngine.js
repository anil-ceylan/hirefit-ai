import { clampScore } from "../evidence/evidenceTypes.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function analyzeMissingEvidence(evidenceIntelligence = {}, { inferences = [] } = {}) {
  const coverageMissing = asArray(evidenceIntelligence.coverage?.missingCompetencies).map((item) => ({
    id: `missing_competency:${item.competency}`,
    type: "competency_gap",
    competency: item.competency,
    severity: clampScore(100 - Number(item.score || 0)),
    requiredWeight: item.requiredWeight || 1,
    reason: `${item.competency} is not sufficiently supported by current evidence.`,
    evidenceIds: asArray(item.supportingEvidenceIds),
  }));
  const weakInferences = asArray(inferences)
    .filter((inference) => inference.confidence < 45)
    .map((inference) => ({
      id: `weak_inference:${inference.competency}`,
      type: "weak_inference",
      competency: inference.competency,
      severity: clampScore(100 - inference.confidence),
      requiredWeight: 1,
      reason: `${inference.competency} has weak inference confidence.`,
      evidenceIds: inference.evidenceIds,
    }));
  const missingFields = asArray(evidenceIntelligence.evidenceObjects)
    .flatMap((item) => asArray(item.missing_fields).map((field) => ({
      id: `missing_field:${item.id}:${field}`,
      type: "missing_field",
      competency: asArray(item.competencies)[0] || "evidence_quality",
      field,
      severity: field === "occurred_at" ? 42 : 56,
      requiredWeight: 1,
      reason: `${field} is missing from ${item.title}.`,
      evidenceIds: [item.id],
    })));
  const merged = [...coverageMissing, ...weakInferences, ...missingFields]
    .sort((a, b) => {
      const scoreA = a.severity * (a.requiredWeight || 1);
      const scoreB = b.severity * (b.requiredWeight || 1);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.id.localeCompare(b.id);
    });
  return {
    missingEvidence: merged,
    primaryMissingEvidence: merged[0] || null,
    uncertaintyScore: merged.length ? clampScore(merged.slice(0, 5).reduce((sum, item) => sum + item.severity, 0) / Math.min(5, merged.length)) : 0,
  };
}
