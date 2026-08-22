import assert from "node:assert/strict";
import { createInMemoryShadowLogStore, observeDecisionRun } from "../index.js";
import { strongProductProfile } from "../fixtures/index.js";

const disabled = observeDecisionRun({
  profile: strongProductProfile.profile,
  featureFlags: { ENABLE_SHADOW_REASONING: false },
});
assert.equal(disabled.shadowResult, null);
assert.equal(disabled.activation.canRun, false);

const store = createInMemoryShadowLogStore();
const a = observeDecisionRun({
  profile: strongProductProfile.profile,
  productionSnapshot: strongProductProfile.profile.career_snapshot,
  featureFlags: { ENABLE_SHADOW_REASONING: true, ENABLE_SHADOW_LOGGING: true, ENABLE_DRIFT_ANALYSIS: true, ENABLE_PROMOTION_GATE_EVALUATION: true },
  config: { deterministic: true },
  logStore: store,
  generatedAt: "2026-01-01T00:00:00.000Z",
});
const b = observeDecisionRun({
  profile: strongProductProfile.profile,
  productionSnapshot: strongProductProfile.profile.career_snapshot,
  featureFlags: { ENABLE_SHADOW_REASONING: true, ENABLE_SHADOW_LOGGING: true, ENABLE_DRIFT_ANALYSIS: true, ENABLE_PROMOTION_GATE_EVALUATION: true },
  config: { deterministic: true },
  logStore: store,
  generatedAt: "2026-01-01T00:00:00.000Z",
});

assert.equal(a.runId, b.runId);
assert.equal(a.activation.canInfluenceProduction, false);
assert.ok(a.shadowResult.reasoning.recommendations.length);
assert.equal(store.getByRunId(a.runId)?.runId, a.runId);

console.error("decisionObservatory tests: PASS");
