export const DEFAULT_REASONING_WEIGHTS = Object.freeze({
  inference: {
    evidenceQuality: 0.3,
    evidenceTrust: 0.24,
    evidenceStrength: 0.2,
    freshness: 0.1,
    sourceDiversity: 0.1,
    evidenceCount: 0.06,
  },
  hypothesis: {
    inferenceConfidence: 0.42,
    coverage: 0.22,
    trust: 0.18,
    conflictPenalty: 0.12,
    missingPenalty: 0.06,
  },
  decisionConfidence: {
    evidenceQuality: 0.22,
    competencyAlignment: 0.24,
    hypothesisConfidence: 0.22,
    missingEvidencePenalty: 0.14,
    conflictPenalty: 0.12,
    opportunityImpact: 0.06,
  },
});

export const DEFAULT_CONFLICT_RULES = Object.freeze([
  {
    id: "strong_claim_without_support",
    appliesTo: ["claim"],
    description: "A strong self-claim is present without enough supporting evidence.",
  },
  {
    id: "high_ownership_without_outcome",
    competency: "ownership",
    description: "Ownership is claimed but measurable or qualitative outcome evidence is weak.",
  },
  {
    id: "role_context_without_artifact",
    description: "Target-role evidence exists but lacks an inspectable artifact or source.",
  },
]);

export const DEFAULT_REASONING_THRESHOLDS = Object.freeze({
  strongHypothesis: 72,
  weakHypothesis: 38,
  lowDecisionConfidence: 45,
  highConflictPenalty: 22,
  minimumRecommendationConfidence: 25,
});
