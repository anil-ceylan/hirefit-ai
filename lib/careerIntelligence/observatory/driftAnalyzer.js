import { asArray, highestSeverity, normalizeId } from "./utils.js";

const DEFAULT_SEVERITY = Object.freeze({
  TOP_ROLE_MISMATCH: "medium",
  TOP_THREE_LOW_OVERLAP: "medium",
  BIGGEST_GAP_MISMATCH: "medium",
  ROLE_ORDER_DIVERGENCE: "low",
  CONFIDENCE_DIRECTION_MISMATCH: "medium",
  UNSUPPORTED_PRODUCTION_RECOMMENDATION: "high",
  UNSUPPORTED_SHADOW_RECOMMENDATION: "high",
  MISSING_REASONING_TRACE: "critical",
  CRITICAL_GUARDRAIL_FAILURE: "critical",
  EVIDENCE_TRUST_DIVERGENCE: "medium",
  INSUFFICIENT_DATA: "low",
  NO_MEANINGFUL_DRIFT: "low",
});

function roleIds(roles = []) {
  return asArray(roles).map((role) => normalizeId(role.id || role.roleName || role.label || role.name || role));
}

function add(items, code, values = {}, config = {}) {
  const severity = config.severity?.[code] || DEFAULT_SEVERITY[code] || "low";
  items.push({
    code,
    severity,
    productionValue: values.productionValue ?? null,
    shadowValue: values.shadowValue ?? null,
    explanation: asArray(values.explanation),
    evidenceIds: asArray(values.evidenceIds),
    missingEvidence: asArray(values.missingEvidence),
    requiresManualReview: values.requiresManualReview ?? (severity === "high" || severity === "critical"),
  });
}

export function analyzeDecisionDrift({
  productionSnapshot = {},
  shadowResult = {},
  productionComparison = null,
  config = {},
} = {}) {
  const items = [];
  const comparison = productionComparison || shadowResult.productionComparison || {};
  const productionTop = roleIds(productionSnapshot.topRoles || productionSnapshot.topRoleMatches || productionSnapshot.roleMatches)[0] || null;
  const shadowTop = normalizeId(shadowResult.reasoning?.recommendations?.[0]?.label || shadowResult.reasoning?.topRecommendation?.label || "");
  const evidenceCount = shadowResult.inputSummary?.evidenceCount ?? 0;

  if (!evidenceCount) {
    add(items, "INSUFFICIENT_DATA", { explanation: ["Shadow input did not contain traceable evidence."] }, config);
  }
  if (comparison.topRoleAgreement === false || (productionTop && shadowTop && productionTop !== shadowTop)) {
    add(items, "TOP_ROLE_MISMATCH", {
      productionValue: productionTop,
      shadowValue: shadowTop,
      explanation: ["Production and shadow disagree on the leading role direction."],
      evidenceIds: shadowResult.reasoning?.topRecommendation?.evidenceIds,
      missingEvidence: shadowResult.reasoning?.topRecommendation?.missingEvidenceIds,
    }, config);
  }
  if (Number(comparison.topThreeOverlap ?? 1) < 0.5) {
    add(items, "TOP_THREE_LOW_OVERLAP", {
      productionValue: productionSnapshot.topRoles || productionSnapshot.topRoleMatches || [],
      shadowValue: shadowResult.reasoning?.recommendations?.slice(0, 3).map((item) => item.label),
      explanation: ["Production and shadow top-three role sets have low overlap."],
    }, config);
  }
  if (comparison.biggestGapAgreement === false) {
    add(items, "BIGGEST_GAP_MISMATCH", {
      productionValue: productionSnapshot.biggestGap || productionSnapshot.gapDetails?.title || null,
      shadowValue: shadowResult.reasoning?.missingEvidence?.primaryMissingEvidence?.competency || null,
      explanation: ["Production gap and shadow missing evidence point to different blockers."],
    }, config);
  }
  if (comparison.rankingCorrelation != null && comparison.rankingCorrelation < 0.6) {
    add(items, "ROLE_ORDER_DIVERGENCE", {
      productionValue: comparison.rankingCorrelation,
      shadowValue: shadowResult.reasoning?.recommendations?.map((item) => item.label),
      explanation: ["Shared role ordering differs materially."],
    }, config);
  }
  const trace = shadowResult.guardrails?.trace || {};
  if (trace.complete === false) {
    add(items, "MISSING_REASONING_TRACE", {
      explanation: ["One or more recommendations lack complete internal evidence trace."],
      missingEvidence: trace.results?.flatMap((item) => item.missingLinks),
    }, config);
  }
  const criticalGuardrails = asArray(shadowResult.guardrails?.violations).filter((item) => item.severity === "critical");
  if (criticalGuardrails.length) {
    add(items, "CRITICAL_GUARDRAIL_FAILURE", {
      explanation: ["Critical guardrail violation blocks activation."],
      evidenceIds: criticalGuardrails.flatMap((item) => asArray(item.supportingEvidenceIds)),
    }, config);
  }
  const unsupportedShadow = asArray(shadowResult.guardrails?.violations).filter((item) => item.code === "UNSUPPORTED_ROLE");
  if (unsupportedShadow.length) {
    add(items, "UNSUPPORTED_SHADOW_RECOMMENDATION", {
      explanation: ["Shadow top recommendation is not sufficiently supported by evidence."],
      evidenceIds: unsupportedShadow.flatMap((item) => asArray(item.supportingEvidenceIds)),
    }, config);
  }

  if (!items.length) {
    add(items, "NO_MEANINGFUL_DRIFT", { explanation: ["No material production-shadow drift detected."] }, config);
  }

  return {
    items,
    typeCodes: items.map((item) => item.code),
    severity: highestSeverity(items),
    requiresReview: items.some((item) => item.requiresManualReview),
  };
}
