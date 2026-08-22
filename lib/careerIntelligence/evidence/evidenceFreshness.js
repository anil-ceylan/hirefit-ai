import { clampScore } from "./evidenceTypes.js";
import { DEFAULT_FRESHNESS_STRATEGY } from "./evidenceIntelligenceConfig.js";

function yearFrom(value) {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

export function calculateEvidenceFreshness(input = {}, { now = new Date(), strategy = DEFAULT_FRESHNESS_STRATEGY } = {}) {
  const year = yearFrom(input.occurred_at || input.created_at);
  if (!Number.isFinite(year)) {
    return {
      freshness: strategy.unknownFreshnessScore,
      ageYears: null,
      decayFactor: null,
      reason: "missing_date",
    };
  }
  const ageYears = Math.max(0, now.getFullYear() - year);
  const decayFactor = Math.pow(0.5, ageYears / strategy.halfLifeYears);
  const base = strategy.floor + (100 - strategy.floor) * decayFactor;
  const currentBonus = ageYears === 0 ? strategy.currentYearBonus : 0;
  return {
    freshness: clampScore(base + currentBonus),
    ageYears,
    decayFactor: Number(decayFactor.toFixed(3)),
    reason: ageYears <= 1 ? "current_or_recent" : ageYears <= strategy.halfLifeYears ? "still_relevant" : "decayed",
  };
}
