import { DECISION_OPTION_SCHEMA_VERSION } from "./contractVersions.js";
import { requireString, validationResult } from "./contractValidation.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function confidenceLevel(value) {
  const score = Number(value || 0);
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function toDecisionOptionContract(recommendation = {}, rank = 1) {
  const option = recommendation.option || {};
  return {
    schemaVersion: DECISION_OPTION_SCHEMA_VERSION,
    id: String(recommendation.id || option.id || `decision_option_${rank}`),
    type: option.type || "role",
    title: recommendation.label || option.label || option.title || "",
    rank,
    confidence: Number.isFinite(Number(recommendation.decisionConfidence)) ? Number(recommendation.decisionConfidence) : null,
    confidenceLevel: recommendation.confidenceBand || confidenceLevel(recommendation.decisionConfidence),
    requiredCompetencies: asArray(option.requiredCompetencies),
    supportingCompetencies: asArray(recommendation.supportingCompetencies),
    missingCompetencies: asArray(recommendation.missingCompetencies),
    supportingEvidenceIds: asArray(recommendation.evidenceIds),
    hypothesisIds: asArray(recommendation.hypothesisIds),
    inferenceIds: asArray(recommendation.inferenceIds),
    conflicts: asArray(recommendation.conflictIds || recommendation.conflicts),
    explanation: asArray(recommendation.explanation || recommendation.explanationTrace?.summary),
    guardrailEligible: Boolean(recommendation.guardrailEligible || recommendation.decisionConfidence >= 50),
  };
}

export function validateDecisionOptionContract(option = {}) {
  const errors = [];
  const warnings = [];
  if (option.schemaVersion !== DECISION_OPTION_SCHEMA_VERSION) {
    errors.push({ path: "schemaVersion", code: "INVALID_SCHEMA_VERSION" });
  }
  requireString(option.id, "id", errors);
  requireString(option.type, "type", errors);
  requireString(option.title, "title", errors);
  if (!Array.isArray(option.requiredCompetencies)) errors.push({ path: "requiredCompetencies", code: "REQUIRED_ARRAY" });
  if (!Array.isArray(option.supportingEvidenceIds)) errors.push({ path: "supportingEvidenceIds", code: "REQUIRED_ARRAY" });
  if (option.confidence == null) warnings.push({ path: "confidence", code: "MISSING_CONFIDENCE" });
  return validationResult({ errors, warnings });
}
