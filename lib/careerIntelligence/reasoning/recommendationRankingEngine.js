import { clampScore } from "../evidence/evidenceTypes.js";
import { calculateDecisionConfidence } from "./decisionConfidenceEngine.js";
import { buildExplanationTrace } from "./explainabilityEngine.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function defaultOptionsFromCoverage(evidenceIntelligence = {}) {
  const competencies = Object.keys(evidenceIntelligence.confidenceByCompetency || {});
  if (!competencies.length) return [];
  return [{
    id: "current_best_supported_direction",
    label: "Best supported direction",
    requiredCompetencies: competencies.slice(0, 5),
    source: "evidence_intelligence",
  }];
}

function optionOpportunityFit(option, opportunityImpact) {
  const top = opportunityImpact?.topImpact;
  if (!top) return 50;
  const required = asArray(option.requiredCompetencies).join(" ");
  if (!required) return top.impact.impactScore;
  return clampScore(top.impact.impactScore * 0.7 + 30);
}

export function rankRecommendations({
  options = [],
  hypotheses = [],
  evidenceIntelligence = {},
  conflicts = {},
  missingEvidence = {},
  opportunityImpact = null,
} = {}) {
  const inputOptions = asArray(options).length ? asArray(options) : defaultOptionsFromCoverage(evidenceIntelligence);
  return inputOptions.map((option) => {
    const confidence = calculateDecisionConfidence({
      option,
      hypotheses,
      evidenceIntelligence,
      conflicts,
      missingEvidence,
      opportunityImpact,
    });
    const opportunityFit = optionOpportunityFit(option, opportunityImpact);
    const score = clampScore(confidence.decisionConfidence * 0.78 + opportunityFit * 0.22);
    const primaryHypothesis = hypotheses
      .filter((hypothesis) => asArray(option.requiredCompetencies).includes(hypothesis.competency))
      .sort((a, b) => b.confidence - a.confidence)[0] || hypotheses[0] || null;
    const recommendation = {
      id: option.id || `recommendation:${String(option.label || "option").toLowerCase().replace(/\s+/g, "_")}`,
      label: option.label || option.name || "Recommendation",
      option,
      rankScore: score,
      decisionConfidence: confidence.decisionConfidence,
      confidenceBand: confidence.confidenceBand,
      evidenceIds: confidence.evidenceIds,
      missingEvidenceIds: confidence.missingEvidenceIds,
      conflictIds: confidence.conflictIds,
      rankingFactors: {
        decisionConfidence: confidence.decisionConfidence,
        opportunityFit,
        ...confidence.factors,
      },
    };
    return {
      ...recommendation,
      explanationTrace: buildExplanationTrace({
        recommendation,
        hypothesis: primaryHypothesis,
        evidenceIntelligence,
        conflicts,
        missingEvidence,
      }),
    };
  }).sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    return a.label.localeCompare(b.label);
  });
}
