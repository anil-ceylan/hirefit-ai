import { clampScore } from "../evidence/evidenceTypes.js";
import {
  DEFAULT_REASONING_THRESHOLDS,
  DEFAULT_REASONING_WEIGHTS,
} from "./reasoningConfig.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function avg(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function weighted(factors, weights) {
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (factors[key] || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : 0;
}

export function calculateDecisionConfidence({
  option = {},
  hypotheses = [],
  evidenceIntelligence = {},
  conflicts = {},
  missingEvidence = {},
  opportunityImpact = null,
  weights = DEFAULT_REASONING_WEIGHTS.decisionConfidence,
  thresholds = DEFAULT_REASONING_THRESHOLDS,
} = {}) {
  const required = asArray(option.requiredCompetencies);
  const relevantHypotheses = required.length
    ? hypotheses.filter((hypothesis) => required.includes(hypothesis.competency))
    : hypotheses.slice(0, 5);
  const alignment = required.length
    ? clampScore(relevantHypotheses.reduce((sum, hypothesis) => sum + hypothesis.confidence, 0) / required.length)
    : avg(relevantHypotheses.map((hypothesis) => hypothesis.confidence));
  const linkedEvidenceIds = new Set(relevantHypotheses.flatMap((hypothesis) => hypothesis.evidenceIds));
  const linkedEvidence = asArray(evidenceIntelligence.evidenceObjects).filter((item) => linkedEvidenceIds.has(item.id));
  const missingForOption = asArray(missingEvidence.missingEvidence).filter((item) => !required.length || required.includes(item.competency));
  const conflictsForOption = asArray(conflicts.conflicts).filter((item) => linkedEvidenceIds.has(item.evidenceId));
  const factors = {
    evidenceQuality: avg(linkedEvidence.map((item) => item.quality)) || evidenceIntelligence.quality?.evidenceQualityScore || 0,
    competencyAlignment: alignment,
    hypothesisConfidence: avg(relevantHypotheses.map((hypothesis) => hypothesis.confidence)),
    missingEvidencePenalty: clampScore(100 - Math.min(100, missingForOption.reduce((sum, item) => sum + item.severity * 0.28, 0))),
    conflictPenalty: clampScore(100 - Math.min(100, conflictsForOption.reduce((sum, item) => sum + item.severity * 0.4, 0))),
    opportunityImpact: opportunityImpact?.topImpact?.impact?.impactScore || 50,
  };
  const decisionConfidence = clampScore(weighted(factors, weights));
  return {
    decisionConfidence,
    confidenceBand: decisionConfidence >= 72 ? "high" : decisionConfidence >= 45 ? "medium" : "low",
    isDefensible: decisionConfidence >= thresholds.minimumRecommendationConfidence,
    factors,
    missingEvidenceIds: missingForOption.map((item) => item.id),
    conflictIds: conflictsForOption.map((item) => `${item.id}:${item.evidenceId}`),
    evidenceIds: [...linkedEvidenceIds],
  };
}
