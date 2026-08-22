function envValue(name) {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name];
}

function boolFromEnv(name, fallback) {
  const value = envValue(name);
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

export function isLocalDevelopment() {
  const nodeEnv = envValue("NODE_ENV");
  const viteMode = envValue("MODE");
  return nodeEnv !== "production" && viteMode !== "production";
}

export function resolveObservatoryFeatureFlags(overrides = {}) {
  const local = isLocalDevelopment();
  return {
    ENABLE_SHADOW_REASONING: boolFromEnv("ENABLE_SHADOW_REASONING", local),
    ENABLE_SHADOW_LOGGING: boolFromEnv("ENABLE_SHADOW_LOGGING", false),
    ENABLE_DECISION_OBSERVATORY: boolFromEnv("ENABLE_DECISION_OBSERVATORY", false),
    ENABLE_INTERNAL_REASONING_INSPECTOR: boolFromEnv("ENABLE_INTERNAL_REASONING_INSPECTOR", false),
    ENABLE_DRIFT_ANALYSIS: boolFromEnv("ENABLE_DRIFT_ANALYSIS", local),
    ENABLE_PROMOTION_GATE_EVALUATION: boolFromEnv("ENABLE_PROMOTION_GATE_EVALUATION", local),
    ...overrides,
  };
}

export const ACTIVATION_STATES = Object.freeze({
  DISABLED: "disabled",
  SHADOW_ONLY: "shadow_only",
  SHADOW_LOGGED: "shadow_logged",
  INTERNAL_REVIEW: "internal_review",
  ELIGIBLE_FOR_CONTROLLED_ACTIVATION: "eligible_for_controlled_activation",
  BLOCKED: "blocked",
});

export const DEFAULT_PROMOTION_GATE_CONFIG = Object.freeze({
  minimumTraceCompleteness: 0.9,
  minimumTopDecisionConfidence: 50,
  minimumTopEvidenceCount: 1,
  minimumRankingStability: 0.95,
  minimumRealShadowRuns: 30,
  highSeverityReviewRequired: true,
});
