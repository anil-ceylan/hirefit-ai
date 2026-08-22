import { SHADOW_SUMMARY_SCHEMA_VERSION } from "./contractVersions.js";
import { requireString, validationResult } from "./contractValidation.js";

export function validateShadowSummaryContract(summary = {}) {
  const errors = [];
  const warnings = [];
  if (summary.schemaVersion !== SHADOW_SUMMARY_SCHEMA_VERSION) {
    errors.push({ path: "schemaVersion", code: "INVALID_SCHEMA_VERSION" });
  }
  requireString(summary.runId, "runId", errors);
  requireString(summary.generatedAt, "generatedAt", errors);
  if (!summary.quality) errors.push({ path: "quality", code: "REQUIRED_OBJECT" });
  if (!summary.activation?.state) warnings.push({ path: "activation.state", code: "MISSING_ACTIVATION_STATE" });
  return validationResult({ errors, warnings });
}
