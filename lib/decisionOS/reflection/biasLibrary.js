export const BIAS_LIBRARY = Object.freeze([
  {
    id: "loss_aversion",
    label: "Loss Aversion",
    signals: ["lose", "loss", "risk", "safe", "security", "miss out", "fear"],
    reflectionPrompt: "What possible loss feels most important here, and is it larger in your mind than the possible gain?",
  },
  {
    id: "confirmation_bias",
    label: "Confirmation Bias",
    signals: ["prove", "already know", "obvious", "everyone says", "only looking"],
    reflectionPrompt: "What evidence would make you change your mind?",
  },
  {
    id: "status_quo_bias",
    label: "Status Quo Bias",
    signals: ["stay", "comfortable", "same", "stable", "avoid change"],
    reflectionPrompt: "If you were starting from zero today, would you still choose the current path?",
  },
  {
    id: "authority_bias",
    label: "Authority Bias",
    signals: ["parents", "manager", "professor", "mentor", "prestige", "brand"],
    reflectionPrompt: "Whose opinion is carrying extra weight in this decision?",
  },
  {
    id: "recency_bias",
    label: "Recency Bias",
    signals: ["recent", "last week", "today", "just happened", "latest"],
    reflectionPrompt: "Would this decision feel the same if the recent event had not happened?",
  },
  {
    id: "sunk_cost_fallacy",
    label: "Sunk Cost Fallacy",
    signals: ["already spent", "years", "wasted", "too late", "cannot quit"],
    reflectionPrompt: "If past effort could not be recovered either way, what would you choose next?",
  },
  {
    id: "availability_bias",
    label: "Availability Bias",
    signals: ["heard about", "friend", "viral", "seen everywhere", "example"],
    reflectionPrompt: "Are vivid examples making this option feel more common or safer than it is?",
  },
  {
    id: "optimism_bias",
    label: "Optimism Bias",
    signals: ["easy", "guaranteed", "sure", "definitely", "will work"],
    reflectionPrompt: "What would have to go wrong for this decision to disappoint you?",
  },
  {
    id: "planning_fallacy",
    label: "Planning Fallacy",
    signals: ["quick", "simple", "only", "just need", "soon"],
    reflectionPrompt: "What part of this plan is most likely to take longer than expected?",
  },
  {
    id: "imposter_syndrome",
    label: "Imposter Syndrome",
    signals: ["not enough", "not ready", "who am i", "lucky", "fraud"],
    reflectionPrompt: "Which concern is about missing evidence, and which is about how you feel about yourself?",
  },
  {
    id: "perfectionism",
    label: "Perfectionism",
    signals: ["perfect", "not ready", "one more", "before I start", "flawless"],
    reflectionPrompt: "What would be good enough to learn from the next step?",
  },
  {
    id: "need_for_control",
    label: "Need for Control",
    signals: ["control", "certainty", "know everything", "no surprises", "predict"],
    reflectionPrompt: "Which uncertainty can you reduce, and which uncertainty must you tolerate?",
  },
  {
    id: "fear_of_judgment",
    label: "Fear of Judgment",
    signals: ["judged", "embarrassed", "what people think", "rejection", "fail publicly"],
    reflectionPrompt: "If nobody could judge this decision, what would change?",
  },
]);

export function findPotentialBiases(text = "", { max = 4 } = {}) {
  const lower = String(text || "").toLowerCase();
  return BIAS_LIBRARY
    .map((bias) => {
      const hits = bias.signals.filter((signal) => lower.includes(signal)).length;
      if (!hits) return null;
      return {
        id: bias.id,
        label: bias.label,
        confidence: hits >= 2 ? "medium" : "low",
        framing: `You may want to consider whether ${bias.label} is influencing this decision.`,
        reflectionPrompt: bias.reflectionPrompt,
      };
    })
    .filter(Boolean)
    .slice(0, max);
}
