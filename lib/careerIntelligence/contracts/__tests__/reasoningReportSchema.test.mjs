import assert from "node:assert/strict";
import { runShadowReasoning } from "../../calibration/index.js";
import { toReasoningReportContract, validateReasoningReportContract } from "../index.js";

const shadowResult = runShadowReasoning({
  profile: {
    projects: [{ title: "Built product", description: "Founder launched product for 500 users.", occurred_at: "2026" }],
    career_snapshot: { topRoleMatches: [{ roleName: "Product Management" }] },
  },
});
const report = toReasoningReportContract({ shadowResult, generatedAt: "2026-01-01T00:00:00.000Z" });

assert.equal(report.schemaVersion, "reasoning-report.v1");
assert.ok(Array.isArray(report.decisionOptions));
assert.equal(validateReasoningReportContract(report).valid, true);

console.error("reasoningReportSchema tests: PASS");
