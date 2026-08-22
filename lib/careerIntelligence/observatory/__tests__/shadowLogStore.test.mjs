import assert from "node:assert/strict";
import { createInMemoryShadowLogStore } from "../index.js";

const store = createInMemoryShadowLogStore();
assert.equal(store.save({ runId: "safe", generatedAt: "now", drift: {}, quality: {} }).saved, true);
assert.equal(store.getByRunId("safe").runId, "safe");
assert.equal(store.save({ runId: "bad", email: "person@example.com" }).saved, false);
assert.equal(store.list().length, 1);
store.clear();
assert.equal(store.list().length, 0);

console.error("shadowLogStore tests: PASS");
