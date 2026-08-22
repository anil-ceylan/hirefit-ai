import { toActivationDecisionContract } from "../contracts/activationDecisionSchema.js";
import { ACTIVATION_STATES, resolveObservatoryFeatureFlags } from "./activationConfig.js";
import { evaluateActivationEligibility } from "./activationEligibility.js";

export function evaluateActivationPolicy({
  featureFlags = {},
  profile = {},
  shadowResult = null,
  contracts = {},
} = {}) {
  const flags = resolveObservatoryFeatureFlags(featureFlags);
  if (!flags.ENABLE_SHADOW_REASONING) {
    return toActivationDecisionContract({
      state: ACTIVATION_STATES.DISABLED,
      canRun: false,
      canPersistSummary: false,
      canShowInternally: false,
      reasons: ["Shadow reasoning flag is disabled."],
      blockers: [],
    });
  }

  const eligibility = evaluateActivationEligibility({ profile, shadowResult, contracts });
  const canPersistSummary = Boolean(flags.ENABLE_SHADOW_LOGGING && eligibility.eligible);
  const canShowInternally = Boolean(flags.ENABLE_DECISION_OBSERVATORY || flags.ENABLE_INTERNAL_REASONING_INSPECTOR);
  const state = eligibility.eligible
    ? canPersistSummary
      ? ACTIVATION_STATES.SHADOW_LOGGED
      : canShowInternally
        ? ACTIVATION_STATES.INTERNAL_REVIEW
        : ACTIVATION_STATES.SHADOW_ONLY
    : ACTIVATION_STATES.BLOCKED;

  return toActivationDecisionContract({
    state,
    canRun: true,
    canPersistSummary,
    canShowInternally,
    canInfluenceProduction: false,
    reasons: eligibility.reasons,
    blockers: eligibility.blockers,
  });
}
