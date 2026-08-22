import assert from "node:assert/strict";
import { toDecisionOptionContract, validateDecisionOptionContract } from "../index.js";

const option = toDecisionOptionContract({
  id: "pm",
  label: "Product Management",
  decisionConfidence: 77,
  option: { requiredCompetencies: ["ownership"] },
  evidenceIds: ["ev_1"],
}, 1);

assert.equal(option.schemaVersion, "decision-option.v1");
assert.equal(option.confidenceLevel, "high");
assert.equal(validateDecisionOptionContract(option).valid, true);
assert.equal(validateDecisionOptionContract({ ...option, title: "" }).valid, false);

console.error("decisionOptionSchema tests: PASS");
