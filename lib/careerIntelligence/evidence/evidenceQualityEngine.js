import { clampScore } from "./evidenceTypes.js";
import { DEFAULT_QUALITY_STRATEGY } from "./evidenceIntelligenceConfig.js";

function weightedAverage(factors, weights) {
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (factors[key] || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : 0;
}

export function calculateEvidenceQuality(input = {}, { competencyConfidence = {}, strategy = DEFAULT_QUALITY_STRATEGY } = {}) {
  const competencies = Array.isArray(input.competencies) ? input.competencies : [];
  const confidenceValues = competencies
    .map((competency) => competencyConfidence[competency]?.confidence)
    .filter((value) => Number.isFinite(Number(value)));
  const confidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + Number(value), 0) / confidenceValues.length
    : Number(input.confidence || 0) * 100 || 36;
  const factors = {
    strength: Number(input.strength || input.normalized_weight || 0),
    trust: Number(input.trust || 0),
    freshness: Number(input.freshness || 0),
    specificity: Number(input.quality_breakdown?.factors?.specificity || 0),
    impact: Number(input.quality_breakdown?.factors?.measurable_outcome || input.strengthFactors?.measurableImpact || 0),
    confidence,
  };
  return {
    quality: clampScore(weightedAverage(factors, strategy.weights)),
    qualityFactors: Object.fromEntries(Object.entries(factors).map(([key, value]) => [key, clampScore(value)])),
  };
}

export function calculateEvidenceSetQuality(evidenceItems = []) {
  if (!evidenceItems.length) {
    return {
      evidenceQualityScore: 0,
      averageQuality: 0,
      strongestEvidence: [],
      weakestEvidence: [],
    };
  }
  const sorted = [...evidenceItems].sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0));
  const top = sorted.slice(0, 6);
  const score = top.reduce((sum, item, index) => sum + Number(item.quality || 0) / (index + 1), 0) /
    top.reduce((sum, _, index) => sum + 1 / (index + 1), 0);
  return {
    evidenceQualityScore: clampScore(score),
    averageQuality: clampScore(evidenceItems.reduce((sum, item) => sum + Number(item.quality || 0), 0) / evidenceItems.length),
    strongestEvidence: sorted.slice(0, 3),
    weakestEvidence: [...sorted].reverse().slice(0, 3),
  };
}
