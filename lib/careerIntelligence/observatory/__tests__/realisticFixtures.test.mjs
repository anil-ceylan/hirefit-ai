import assert from "node:assert/strict";
import { observeDecisionRun } from "../index.js";
import { sanitizedProfileFixtures } from "../fixtures/index.js";

for (const fixture of sanitizedProfileFixtures) {
  const result = observeDecisionRun({
    profile: fixture.profile,
    productionSnapshot: fixture.productionSnapshot || fixture.profile.career_snapshot,
    featureFlags: { ENABLE_SHADOW_REASONING: true, ENABLE_DRIFT_ANALYSIS: true, ENABLE_PROMOTION_GATE_EVALUATION: true },
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(result.shadowSummary.runId, fixture.id);
  assert.equal(result.privacy.passed, true, fixture.id);
  assert.ok(result.shadowSummary.quality.evidenceCount >= 0, fixture.id);
}

console.error("realisticFixtures tests: PASS");
