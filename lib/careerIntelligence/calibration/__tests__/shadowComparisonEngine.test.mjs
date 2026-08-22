import assert from "node:assert/strict";
import { compareProductionToShadow } from "../index.js";

const comparison = compareProductionToShadow({
  productionSnapshot: {
    topRoles: [{ label: "Strategy & Operations" }, { label: "Product Management" }],
    biggestGap: "Stakeholder Influence",
  },
  reasoning: {
    recommendations: [
      { label: "Product Management", evidenceIds: ["e1"], missingEvidenceIds: ["m1"] },
      { label: "Strategy & Operations" },
    ],
    missingEvidence: { primaryMissingEvidence: { competency: "stakeholder_influence", id: "m1" } },
    topRecommendation: { evidenceIds: ["e1"], missingEvidenceIds: ["m1"] },
  },
});

assert.equal(comparison.topRoleAgreement, false);
assert.ok(comparison.topThreeOverlap > 0);
assert.ok(comparison.divergences.some((item) => item.type === "TOP_ROLE_MISMATCH"));
assert.equal(comparison.summary.agreementLevel, "partial");

console.error("shadowComparisonEngine tests: PASS");
