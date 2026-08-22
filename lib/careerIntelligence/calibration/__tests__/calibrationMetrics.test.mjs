import assert from "node:assert/strict";
import { calculateCalibrationMetrics } from "../index.js";

const metrics = calculateCalibrationMetrics([
  {
    id: "case-1",
    expected: {
      topRoleIncludes: ["Product"],
      expectedStrongCompetencies: ["ownership"],
      expectedMissingEvidence: ["stakeholder"],
      expectedConflicts: ["strong_claim_without_support"],
    },
    reasoning: {
      recommendations: [{ label: "Product Management", decisionConfidence: 75 }],
      hypotheses: [{ competency: "ownership", confidence: 80, evidenceIds: ["e1"] }],
      missingEvidence: { missingEvidence: [{ competency: "stakeholder_influence", reason: "stakeholder missing" }] },
      conflicts: { conflicts: [{ id: "strong_claim_without_support", evidenceId: "e2" }] },
      evidenceIntelligence: { evidenceObjects: [{ id: "e1", source: "cv", source_type: "cv" }] },
    },
    productionComparison: { topRoleAgreement: true, topThreeOverlap: 1 },
    guardrails: { violations: [], trace: { completenessScore: 1 } },
  },
]);

assert.equal(metrics.summary.passed, 1);
assert.equal(metrics.roleRankingAccuracy.status, "observed");
assert.equal(metrics.hallucinationRate.value, 0);
assert.equal(metrics.evidenceSourceTraceability.value, 1);
assert.equal(metrics.classificationAccuracy.status, "not_measurable");

console.error("calibrationMetrics tests: PASS");
