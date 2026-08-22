import assert from "node:assert/strict";
import { evaluateRankingStability } from "../index.js";

const profile = {
  projects: [{ title: "Product launch", description: "Founder and owner. Built and launched product for 400 users.", occurred_at: "2026", metrics: ["400 users"] }],
  career_snapshot: { topRoleMatches: [{ roleName: "Product Management" }, { roleName: "Strategy & Operations" }] },
};

const stability = evaluateRankingStability({ profile, productionSnapshot: profile.career_snapshot });
assert.ok(Number.isFinite(stability.stabilityScore));
assert.equal(stability.variants.length, 4);
assert.ok(stability.variants.some((item) => item.type === "duplicate_description"));

console.error("rankingStability tests: PASS");
