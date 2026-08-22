import assert from "node:assert/strict";
import { validateExplanationTrace } from "../index.js";

const reasoning = {
  hypotheses: [{ competency: "ownership", evidenceIds: ["e1"] }],
  inferences: [{ competency: "ownership", evidenceIds: ["e1"] }],
  evidenceIntelligence: { evidenceObjects: [{ id: "e1", source: "portfolio", source_type: "portfolio" }] },
  missingEvidence: { missingEvidence: [] },
};

const complete = validateExplanationTrace({
  id: "rec",
  label: "Product",
  option: { requiredCompetencies: ["ownership"] },
}, reasoning);
assert.equal(complete.complete, true);

const missing = validateExplanationTrace({
  id: "rec",
  label: "Product",
  option: { requiredCompetencies: ["execution"] },
}, reasoning);
assert.equal(missing.complete, false);
assert.ok(missing.missingLinks.some((item) => item.includes("execution")));

console.error("explanationTraceValidator tests: PASS");
