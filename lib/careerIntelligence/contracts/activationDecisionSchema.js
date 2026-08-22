import { ACTIVATION_POLICY_VERSION } from "./contractVersions.js";
import { requireString, validationResult } from "./contractValidation.js";

export function toActivationDecisionContract(decision = {}) {
  return {
    schemaVersion: ACTIVATION_POLICY_VERSION,
    state: decision.state || "disabled",
    canRun: Boolean(decision.canRun),
    canPersistSummary: Boolean(decision.canPersistSummary),
    canShowInternally: Boolean(decision.canShowInternally),
    canInfluenceProduction: false,
    reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
    blockers: Array.isArray(decision.blockers) ? decision.blockers : [],
  };
}

export function validateActivationDecisionContract(decision = {}) {
  const errors = [];
  const warnings = [];
  if (decision.schemaVersion !== ACTIVATION_POLICY_VERSION) {
    errors.push({ path: "schemaVersion", code: "INVALID_SCHEMA_VERSION" });
  }
  requireString(decision.state, "state", errors);
  if (decision.canInfluenceProduction) errors.push({ path: "canInfluenceProduction", code: "PRODUCTION_INFLUENCE_NOT_ALLOWED" });
  if (decision.canRun && decision.state === "disabled") warnings.push({ path: "state", code: "DISABLED_BUT_CAN_RUN" });
  return validationResult({ errors, warnings });
}
