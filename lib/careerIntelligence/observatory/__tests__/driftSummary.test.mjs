import assert from "node:assert/strict";
import { summarizeDecisionDrift } from "../index.js";

const summary = summarizeDecisionDrift([
  { drift: { severity: "low", typeCodes: ["NO_MEANINGFUL_DRIFT"] }, shadowResult: { productionComparison: { topRoleAgreement: true, topThreeOverlap: 1, biggestGapAgreement: true }, guardrails: { trace: { completenessScore: 1 }, violations: [] } } },
  { drift: { severity: "medium", typeCodes: ["TOP_ROLE_MISMATCH"], requiresReview: true }, shadowResult: { productionComparison: { topRoleAgreement: false, topThreeOverlap: 0.33, biggestGapAgreement: false }, guardrails: { trace: { completenessScore: 0.9 }, violations: [{}] } } },
]);

assert.equal(summary.totalRuns.value, 2);
assert.equal(summary.topRoleAgreementRate.status, "insufficient_sample");

console.error("driftSummary tests: PASS");
