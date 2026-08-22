import { CALIBRATION_STATUS } from "./calibrationConfig.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function norm(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function metric(value, status, sampleSize, extra = {}) {
  return { value, status, sampleSize, ...extra };
}

function ratio(pass, total) {
  return total ? Number((pass / total).toFixed(3)) : null;
}

function includesAny(label, expected) {
  const text = norm(label);
  return asArray(expected).some((item) => text.includes(norm(item)) || norm(item).includes(text));
}

export function evaluateCalibrationCase({ id, expected = {}, reasoning = {}, productionComparison = {}, guardrails = {} } = {}) {
  const expectedSafe = expected || {};
  const failures = [];
  const recommendations = asArray(reasoning.recommendations);
  const topRole = recommendations[0]?.label || "";
  for (const item of asArray(expectedSafe.topRoleIncludes)) {
    if (!includesAny(topRole, [item])) failures.push(`top_role_missing:${item}`);
  }
  for (const item of asArray(expectedSafe.topRoleExcludes)) {
    if (includesAny(topRole, [item])) failures.push(`top_role_excluded:${item}`);
  }
  for (const competency of asArray(expectedSafe.expectedStrongCompetencies)) {
    const hypothesis = asArray(reasoning.hypotheses).find((item) => item.competency === competency);
    if (!hypothesis || hypothesis.confidence < 60) failures.push(`strong_competency_missing:${competency}`);
  }
  for (const competency of asArray(expectedSafe.expectedWeakCompetencies)) {
    const hypothesis = asArray(reasoning.hypotheses).find((item) => item.competency === competency);
    if (hypothesis && hypothesis.confidence > 55) failures.push(`weak_competency_inflated:${competency}`);
  }
  for (const missing of asArray(expectedSafe.expectedMissingEvidence)) {
    const found = asArray(reasoning.missingEvidence?.missingEvidence).some((item) =>
      norm(item.competency).includes(norm(missing)) || norm(item.reason).includes(norm(missing))
    );
    if (!found) failures.push(`missing_evidence_not_found:${missing}`);
  }
  for (const conflict of asArray(expectedSafe.expectedConflicts)) {
    const found = asArray(reasoning.conflicts?.conflicts).some((item) => item.id === conflict || norm(item.id).includes(norm(conflict)));
    if (!found) failures.push(`conflict_not_found:${conflict}`);
  }
  const trust = reasoning.evidenceIntelligence?.quality?.averageQuality ?? null;
  if (expectedSafe.minimumEvidenceTrust != null && trust < expectedSafe.minimumEvidenceTrust) failures.push("minimum_evidence_trust");
  if (expectedSafe.maximumEvidenceTrust != null && trust > expectedSafe.maximumEvidenceTrust) failures.push("maximum_evidence_trust");
  const decisionConfidence = recommendations[0]?.decisionConfidence ?? null;
  if (expectedSafe.minimumDecisionConfidence != null && decisionConfidence < expectedSafe.minimumDecisionConfidence) failures.push("minimum_decision_confidence");
  if (expectedSafe.maximumDecisionConfidence != null && decisionConfidence > expectedSafe.maximumDecisionConfidence) failures.push("maximum_decision_confidence");
  for (const guardrail of asArray(expectedSafe.expectedGuardrails)) {
    const found = asArray(guardrails.violations).some((item) => item.code === guardrail);
    if (!found) failures.push(`guardrail_not_found:${guardrail}`);
  }
  const criticalViolations = asArray(guardrails.violations).filter((item) => item.severity === "critical");
  if (criticalViolations.length) failures.push("critical_guardrail_violation");
  return {
    id,
    passed: failures.length === 0,
    failures,
    topRole,
    decisionConfidence,
    productionAgreement: productionComparison.summary?.agreementLevel || "not_measurable",
  };
}

export function calculateCalibrationMetrics(cases = []) {
  const rows = asArray(cases).map(evaluateCalibrationCase);
  const withExpected = asArray(cases).filter((row) => row.expected);
  const traceRows = asArray(cases).map((row) => row.guardrails?.trace).filter(Boolean);
  const hallucinationRows = asArray(cases).map((row) => {
    const highUnsupported = asArray(row.reasoning?.hypotheses).filter((hypothesis) =>
      hypothesis.confidence >= 72 && !hypothesis.evidenceIds?.length
    );
    return highUnsupported.length;
  });
  const sourceTraceRows = asArray(cases).map((row) =>
    asArray(row.reasoning?.evidenceIntelligence?.evidenceObjects).every((item) => item.source && item.source_type)
  );
  const conflictExpectationRows = asArray(cases).filter((row) => asArray(row.expected?.expectedConflicts).length);
  const missingExpectationRows = asArray(cases).filter((row) => asArray(row.expected?.expectedMissingEvidence).length);
  const roleExpectationRows = asArray(cases).filter((row) => asArray(row.expected?.topRoleIncludes).length || asArray(row.expected?.topRoleExcludes).length);

  return {
    rows,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.passed).length,
      failed: rows.filter((row) => !row.passed).length,
    },
    classificationAccuracy: metric(null, CALIBRATION_STATUS.NOT_MEASURABLE, 0),
    competencyPrecision: metric(null, CALIBRATION_STATUS.NOT_MEASURABLE, 0),
    competencyRecall: metric(
      withExpected.length ? ratio(rows.filter((row) => !row.failures.some((failure) => failure.startsWith("strong_competency_missing"))).length, rows.length) : null,
      withExpected.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      withExpected.length
    ),
    conflictDetectionAccuracy: metric(
      conflictExpectationRows.length
        ? ratio(conflictExpectationRows.filter((row) => !evaluateCalibrationCase(row).failures.some((failure) => failure.startsWith("conflict_not_found"))).length, conflictExpectationRows.length)
        : null,
      conflictExpectationRows.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      conflictExpectationRows.length
    ),
    missingEvidenceAccuracy: metric(
      missingExpectationRows.length
        ? ratio(missingExpectationRows.filter((row) => !evaluateCalibrationCase(row).failures.some((failure) => failure.startsWith("missing_evidence_not_found"))).length, missingExpectationRows.length)
        : null,
      missingExpectationRows.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      missingExpectationRows.length
    ),
    roleRankingAccuracy: metric(
      roleExpectationRows.length
        ? ratio(roleExpectationRows.filter((row) => evaluateCalibrationCase(row).failures.every((failure) => !failure.startsWith("top_role_"))).length, roleExpectationRows.length)
        : null,
      roleExpectationRows.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      roleExpectationRows.length
    ),
    topRoleAgreement: metric(
      asArray(cases).length ? ratio(asArray(cases).filter((row) => row.productionComparison?.topRoleAgreement).length, cases.length) : null,
      asArray(cases).length ? CALIBRATION_STATUS.DERIVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      asArray(cases).length
    ),
    topThreeOverlap: metric(
      asArray(cases).length
        ? Number((asArray(cases).reduce((sum, row) => sum + Number(row.productionComparison?.topThreeOverlap || 0), 0) / cases.length).toFixed(3))
        : null,
      asArray(cases).length ? CALIBRATION_STATUS.DERIVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      asArray(cases).length
    ),
    rankingStability: metric(null, CALIBRATION_STATUS.NOT_MEASURABLE, 0),
    confidenceCalibration: metric(null, CALIBRATION_STATUS.DERIVED, asArray(cases).length),
    explanationTraceCompleteness: metric(
      traceRows.length ? Number((traceRows.reduce((sum, trace) => sum + Number(trace.completenessScore || 0), 0) / traceRows.length).toFixed(3)) : null,
      traceRows.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      traceRows.length
    ),
    evidenceSourceTraceability: metric(
      sourceTraceRows.length ? ratio(sourceTraceRows.filter(Boolean).length, sourceTraceRows.length) : null,
      sourceTraceRows.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      sourceTraceRows.length
    ),
    duplicatePenaltyAccuracy: metric(null, CALIBRATION_STATUS.NOT_MEASURABLE, 0),
    unsupportedInferenceRate: metric(
      hallucinationRows.length ? ratio(hallucinationRows.filter((count) => count > 0).length, hallucinationRows.length) : null,
      hallucinationRows.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      hallucinationRows.length
    ),
    hallucinationRate: metric(
      hallucinationRows.length ? ratio(hallucinationRows.filter((count) => count > 0).length, hallucinationRows.length) : null,
      hallucinationRows.length ? CALIBRATION_STATUS.OBSERVED : CALIBRATION_STATUS.NOT_MEASURABLE,
      hallucinationRows.length
    ),
  };
}
