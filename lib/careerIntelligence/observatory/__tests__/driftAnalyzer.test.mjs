import assert from "node:assert/strict";
import { analyzeDecisionDrift } from "../index.js";

const noDrift = analyzeDecisionDrift({
  productionSnapshot: { topRoleMatches: [{ roleName: "Product Management" }], gapDetails: { title: "execution" } },
  shadowResult: {
    inputSummary: { evidenceCount: 1 },
    reasoning: {
      recommendations: [{ label: "Product Management", evidenceIds: ["ev_1"] }],
      missingEvidence: { primaryMissingEvidence: { competency: "execution" } },
    },
    guardrails: { violations: [], trace: { complete: true } },
    productionComparison: { topRoleAgreement: true, topThreeOverlap: 1, biggestGapAgreement: true, rankingCorrelation: 1 },
  },
});
assert.ok(noDrift.typeCodes.includes("NO_MEANINGFUL_DRIFT"));

const drift = analyzeDecisionDrift({
  productionSnapshot: { topRoleMatches: [{ roleName: "Strategy" }] },
  shadowResult: {
    inputSummary: { evidenceCount: 1 },
    reasoning: { recommendations: [{ label: "Product Management" }] },
    guardrails: { violations: [{ severity: "critical", code: "TRACE_INCOMPLETE" }], trace: { complete: false } },
    productionComparison: { topRoleAgreement: false, topThreeOverlap: 0, biggestGapAgreement: true },
  },
});
assert.ok(drift.typeCodes.includes("TOP_ROLE_MISMATCH"));
assert.ok(drift.typeCodes.includes("CRITICAL_GUARDRAIL_FAILURE"));
assert.equal(drift.severity, "critical");

console.error("driftAnalyzer tests: PASS");
