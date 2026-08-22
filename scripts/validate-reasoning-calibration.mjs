import {
  calculateCalibrationMetrics,
  evaluateReasoningSensitivity,
  evaluateRankingStability,
  goldenPersonas,
  runShadowReasoning,
} from "../lib/careerIntelligence/calibration/index.js";

const critical = new Set(["SOURCE_TRACEABILITY", "TRACE_INCOMPLETE", "SIMULATION_SAFETY", "UNSUPPORTED_COMPETENCY"]);

function runPersona(persona) {
  const result = runShadowReasoning({
    profile: persona.input,
    productionSnapshot: persona.input.career_snapshot,
    historicalSnapshots: persona.history || [],
  });
  const criticalViolations = result.guardrails.violations.filter((item) => item.severity === "critical" || critical.has(item.code));
  const stability = evaluateRankingStability({
    profile: persona.input,
    productionSnapshot: persona.input.career_snapshot,
  });
  return {
    id: persona.id,
    description: persona.description,
    expected: persona.expected,
    reasoning: result.reasoning,
    productionComparison: result.productionComparison,
    guardrails: result.guardrails,
    stability,
    warnings: result.warnings,
    criticalViolations,
  };
}

const cases = goldenPersonas.map(runPersona);
const metrics = calculateCalibrationMetrics(cases);
const failedRows = metrics.rows.filter((row) => !row.passed);
const criticalViolations = cases.flatMap((item) => item.criticalViolations.map((violation) => ({ persona: item.id, ...violation })));
const stabilityScore = Number((cases.reduce((sum, item) => sum + item.stability.stabilityScore, 0) / cases.length).toFixed(3));
const sensitivity = evaluateReasoningSensitivity({
  profile: goldenPersonas[0].input,
  productionSnapshot: goldenPersonas[0].input.career_snapshot,
});
metrics.rankingStability = {
  value: stabilityScore,
  status: "observed",
  sampleSize: cases.length,
};
const summary = {
  personas: cases.length,
  passed: metrics.summary.passed,
  failed: metrics.summary.failed,
  hallucinationRate: metrics.hallucinationRate,
  traceCompleteness: metrics.explanationTraceCompleteness,
  topRoleAccuracy: metrics.roleRankingAccuracy,
  conflictDetectionAccuracy: metrics.conflictDetectionAccuracy,
  missingEvidenceAccuracy: metrics.missingEvidenceAccuracy,
  rankingStability: metrics.rankingStability,
  sensitivity,
  criticalGuardrailViolations: criticalViolations.length,
};

console.error("Reasoning Calibration Validation");
console.error(JSON.stringify(summary, null, 2));
if (failedRows.length) {
  console.error("Failed expectations:");
  console.error(JSON.stringify(failedRows.map((row) => ({ id: row.id, failures: row.failures, topRole: row.topRole, decisionConfidence: row.decisionConfidence })), null, 2));
}
if (criticalViolations.length) {
  console.error("Critical guardrail violations:");
  console.error(JSON.stringify(criticalViolations, null, 2));
}

if (criticalViolations.length) process.exit(1);
