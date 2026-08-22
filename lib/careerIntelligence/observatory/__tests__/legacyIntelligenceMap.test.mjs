import assert from "node:assert/strict";
import { getLegacyIntelligenceMap } from "../index.js";

const map = getLegacyIntelligenceMap();
assert.ok(map.length >= 6);
assert.equal(map.some((item) => item.equivalent), false);
assert.ok(map.some((item) => item.legacyConcept === "Recruiter Trust"));

console.error("legacyIntelligenceMap tests: PASS");
