import assert from "node:assert/strict";
import { observeDecisionRun, validateShadowPrivacy } from "../index.js";
import { strongProductProfile } from "../fixtures/index.js";

const result = observeDecisionRun({
  profile: strongProductProfile.profile,
  productionSnapshot: strongProductProfile.profile.career_snapshot,
  featureFlags: { ENABLE_SHADOW_REASONING: true, ENABLE_SHADOW_LOGGING: false, ENABLE_DRIFT_ANALYSIS: true, ENABLE_PROMOTION_GATE_EVALUATION: true },
  generatedAt: "2026-01-01T00:00:00.000Z",
});

assert.equal(result.shadowSummary.schemaVersion, "shadow-summary.v1");
assert.equal(result.shadowSummary.quality.evidenceCount > 0, true);
assert.equal(validateShadowPrivacy(result.shadowSummary).passed, true);

console.error("buildShadowSummary tests: PASS");
