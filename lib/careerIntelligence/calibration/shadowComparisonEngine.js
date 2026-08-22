function norm(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function roleLabel(value) {
  return typeof value === "string" ? value : value?.label || value?.roleName || value?.name || "";
}

function overlap(left, right) {
  const a = new Set(left.map(norm));
  const b = new Set(right.map(norm));
  if (!a.size && !b.size) return 0;
  const hits = [...a].filter((item) => b.has(item)).length;
  return hits / Math.max(1, Math.min(a.size, b.size));
}

function rankingCorrelation(left, right) {
  const leftNorm = left.map(norm);
  const rightNorm = right.map(norm);
  const common = leftNorm.filter((item) => rightNorm.includes(item));
  if (common.length < 2) return null;
  const deltas = common.map((item) => Math.abs(leftNorm.indexOf(item) - rightNorm.indexOf(item)));
  const maxDelta = common.length - 1;
  const avgDelta = deltas.reduce((sum, value) => sum + value, 0) / common.length;
  return Number((1 - avgDelta / Math.max(1, maxDelta)).toFixed(2));
}

function severityFor(type) {
  if (type === "TOP_ROLE_MISMATCH") return "medium";
  if (type === "BIGGEST_GAP_MISMATCH") return "medium";
  if (type === "LOW_TRACE_SUPPORT") return "high";
  return "low";
}

export function compareProductionToShadow({ productionSnapshot = {}, reasoning = {} } = {}) {
  const productionRoles = asArray(productionSnapshot.topRoles).map(roleLabel).filter(Boolean);
  const shadowRoles = asArray(reasoning.recommendations).map((item) => item.label).filter(Boolean);
  const productionTop = productionRoles[0] || "";
  const shadowTop = shadowRoles[0] || "";
  const topRoleAgreement = Boolean(productionTop && shadowTop && norm(productionTop) === norm(shadowTop));
  const topThreeOverlap = Number(overlap(productionRoles.slice(0, 3), shadowRoles.slice(0, 3)).toFixed(2));
  const biggestGap = productionSnapshot.biggestGap || "";
  const shadowMissing = reasoning.missingEvidence?.primaryMissingEvidence?.competency || reasoning.missingEvidence?.primaryMissingEvidence?.reason || "";
  const biggestGapAgreement = Boolean(biggestGap && shadowMissing && (norm(biggestGap).includes(norm(shadowMissing)) || norm(shadowMissing).includes(norm(biggestGap))));
  const divergences = [];
  if (productionTop && shadowTop && !topRoleAgreement) {
    divergences.push({
      type: "TOP_ROLE_MISMATCH",
      productionValue: productionTop,
      shadowValue: shadowTop,
      severity: severityFor("TOP_ROLE_MISMATCH"),
      explanation: ["Production and shadow top roles differ. Review evidence support before migration."],
      supportingEvidenceIds: reasoning.topRecommendation?.evidenceIds || [],
      missingEvidence: reasoning.topRecommendation?.missingEvidenceIds || [],
    });
  }
  if (biggestGap && shadowMissing && !biggestGapAgreement) {
    divergences.push({
      type: "BIGGEST_GAP_MISMATCH",
      productionValue: biggestGap,
      shadowValue: shadowMissing,
      severity: severityFor("BIGGEST_GAP_MISMATCH"),
      explanation: ["Production gap and shadow uncertainty point to different concepts."],
      supportingEvidenceIds: [],
      missingEvidence: [reasoning.missingEvidence?.primaryMissingEvidence?.id].filter(Boolean),
    });
  }
  const correlation = rankingCorrelation(productionRoles, shadowRoles);
  const agreementLevel = topRoleAgreement && topThreeOverlap >= 0.67
    ? "strong"
    : topThreeOverlap >= 0.34 || topRoleAgreement
      ? "partial"
      : "low";
  return {
    topRoleAgreement,
    topThreeOverlap,
    biggestGapAgreement,
    rankingCorrelation: correlation,
    directionalConsistency: {
      recruiterTrustVsEvidenceTrust: productionSnapshot.recruiterTrust == null ? "not_measurable" : "derived",
      readinessVsCoverage: productionSnapshot.careerReadiness == null ? "not_measurable" : "derived",
    },
    divergences,
    summary: {
      agreementLevel,
      requiresReview: divergences.some((item) => item.severity === "high" || item.severity === "medium"),
    },
  };
}
