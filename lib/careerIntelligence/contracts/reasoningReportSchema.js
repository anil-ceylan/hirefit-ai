import {
  INTELLIGENCE_ENGINE_VERSION,
  REASONING_REPORT_SCHEMA_VERSION,
} from "./contractVersions.js";
import { mergeContractResults, requireArray, validationResult } from "./contractValidation.js";
import { toDecisionOptionContract, validateDecisionOptionContract } from "./decisionOptionSchema.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function toReasoningReportContract({
  shadowResult = {},
  anonymizedProfileId = null,
  generatedAt = new Date().toISOString(),
  configVersion = "calibration.v1",
} = {}) {
  const reasoning = shadowResult.reasoning || {};
  return {
    schemaVersion: REASONING_REPORT_SCHEMA_VERSION,
    engineVersion: INTELLIGENCE_ENGINE_VERSION,
    configVersion,
    generatedAt,
    profileReference: { anonymizedProfileId },
    evidenceSummary: {
      evidenceCount: reasoning.evidenceIntelligence?.evidenceObjects?.length || 0,
      averageQuality: reasoning.evidenceIntelligence?.quality?.averageQuality ?? null,
      coverage: reasoning.evidenceIntelligence?.coverage || {},
    },
    competencies: Object.entries(reasoning.evidenceIntelligence?.confidenceByCompetency || {}).map(([id, confidence]) => ({ id, confidence })),
    inferences: asArray(reasoning.inferences).map((item) => ({
      id: item.id,
      competency: item.competency,
      confidence: item.confidence,
      evidenceIds: asArray(item.evidenceIds),
    })),
    hypotheses: asArray(reasoning.hypotheses).map((item) => ({
      id: item.id,
      competency: item.competency,
      confidence: item.confidence,
      evidenceIds: asArray(item.evidenceIds),
    })),
    conflicts: asArray(reasoning.conflicts?.conflicts),
    missingEvidence: asArray(reasoning.missingEvidence?.missingEvidence),
    decisionOptions: asArray(reasoning.recommendations).map(toDecisionOptionContract),
    guardrailResult: shadowResult.guardrails || {},
    traceValidation: shadowResult.guardrails?.trace || {},
    warnings: asArray(shadowResult.warnings),
  };
}

export function validateReasoningReportContract(report = {}) {
  const errors = [];
  const warnings = [];
  if (report.schemaVersion !== REASONING_REPORT_SCHEMA_VERSION) {
    errors.push({ path: "schemaVersion", code: "INVALID_SCHEMA_VERSION" });
  }
  requireArray(report.competencies, "competencies", errors);
  requireArray(report.inferences, "inferences", errors);
  requireArray(report.hypotheses, "hypotheses", errors);
  requireArray(report.decisionOptions, "decisionOptions", errors);
  const optionResults = asArray(report.decisionOptions).map(validateDecisionOptionContract);
  if (!report.profileReference || !Object.hasOwn(report.profileReference, "anonymizedProfileId")) {
    warnings.push({ path: "profileReference.anonymizedProfileId", code: "MISSING_ANON_PROFILE_ID" });
  }
  return mergeContractResults([validationResult({ errors, warnings }), ...optionResults]);
}
