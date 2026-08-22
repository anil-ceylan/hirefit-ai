import assert from "node:assert/strict";
import { evaluateReasoningSensitivity, goldenPersonas } from "../index.js";

const persona = goldenPersonas.find((item) => item.id === "persona_product_ownership_01");
const sensitivity = evaluateReasoningSensitivity({
  profile: persona.input,
  productionSnapshot: persona.input.career_snapshot,
});

assert.ok(sensitivity.stakeholderIncrease > 0, "Adding quantified stakeholder evidence should increase stakeholder confidence.");
assert.ok(Math.abs(sensitivity.duplicateDecisionConfidenceDelta) <= 12, "Duplicate evidence should not materially inflate confidence.");
assert.ok(sensitivity.productRemovalDelta <= 0, "Removing product ownership evidence should not improve product confidence.");
assert.ok(Math.abs(sensitivity.certificateDecisionConfidenceDelta) <= 12, "Irrelevant certificate should not materially change ranking confidence.");

console.error("sensitivityAnalysis tests: PASS");
