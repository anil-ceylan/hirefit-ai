import assert from "node:assert/strict";
import { evaluatePromotionGates } from "../index.js";

const result = evaluatePromotionGates({
  contracts: {},
  shadowResult: {
    guardrails: { violations: [], trace: { completenessScore: 1 } },
    reasoning: { recommendations: [{ decisionConfidence: 80, evidenceIds: ["ev_1"] }] },
  },
  drift: { items: [], severity: "none" },
  stability: { stabilityScore: 1 },
  realSampleCount: 0,
});

assert.equal(result.eligible, false);
assert.ok(result.blockers.some((item) => item.includes("real shadow")));
assert.equal(result.productionInfluenceAllowed, false);

console.error("promotionGateEvaluator tests: PASS");
