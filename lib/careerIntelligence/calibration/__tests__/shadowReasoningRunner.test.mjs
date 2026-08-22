import assert from "node:assert/strict";
import { runShadowReasoning } from "../index.js";

const profile = {
  projects: [{ title: "Built product", description: "Founder and owner. Launched product for 500 users.", occurred_at: "2026", metrics: ["500 users"] }],
  career_snapshot: {
    topRoleMatches: [{ roleName: "Product Management" }, { roleName: "Strategy & Operations" }],
    gapDetails: { title: "Stakeholder Influence" },
    recruiterTrust: 66,
    careerReadiness: 70,
  },
};

const a = runShadowReasoning({ profile, productionSnapshot: profile.career_snapshot });
const b = runShadowReasoning({ profile, productionSnapshot: profile.career_snapshot });

assert.equal(a.inputSummary.evidenceCount, b.inputSummary.evidenceCount);
assert.deepEqual(
  a.reasoning.recommendations.map((item) => [item.label, item.decisionConfidence]),
  b.reasoning.recommendations.map((item) => [item.label, item.decisionConfidence]),
  "Runner must be deterministic for same input."
);
assert.equal(a.reasoning.mode, "shadow");
assert.ok(a.productionComparison.summary);
assert.ok(a.calibration.summary.total === 1);
assert.ok(a.debugTrace);

console.error("shadowReasoningRunner tests: PASS");
