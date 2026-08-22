import { clampScore } from "./evidenceTypes.js";
import { DEFAULT_STRENGTH_STRATEGY } from "./evidenceIntelligenceConfig.js";

function textFor(item) {
  return `${item?.ownership_level || ""} ${item?.title || ""} ${item?.description || ""} ${(item?.metrics || []).join(" ")}`;
}

function norm(value) {
  return String(value || "").toLowerCase();
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

export function calculateEvidenceStrength(input = {}, { strategy = DEFAULT_STRENGTH_STRATEGY } = {}) {
  const text = norm(textFor(input));
  const metrics = Array.isArray(input.metrics) ? input.metrics : [];
  const factors = {
    ownership: /founder|end-to-end|owned|primary owner|responsible|kurucu|sahip/.test(text)
      ? 92
      : /led|managed|lead|yönet|yonet/.test(text)
        ? 74
        : /supported|assisted|contributed|destek/.test(text)
          ? 48
          : 34,
    duration: /\b\d+\s?(months?|years?|weeks?|ay|yıl|yil)\b/.test(text) ? 76 : 46,
    measurableImpact: metrics.length || /\b\d+(\.\d+)?\s?%|\b\d+\s?(users?|customers?|clients?|revenue|kpi)\b/.test(text)
      ? 88
      : /impact|result|outcome|sonuç|sonuc|etki/.test(text)
        ? 56
        : 24,
    complexity: /cross-functional|stakeholder|automation|system|workflow|market|strategy|paydaş|paydas|sistem/.test(text) ? 78 : 44,
    scope: /company|team|users?|customers?|department|market|ekip|müşteri|musteri|kullanıcı|kullanici/.test(text) ? 74 : 42,
    externalValidation: /github|portfolio|linkedin|published|launched|deployed|demo|repo|yayın|yayin|canlı|canli/.test(text) ? 82 : 36,
  };
  return {
    strength: clampScore(weightedAverage(factors, strategy.weights)),
    strengthFactors: factors,
  };
}
