import { clampScore } from "../evidence/evidenceTypes.js";
import {
  DEFAULT_REASONING_THRESHOLDS,
  DEFAULT_REASONING_WEIGHTS,
} from "./reasoningConfig.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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

export function buildHypotheses({
  inferences = [],
  evidenceIntelligence = {},
  conflicts = {},
  missingEvidence = {},
  weights = DEFAULT_REASONING_WEIGHTS.hypothesis,
  thresholds = DEFAULT_REASONING_THRESHOLDS,
} = {}) {
  const coverage = evidenceIntelligence.coverage?.coverage || {};
  return asArray(inferences).map((inference) => {
    const coverageRow = coverage[inference.competency] || {};
    const conflictHits = asArray(conflicts.conflicts).filter((item) => inference.evidenceIds.includes(item.evidenceId));
    const missingHits = asArray(missingEvidence.missingEvidence).filter((item) => item.competency === inference.competency);
    const supportingItems = asArray(evidenceIntelligence.evidenceObjects).filter((item) => inference.evidenceIds.includes(item.id));
    const avgTrust = supportingItems.length
      ? supportingItems.reduce((sum, item) => sum + Number(item.trust || 0), 0) / supportingItems.length
      : 0;
    const factors = {
      inferenceConfidence: inference.confidence,
      coverage: coverageRow.score || inference.confidence,
      trust: avgTrust,
      conflictPenalty: clampScore(100 - Math.min(100, conflictHits.reduce((sum, item) => sum + item.severity, 0))),
      missingPenalty: clampScore(100 - Math.min(100, missingHits.reduce((sum, item) => sum + item.severity * 0.35, 0))),
    };
    const confidence = clampScore(weighted(factors, weights));
    return {
      id: `hypothesis:${inference.competency}`,
      type: confidence >= thresholds.strongHypothesis
        ? "positive_hypothesis"
        : confidence <= thresholds.weakHypothesis
          ? "weak_hypothesis"
          : "uncertain_hypothesis",
      statement: confidence >= thresholds.strongHypothesis
        ? `${inference.competency} is supported.`
        : confidence <= thresholds.weakHypothesis
          ? `${inference.competency} is not yet well supported.`
          : `${inference.competency} is partially supported.`,
      competency: inference.competency,
      confidence,
      evidenceIds: inference.evidenceIds,
      missingEvidenceIds: missingHits.map((item) => item.id),
      conflictIds: conflictHits.map((item) => `${item.id}:${item.evidenceId}`),
      factors,
    };
  }).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.id.localeCompare(b.id);
  });
}
