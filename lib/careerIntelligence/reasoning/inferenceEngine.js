import { clampScore } from "../evidence/evidenceTypes.js";
import { DEFAULT_REASONING_WEIGHTS } from "./reasoningConfig.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function avg(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function sourceDiversity(items) {
  if (!items.length) return 0;
  return clampScore((new Set(items.map((item) => item.source || item.source_type || "unknown")).size / items.length) * 100);
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

export function buildInferences(evidenceIntelligence = {}, { weights = DEFAULT_REASONING_WEIGHTS.inference } = {}) {
  const evidenceObjects = asArray(evidenceIntelligence.evidenceObjects);
  const confidenceByCompetency = evidenceIntelligence.confidenceByCompetency || {};
  const competencies = new Set(evidenceObjects.flatMap((item) => asArray(item.competencies)));
  return [...competencies].map((competency) => {
    const supportingEvidence = evidenceObjects.filter((item) => asArray(item.competencies).includes(competency));
    const factors = {
      evidenceQuality: avg(supportingEvidence.map((item) => item.quality)),
      evidenceTrust: avg(supportingEvidence.map((item) => item.trust)),
      evidenceStrength: avg(supportingEvidence.map((item) => item.strength)),
      freshness: avg(supportingEvidence.map((item) => item.freshness)),
      sourceDiversity: sourceDiversity(supportingEvidence),
      evidenceCount: clampScore(supportingEvidence.length * 18),
    };
    return {
      id: `inference:${competency}`,
      type: "competency_inference",
      competency,
      conclusion: competency,
      confidence: clampScore(Math.max(confidenceByCompetency[competency]?.confidence || 0, weighted(factors, weights))),
      evidenceIds: supportingEvidence.map((item) => item.id),
      supportCount: supportingEvidence.length,
      factors,
      status: supportingEvidence.length ? "supported" : "unsupported",
    };
  }).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.competency.localeCompare(b.competency);
  });
}
