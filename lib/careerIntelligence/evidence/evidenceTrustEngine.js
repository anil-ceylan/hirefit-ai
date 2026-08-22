import { clampScore } from "./evidenceTypes.js";
import { DEFAULT_TRUST_STRATEGY } from "./evidenceIntelligenceConfig.js";

function textFor(item) {
  return `${item?.title || ""} ${item?.description || ""} ${(item?.metrics || []).join(" ")} ${item?.role_context || ""}`;
}

function weightedAverage(factors, weights) {
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (factors[key] || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : 0;
}

export function calculateEvidenceTrust(input = {}, { strategy = DEFAULT_TRUST_STRATEGY } = {}) {
  const text = textFor(input).toLowerCase();
  const sourceType = input.source_type || "unknown";
  const factors = {
    source: strategy.sourceTrust[sourceType] ?? strategy.sourceTrust.unknown,
    measurable: Array.isArray(input.metrics) && input.metrics.length ? 90 : /\b\d+(\.\d+)?\s?%|\bkpi\b|revenue|users?|customers?/.test(text) ? 82 : 28,
    specificity: text.length > 120 ? 78 : text.length > 55 ? 54 : 24,
    outcome: /increased|reduced|saved|launched|shipped|deployed|result|impact|sonuç|sonuc|etki/.test(text) ? 76 : 30,
    roleSpecificity: input.role_context && text.includes(String(input.role_context).toLowerCase().split(/\s+/)[0]) ? 84 : input.role_context ? 58 : 24,
    externalValidation: /github|portfolio|linkedin|repo|demo|published|deployed|link/.test(`${sourceType} ${text}`) ? 86 : 30,
  };
  return {
    trust: clampScore(weightedAverage(factors, strategy.weights)),
    trustFactors: factors,
  };
}
