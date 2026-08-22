import { OPTIONAL_INSIGHT_PACK_NOTICE, cleanText } from "./reflectionTypes.js";

export const OPTIONAL_INSIGHT_PACKS = Object.freeze([
  {
    id: "big_five",
    label: "Big Five",
    category: "personality_reflection",
    prompts: [
      "Which parts of this decision require energy, openness, discipline, cooperation, or emotional steadiness?",
      "Which trait would be most useful to observe in yourself before deciding?",
    ],
  },
  {
    id: "jung_archetypes",
    label: "Jung Archetypes",
    category: "symbolic_reflection",
    prompts: [
      "Which role are you drawn to playing in this decision: builder, explorer, caregiver, challenger, or strategist?",
      "Which role might be over-influencing your interpretation?",
    ],
  },
  {
    id: "decision_style",
    label: "Decision Style",
    category: "decision_reflection",
    prompts: [
      "Are you deciding by evidence, emotion, social pressure, or urgency?",
      "What would a slower version of this decision notice?",
    ],
  },
  {
    id: "learning_style",
    label: "Learning Style",
    category: "learning_reflection",
    prompts: [
      "What would you need to learn before this decision feels clearer?",
      "Do you learn this best by reading, building, discussing, or testing?",
    ],
  },
  {
    id: "communication_style",
    label: "Communication Style",
    category: "communication_reflection",
    prompts: [
      "What part of this decision needs to be explained to someone else?",
      "Where might your communication style hide your real concern?",
    ],
  },
  {
    id: "ikigai",
    label: "Ikigai",
    category: "purpose_reflection",
    prompts: [
      "Where do your interests, strengths, usefulness, and sustainability overlap?",
      "Which part of that overlap is weakest right now?",
    ],
  },
  {
    id: "astrology",
    label: "Astrology",
    category: "optional_symbolic_reflection",
    prompts: [
      "If you treat this only as symbolic language, what theme or metaphor helps you reflect on the decision?",
      "Which interpretation feels useful, and which should you ignore because it lacks evidence?",
    ],
  },
  {
    id: "numerology",
    label: "Numerology",
    category: "optional_symbolic_reflection",
    prompts: [
      "If you treat numbers only as a journaling metaphor, what pattern do you notice in your reasoning?",
      "Which practical evidence matters more than any symbolic interpretation?",
    ],
  },
]);

export function buildOptionalInsightPacks(requestedPacks = []) {
  const requested = new Set((Array.isArray(requestedPacks) ? requestedPacks : []).map((pack) => String(pack || "").trim().toLowerCase()));
  return OPTIONAL_INSIGHT_PACKS
    .filter((pack) => requested.has(pack.id))
    .map((pack) => ({
      id: pack.id,
      label: pack.label,
      category: pack.category,
      notice: OPTIONAL_INSIGHT_PACK_NOTICE,
      prompts: pack.prompts.map((prompt) => cleanText(prompt, 220)),
      influencesRecommendations: false,
    }));
}

export function validateOptionalInsightPack(pack = {}) {
  const errors = [];
  if (pack.notice !== OPTIONAL_INSIGHT_PACK_NOTICE) errors.push({ path: "notice", code: "MISSING_REFLECTION_ONLY_NOTICE" });
  if (pack.influencesRecommendations !== false) errors.push({ path: "influencesRecommendations", code: "MUST_NOT_INFLUENCE_RECOMMENDATIONS" });
  return { valid: errors.length === 0, errors, warnings: [] };
}
