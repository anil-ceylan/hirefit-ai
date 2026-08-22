import assert from "node:assert/strict";
import { adaptHireFitProfileToShadowInput } from "../index.js";

const adapted = adaptHireFitProfileToShadowInput({
  profile: {
    user_id: "user-1",
    projects: [{ title: "Built product", description: "Launched product for 100 users.", occurred_at: "2026" }],
    skills: ["Leadership"],
    basic_profile: { cvStatus: "analyzed", cvFileName: "cv.pdf" },
    career_snapshot: { topRoleMatches: [{ roleName: "Product Management" }], gapDetails: { title: "Stakeholder Influence" }, recruiterTrust: 55 },
    email: "private@example.com",
  },
});

assert.equal(adapted.userId, "user-1");
assert.ok(adapted.evidenceItems.length >= 2, "Adapter must extract evidence from current profile data.");
assert.ok(adapted.evidenceItems.every((item) => item.source && item.source_type), "Every evidence item needs source traceability.");
assert.ok(adapted.explicitClaims.some((item) => item.text === "Leadership"), "Self-claims must be separated.");
assert.equal(adapted.sourceCoverage.cv, true);
assert.ok(adapted.warnings.some((item) => item.code === "UNSUPPORTED_OR_PRIVATE_FIELD_IGNORED"), "Private/raw fields must be ignored with warning.");

const empty = adaptHireFitProfileToShadowInput({ profile: null });
assert.deepEqual(empty.evidenceItems, []);
assert.equal(empty.sourceCoverage.cv, false);

console.error("shadowInputAdapter tests: PASS");
