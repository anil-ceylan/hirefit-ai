import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as model from "../lib/careerActionLoop/actionModel.js";
const clone = (v) => structuredClone(v);
let row = { user_id: "test", updated_at: "2026-09-08T00:00:00.000Z", career_gps: {} };
let holdNext = false;
let release;
let captured;
let capturedResolve;
const client = { from(table) {
  assert.equal(table, "career_profiles");
  let update;
  const filters = [];
  return {
    select() { return this; },
    update(value) { update = value; return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    is(key, value) { filters.push([key, value]); return this; },
    async maybeSingle() {
      if (!update) return { data: clone(row), error: null };
      if (holdNext) {
        holdNext = false;
        capturedResolve();
        await new Promise((resolve) => { release = resolve; });
      }
      if (!filters.every(([key, value]) => row[key] === value)) return { data: null, error: null };
      row = { ...row, ...clone(update) };
      return { data: clone(row), error: null };
    },
  };
} };
const source = readFileSync("lib/careerActionLoop/persistence.js", "utf8")
  .replace(/import[\s\S]*?from "[^\n]+";/g, "")
  .replace(/export /g, "");
const api = runInNewContext(source + ";({upsertRecommendedCareerAction,startCareerAction,completeCareerAction,getCurrentCareerAction,upsertCareerActionOutcome,getCareerActionOutcome})", {
  ...model, getServiceClient: () => client, console,
  Date: class extends Date { static now() { return Date.parse("2026-09-08T00:00:00.000Z"); } },
  calculateRealUserValidationAggregate: () => ({}),
  VALIDATION_SOURCE_KINDS: { REAL_BETA_USER: "test" },
  runEvidenceCandidateShadowLearning: () => null,
});
const input = { title: "Write a project example", week_key: model.getWeekKey() };
const created = await api.upsertRecommendedCareerAction("test", input);
const id = created.action.action_id;
await api.startCareerAction("test", id);
// Hold an actual persistence update after its read, complete using another read,
// then release the stale update. No timers or timing assumptions.
holdNext = true;
captured = new Promise((resolve) => { capturedResolve = resolve; });
const delayed = api.startCareerAction("test", id);
await captured;
const completed = await api.completeCareerAction("test", id);
assert.equal(completed.action.status, "completed");
release();
assert.equal((await delayed).storageUnavailable, true);
assert.equal((await api.getCurrentCareerAction("test")).action.status, "completed");
assert.equal((await api.startCareerAction("test", id)).action.status, "completed");
const again = await api.completeCareerAction("test", id);
assert.equal(again.action.completed_at, completed.action.completed_at);
await api.upsertRecommendedCareerAction("test", input);
assert.equal(model.normalizeDecisionLoop(row.career_gps).actions.length, 1);
const outcomeInput = { outcome_type: "completed", outcome_text: "I wrote a concrete project example." };
const outcome = await api.upsertCareerActionOutcome("test", id, outcomeInput);
assert.ok(outcome.outcome);
await api.upsertCareerActionOutcome("test", id, outcomeInput);
assert.equal(model.normalizeDecisionLoop(row.career_gps).outcomes.length, 1);
assert.equal((await api.getCareerActionOutcome("test", id)).outcome.outcome_id, outcome.outcome.outcome_id);
assert.equal((await api.getCurrentCareerAction("test")).action.status, "completed");
process.stdout.write("Weekly Action concurrency: stale delayed start rejected; completion durable, retry/idempotency, single action/outcome and reload passed.\n");
