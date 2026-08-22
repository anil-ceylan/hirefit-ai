import assert from "node:assert/strict";
import {
  calculateCalibrationMetrics,
  goldenPersonas,
  runShadowReasoning,
} from "../index.js";

const cases = goldenPersonas.map((persona) => {
  const result = runShadowReasoning({
    profile: persona.input,
    productionSnapshot: persona.input.career_snapshot,
    historicalSnapshots: persona.history || [],
  });
  return {
    id: persona.id,
    expected: persona.expected,
    reasoning: result.reasoning,
    productionComparison: result.productionComparison,
    guardrails: result.guardrails,
  };
});

const metrics = calculateCalibrationMetrics(cases);
assert.equal(goldenPersonas.length >= 20, true, "At least 20 golden personas are required.");
assert.equal(metrics.hallucinationRate.value, 0, "Hallucination rate should be observed at zero for golden personas.");
assert.equal(metrics.evidenceSourceTraceability.value, 1, "All evidence should be source traceable.");
assert.equal(
  cases.flatMap((item) => item.guardrails.violations).filter((item) => item.severity === "critical").length,
  0,
  "Golden personas must not have critical guardrail violations."
);

console.error("goldenPersonas tests: PASS");
