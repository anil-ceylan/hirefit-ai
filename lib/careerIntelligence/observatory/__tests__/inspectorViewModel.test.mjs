import assert from "node:assert/strict";
import { observeDecisionRun, serializeInspectorReport } from "../index.js";
import { analyticsProfile } from "../fixtures/index.js";

const result = observeDecisionRun({
  profile: analyticsProfile.profile,
  productionSnapshot: analyticsProfile.profile.career_snapshot,
  featureFlags: { ENABLE_SHADOW_REASONING: true, ENABLE_INTERNAL_REASONING_INSPECTOR: true, ENABLE_DRIFT_ANALYSIS: true, ENABLE_PROMOTION_GATE_EVALUATION: true },
  generatedAt: "2026-01-01T00:00:00.000Z",
});

const text = serializeInspectorReport(result, { format: "text" });
assert.ok(text.includes("Decision Observatory Inspector"));
assert.ok(!text.includes("KPI dashboard and forecast model"));

console.error("inspectorViewModel tests: PASS");
