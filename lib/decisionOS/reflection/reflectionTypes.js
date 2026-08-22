export const REFLECTION_ENGINE_VERSION = "reflection-intelligence.v1";
export const REFLECTION_SCHEMA_VERSION = "reflection.v1";
export const DECISION_JOURNAL_SCHEMA_VERSION = "decision-journal.v1";
export const OPTIONAL_INSIGHT_PACK_NOTICE =
  "This insight is optional and intended for personal reflection. It does not change your evidence-based recommendations.";

export const REFLECTION_SAFETY_RULES = Object.freeze([
  "never_override_evidence",
  "never_change_recommendations",
  "never_claim_certainty",
  "never_diagnose",
  "never_predict_future",
  "optional_packs_are_reflection_only",
]);

export function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function cleanText(value, max = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function uniqueStrings(values, max = 12) {
  return [...new Set(asArray(values).map((value) => cleanText(value, 120)).filter(Boolean))].slice(0, max);
}

export function createEmptyReflection({ generatedAt = new Date().toISOString() } = {}) {
  return {
    schemaVersion: REFLECTION_SCHEMA_VERSION,
    engineVersion: REFLECTION_ENGINE_VERSION,
    generatedAt,
    mode: "reflection_only",
    influencesRecommendations: false,
    recommendationOverride: null,
    summary: "",
    motivations: [],
    reflectionQuestions: [],
    potentialBiases: [],
    valueAlignment: {
      alignedValues: [],
      possibleTensions: [],
      confidence: "low",
    },
    decisionJournalPrompt: null,
    optionalInsightPacks: [],
    safety: {
      rules: REFLECTION_SAFETY_RULES,
      disclaimer:
        "Reflection Intelligence helps the user think more clearly. It does not replace evidence-based reasoning or professional advice.",
    },
    warnings: [],
  };
}

export function confidenceLevel(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "low";
  if (n >= 70) return "high";
  if (n >= 40) return "medium";
  return "low";
}
