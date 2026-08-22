import {
  INTELLIGENCE_ENGINE_VERSION,
  SHADOW_SUMMARY_SCHEMA_VERSION,
} from "../contracts/contractVersions.js";
import { validateShadowSummaryContract } from "../contracts/shadowSummarySchema.js";
import { anonymizeId, asArray, normalizeId, stableHash } from "./utils.js";
import { validateShadowPrivacy } from "./validateShadowPrivacy.js";

function roleIds(roles = []) {
  return asArray(roles).map((role) => normalizeId(role.id || role.roleName || role.label || role.name || role)).filter(Boolean).slice(0, 3);
}

export function buildShadowSummary({
  runId = null,
  profile = {},
  shadowResult = {},
  productionSnapshot = {},
  drift = {},
  activation = {},
  generatedAt = new Date().toISOString(),
  configVersion = "calibration.v1",
} = {}) {
  const inputCoverage = shadowResult.inputSummary?.sourceCoverage || {};
  const recommendations = shadowResult.reasoning?.recommendations || [];
  const summary = {
    schemaVersion: SHADOW_SUMMARY_SCHEMA_VERSION,
    runId: runId || `shadow_${stableHash({ profile: profile.user_id || profile.userId || profile.id || null, inputCoverage, production: productionSnapshot })}`,
    anonymizedProfileId: anonymizeId(profile.user_id || profile.userId || profile.id || profile.profile_id || profile.profileId, "profile"),
    generatedAt,
    engineVersion: INTELLIGENCE_ENGINE_VERSION,
    configVersion,
    inputCoverage: {
      onboarding: Boolean(inputCoverage.onboarding),
      cv: Boolean(inputCoverage.cv),
      careerDna: Boolean(inputCoverage.careerDna),
      projects: Boolean(inputCoverage.projects),
      experience: Boolean(inputCoverage.experience),
      education: Boolean(inputCoverage.education),
      certifications: Boolean(inputCoverage.certifications),
    },
    production: {
      topRoleId: roleIds(productionSnapshot.topRoles || productionSnapshot.topRoleMatches || productionSnapshot.roleMatches)[0] || null,
      topThreeRoleIds: roleIds(productionSnapshot.topRoles || productionSnapshot.topRoleMatches || productionSnapshot.roleMatches),
      biggestGapId: normalizeId(productionSnapshot.biggestGap || productionSnapshot.gapDetails?.title || "") || null,
    },
    shadow: {
      topRoleId: normalizeId(recommendations[0]?.label || "") || null,
      topThreeRoleIds: roleIds(recommendations.map((item) => item.label)),
      biggestGapId: normalizeId(shadowResult.reasoning?.missingEvidence?.primaryMissingEvidence?.competency || "") || null,
      decisionConfidence: recommendations[0]?.decisionConfidence ?? null,
    },
    drift: {
      typeCodes: asArray(drift.typeCodes),
      severity: drift.severity || "none",
      requiresReview: Boolean(drift.requiresReview),
    },
    quality: {
      traceCompleteness: shadowResult.guardrails?.trace?.completenessScore ?? null,
      criticalGuardrailViolations: asArray(shadowResult.guardrails?.violations).filter((item) => item.severity === "critical").length,
      evidenceCount: shadowResult.inputSummary?.evidenceCount ?? shadowResult.reasoning?.evidenceIntelligence?.evidenceObjects?.length ?? 0,
      unsupportedInferenceCount: asArray(shadowResult.guardrails?.violations).filter((item) => item.code === "UNSUPPORTED_COMPETENCY").length,
    },
    activation: {
      state: activation.state || "",
      blockers: asArray(activation.blockers),
    },
    warnings: asArray(shadowResult.warnings),
  };
  const contract = validateShadowSummaryContract(summary);
  const privacy = validateShadowPrivacy(summary);
  return {
    summary,
    contract,
    privacy,
  };
}
