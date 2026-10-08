import assert from "node:assert/strict";

// In-memory PostgREST surface. Every operation must carry the owner filter;
// even service-role upsert must inject the same owner into its conflict row.
export function locationDatabaseFixture() {
  const rows = new Map(), calls = [];
  const fixture = { rows, calls, fail: null, thrown: false };
  fixture.client = { from(table) {
    assert.equal(table, "opportunity_location_preferences");
    let operation = "get", columns, row, owner;
    const query = {
      select(value) { columns = value; return this; },
      eq(key, value) { assert.equal(key, "user_id"); assert.equal(owner, undefined); owner = value; return this; },
      upsert(value, options) { assert.deepEqual(options, { onConflict: "user_id" }); operation = "upsert"; row = value; return this; },
      update(value) { assert.deepEqual(Object.keys(value), ["enabled"]); operation = "setEnabled"; row = value; return this; },
      delete() { operation = "remove"; return this; },
      async execute() {
        assert.ok(owner, "Every query must be owner-filtered");
        if (operation === "upsert") assert.equal(row.user_id, owner);
        calls.push({ operation, owner, row: row ? structuredClone(row) : null, columns });
        if (fixture.fail === operation) {
          if (fixture.thrown) throw new Error("private SQL details");
          return { data: null, error: { message: "private SQL details" } };
        }
        if (operation === "upsert") rows.set(owner, structuredClone(row));
        if (operation === "setEnabled" && rows.has(owner)) rows.set(owner, { ...rows.get(owner), ...row });
        if (operation === "remove") { rows.delete(owner); return { data: null, error: null }; }
        const stored = rows.get(owner);
        return { data: stored ? Object.fromEntries(columns.split(",").map(key => [key, stored[key]])) : null, error: null };
      },
      maybeSingle() { return this.execute(); }, single() { return this.execute(); },
      then(resolve, reject) { return this.execute().then(resolve, reject); },
    };
    return query;
  } };
  return fixture;
}
