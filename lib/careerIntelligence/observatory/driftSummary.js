import { asArray, metric } from "./utils.js";

function average(values) {
  const nums = asArray(values).map(Number).filter(Number.isFinite);
  return nums.length ? Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(3)) : null;
}

function rate(count, total) {
  return total ? Number((count / total).toFixed(3)) : null;
}

export function summarizeDecisionDrift(runs = [], { minimumSample = 3 } = {}) {
  const items = asArray(runs);
  const validRuns = items.filter((run) => run && !run.blocked);
  const sampleStatus = validRuns.length >= minimumSample ? "observed" : "insufficient_sample";
  const severityRuns = (severity) => validRuns.filter((run) => run.drift?.severity === severity).length;
  return {
    totalRuns: metric(items.length, "observed", items.length),
    validRuns: metric(validRuns.length, "observed", items.length),
    blockedRuns: metric(items.length - validRuns.length, "observed", items.length),
    noDriftRuns: metric(validRuns.filter((run) => run.drift?.typeCodes?.includes("NO_MEANINGFUL_DRIFT")).length, sampleStatus, validRuns.length),
    lowSeverityRuns: metric(severityRuns("low"), sampleStatus, validRuns.length),
    mediumSeverityRuns: metric(severityRuns("medium"), sampleStatus, validRuns.length),
    highSeverityRuns: metric(severityRuns("high"), sampleStatus, validRuns.length),
    criticalSeverityRuns: metric(severityRuns("critical"), sampleStatus, validRuns.length),
    topRoleAgreementRate: metric(rate(validRuns.filter((run) => run.shadowResult?.productionComparison?.topRoleAgreement).length, validRuns.length), sampleStatus, validRuns.length),
    topThreeOverlapAverage: metric(average(validRuns.map((run) => run.shadowResult?.productionComparison?.topThreeOverlap)), sampleStatus, validRuns.length),
    biggestGapAgreementRate: metric(rate(validRuns.filter((run) => run.shadowResult?.productionComparison?.biggestGapAgreement).length, validRuns.length), sampleStatus, validRuns.length),
    traceCompletenessAverage: metric(average(validRuns.map((run) => run.shadowResult?.guardrails?.trace?.completenessScore)), sampleStatus, validRuns.length),
    guardrailViolationRate: metric(rate(validRuns.filter((run) => (run.shadowResult?.guardrails?.violations || []).length > 0).length, validRuns.length), sampleStatus, validRuns.length),
    manualReviewRate: metric(rate(validRuns.filter((run) => run.drift?.requiresReview).length, validRuns.length), sampleStatus, validRuns.length),
  };
}
