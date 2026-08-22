import assert from "node:assert/strict";
import { toEvidenceContract, validateEvidenceContract } from "../index.js";

const item = toEvidenceContract({
  id: "ev_1",
  type: "project",
  title: "Project summary",
  source: "projects",
  source_type: "career_dna",
  competencies: ["execution"],
  metadata: { explicitClaim: false },
});

assert.equal(item.schemaVersion, "evidence.v1");
assert.equal(validateEvidenceContract(item).valid, true);
assert.equal(validateEvidenceContract({ ...item, id: "" }).valid, false);

console.error("evidenceSchema tests: PASS");
