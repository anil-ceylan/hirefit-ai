import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync("src/components/dashboard/WeeklyDecisionCenter.jsx", "utf8");
const code = source.slice(source.indexOf("  const handleActionButton = async"), source.indexOf("  const heroCompleteLabel"));
assert.match(source, /\{actionSaveError \? \([\s\S]*?role="alert"[\s\S]*?\{actionSaveError\}[\s\S]*?onClick=\{handleActionButton\}/);
for (const status of ["recommended", "started"]) {
  for (const failure of ["storage", "non-success", "network"]) {
    let fail = true;
    const writes = [];
    const c = {
      tr: true, lang: "TR", decision: { profileComplete: true }, user: { id: "test" },
      completed: false, actionBusy: false, actionStatus: status,
      durableAction: { action_id: "stable", status }, getApiAuthHeaders: () => ({}),
      setActionBusy: (v) => { c.actionBusy = v; },
      setActionSaveError: (v) => { c.error = v; },
      setDurableAction: (v) => { c.durableAction = v; },
      persistLocalAction: (v) => writes.push(v), trackActivationEvent: () => {},
    };
    const save = async ({ actionId }) => {
      assert.equal(actionId, "stable");
      if (fail && failure === "network") throw new Error("synthetic network failure");
      if (fail) return failure === "storage" ? { storageUnavailable: true } : { success: false, action: { status: "completed" } };
      return { success: true, action: { action_id: actionId, status: status === "started" ? "completed" : "started" } };
    };
    c.startCareerAction = save;
    c.completeCareerAction = save;
    const click = runInNewContext(code + ";handleActionButton", c);
    await click();
    assert.equal(c.durableAction.status, status);
    assert.equal(writes.length, 0);
    assert.ok(c.error.includes("tekrar dene"));
    assert.equal(c.actionBusy, false);
    fail = false;
    await click();
    assert.equal(c.error, "");
    assert.equal(c.durableAction.status, status === "started" ? "completed" : "started");
    assert.deepEqual(writes, status === "started" ? ["completed"] : []);
  }
}
process.stdout.write("Weekly Action failures: storage/non-success/network preserve status, show retry error and retry successfully without fake completion.\n");
