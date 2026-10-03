import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { opportunityFixtures } from "./fixtures/opportunity-radar.mjs";
import { createOpportunityRepository, OPPORTUNITY_COLUMNS } from "../lib/opportunityRadar/persistence.js";

// Real, isolated PostgreSQL engine, not a production Supabase connection.
// Install outside the repo and set HIREFIT_PGLITE_MODULE if not available locally.
const { PGlite } = createRequire(import.meta.url)(process.env.HIREFIT_PGLITE_MODULE || "@electric-sql/pglite");
const migration = readFileSync(new URL("../supabase/migrations/20260925120000_opportunity_radar.sql", import.meta.url), "utf8");
const db = new PGlite();
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const queries = [];

// Translate the small PostgREST surface used by the real persistence helper into
// parameterized SQL. Grants, RLS, constraints, triggers and upserts run in PG.
function postgresClient() {
  return { from(table) {
    assert.ok(["opportunities", "opportunity_user_states"].includes(table));
    const filters = [];
    const orders = [];
    let fields = "*", row = null, conflict = null, limit = null;
    const identifier = value => { assert.match(value, /^[a-z_]+$/); return value; };
    const query = {
      select(value) { fields = value.split(",").map(identifier).join(","); return this; },
      eq(key, value) { filters.push([identifier(key), "=", value]); return this; },
      lte(key, value) { filters.push([identifier(key), "<=", value]); return this; },
      gt(key, value) { filters.push([identifier(key), ">", value]); return this; },
      in(key, value) { filters.push([identifier(key), "ANY", value]); return this; },
      or(value) { const match = value.match(/^(\w+)\.is\.null,\1\.gt\.(.+)$/); assert.ok(match); filters.push([identifier(match[1]), "NULL_OR_GT", match[2]]); return this; },
      order(key, { ascending }) { orders.push(`${identifier(key)} ${ascending ? "ASC" : "DESC"}`); return this; },
      limit(value) { assert.ok(Number.isInteger(value)); limit = value; return this; },
      upsert(value, options) { row = value; conflict = options.onConflict.split(",").map(identifier).join(","); return this; },
      async execute(single = false) {
        const values = [];
        const param = value => { values.push(value); return `$${values.length}`; };
        let sql;
        if (row) {
          const keys = Object.keys(row).map(identifier);
          sql = `INSERT INTO public.${table} (${keys.join(",")}) VALUES (${keys.map(key => param(row[key])).join(",")}) ON CONFLICT (${conflict}) DO UPDATE SET ${keys.map(key => `${key}=EXCLUDED.${key}`).join(",")} RETURNING ${fields}`;
        } else {
          const conditions = filters.map(([key, op, value]) => op === "ANY" ? `${key}=ANY(${param(value)})` : op === "NULL_OR_GT" ? `(${key} IS NULL OR ${key}>${param(value)})` : `${key}${op}${param(value)}`);
          sql = `SELECT ${fields} FROM public.${table}${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""}${orders.length ? ` ORDER BY ${orders.join(",")}` : ""}${limit !== null ? ` LIMIT ${limit}` : ""}`;
        }
        queries.push({ table, row, filters });
        try { const result = await db.query(sql, values); return { data: single ? result.rows[0] || null : result.rows, error: null }; }
        catch (error) { return { data: null, error }; }
      },
      maybeSingle() { return this.execute(true); }, single() { return this.execute(true); },
      then(resolve, reject) { return this.execute().then(resolve, reject); },
    };
    return query;
  } };
}

async function insertOpportunity(row) {
  const keys = Object.keys(row);
  return db.query(`INSERT INTO public.opportunities (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, keys.map(key => ["requirements", "eligibility"].includes(key) ? JSON.stringify(row[key]) : row[key]));
}

try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
    INSERT INTO auth.users VALUES ('${userA}'), ('${userB}');
    CREATE TABLE public.unrelated_sentinel (value text); INSERT INTO public.unrelated_sentinel VALUES ('unchanged');`);
  await db.exec(migration);
  const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities'");
  assert.deepEqual(new Set(columns.rows.map(row => row.column_name)), new Set(OPPORTUNITY_COLUMNS.split(",")));
  const types = Object.fromEntries((await db.query("SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities'")).rows.map(row => [row.column_name, row.udt_name]));
  for (const [field, type] of Object.entries({ id: "uuid", type: "text", role_tags: "_text", skill_tags: "_text", sector_tags: "_text", requirements: "jsonb", eligibility: "jsonb", active: "bool", published: "bool", deadline_at: "timestamptz", starts_at: "timestamptz", ends_at: "timestamptz", expires_at: "timestamptz", last_verified_at: "timestamptz", created_at: "timestamptz", updated_at: "timestamptz" })) assert.equal(types[field], type, field);
  const secured = await db.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('opportunities','opportunity_user_states')");
  assert.equal(secured.rows.length, 2);
  assert.ok(secured.rows.every(row => row.relrowsecurity));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE tablename IN ('opportunities','opportunity_user_states')")).rows[0].n, 2);
  const indexes = (await db.query("SELECT indexname FROM pg_indexes WHERE tablename IN ('opportunities','opportunity_user_states')")).rows.map(row => row.indexname);
  for (const name of ["opportunities_source_item_unique", "opportunities_url_unique", "opportunities_visible_jobs_idx", "opportunities_expiry_idx", "opportunity_user_states_pk", "opportunity_user_states_user_state_idx", "opportunity_user_states_opportunity_idx"]) assert.ok(indexes.includes(name), name);
  for (const fixture of opportunityFixtures) await insertOpportunity(fixture);
  await assert.rejects(db.query("UPDATE opportunities SET published=true WHERE source_type='fixture'"), /opportunities_fixture_not_published/);
  await assert.rejects(db.query("UPDATE opportunities SET verification_status='verified', last_verified_at=now(), expires_at=now()+interval '1 day' WHERE source_type='fixture'"), /opportunities_verified_provenance/);

  const now = new Date();
  const job = { ...opportunityFixtures[0], id: "33333333-3333-4333-8333-333333333333", source: "unit-test-employer", source_type: "employer", source_item_id: "verified-test",
    url: "https://employer.invalid/jobs/verified-test", active: true, published: true, verification_status: "verified",
    last_verified_at: new Date(now.getTime() - 3600000).toISOString(), expires_at: new Date(now.getTime() + 86400000).toISOString() };
  await insertOpportunity(job);
  await assert.rejects(insertOpportunity({ ...job, id: "44444444-4444-4444-8444-444444444444", url: "https://employer.invalid/other" }), /opportunities_source_item_unique/);
  await assert.rejects(insertOpportunity({ ...job, id: "44444444-4444-4444-8444-444444444444", source_item_id: "other" }), /opportunities_url_unique/);
  const exclusions = [
    { active: false }, { published: false }, { verification_status: "unverified" }, { type: "person" }, { type: "event" },
    { expires_at: new Date(now.getTime() - 1).toISOString() }, { deadline_at: now.toISOString() }, { ends_at: now.toISOString() },
  ];
  for (const [i, patch] of exclusions.entries()) await insertOpportunity({ ...job, ...patch, id: `55555555-5555-4555-8555-${String(i).padStart(12, "0")}`, source_item_id: `excluded-${i}`, url: `https://employer.invalid/jobs/excluded-${i}` });

  await db.exec("SET ROLE service_role");
  const repository = createOpportunityRepository(postgresClient);
  const catalog = await repository.list(userA, now);
  assert.deepEqual(catalog.opportunities.map(row => row.id), [job.id]);
  assert.equal(catalog.truncated, false);
  for (const state of ["saved", "dismissed", "acted_on"]) {
    const first = await repository.setState(userA, job.id, state, now);
    const again = await repository.setState(userA, job.id, state, now);
    assert.deepEqual(first, again, "Repeated upsert must also preserve updated_at");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM opportunity_user_states")).rows[0].n, 1);
  }
  await repository.setState(userB, job.id, "saved", now);
  const concurrent = await Promise.all(Array.from({ length: 3 }, () => repository.setState(userB, job.id, "saved", now)));
  assert.ok(concurrent.every(row => JSON.stringify(row) === JSON.stringify(concurrent[0])), "Concurrent identical updates are duplicate-safe");
  assert.equal((await repository.states(userA, [job.id]))[0].state, "acted_on");
  assert.equal((await repository.states(userB, [job.id]))[0].state, "saved");
  for (const id of [opportunityFixtures[0].id, "99999999-9999-4999-8999-999999999999", ...exclusions.map((_, i) => `55555555-5555-4555-8555-${String(i).padStart(12, "0")}`)]) {
    await assert.rejects(repository.setState(userA, id, "saved", now), error => error.code === "OPPORTUNITY_NOT_FOUND");
  }
  assert.equal((await db.query("SELECT count(*)::int AS n FROM opportunity_user_states")).rows[0].n, 2, "Rejected writes must not leave partial state");
  await assert.rejects(repository.list(null, now), error => error.code === "AUTH_REQUIRED");
  await assert.rejects(repository.setState(userA, job.id, "invalid", now), error => error.code === "INVALID_STATE_INPUT");
  for (const query of queries.filter(q => q.table === "opportunity_user_states")) {
    if (query.row) assert.deepEqual(Object.keys(query.row).sort(), ["opportunity_id", "state", "user_id"]);
    else assert.ok(query.filters.some(([key, operator, value]) => key === "user_id" && operator === "=" && [userA, userB].includes(value)));
  }

  await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub='${userA}'`);
  assert.deepEqual((await db.query("SELECT id FROM opportunities")).rows.map(row => row.id), [job.id], "RLS hides expired/unverified/fixture/future types");
  assert.deepEqual((await db.query("SELECT user_id, state FROM opportunity_user_states")).rows, [{ user_id: userA, state: "acted_on" }]);
  await assert.rejects(db.query("UPDATE opportunity_user_states SET state='saved'"), /permission denied/);
  await assert.rejects(db.query("INSERT INTO opportunity_user_states(user_id,opportunity_id,state) VALUES ($1,$2,'saved')", [userB, job.id]), /permission denied/);
  await assert.rejects(db.query("UPDATE opportunities SET active=false"), /permission denied/);
  await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub='${userB}'`);
  assert.deepEqual((await db.query("SELECT user_id, state FROM opportunity_user_states")).rows, [{ user_id: userB, state: "saved" }]);
  await db.exec("RESET ROLE; SET ROLE anon");
  await assert.rejects(db.query("SELECT * FROM opportunities"), /permission denied/);
  await db.exec("RESET ROLE");
  await assert.rejects(db.query("DELETE FROM opportunities WHERE id=$1", [job.id]), /foreign key/);
  await db.query("DELETE FROM auth.users WHERE id=$1", [userB]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM opportunity_user_states")).rows[0].n, 1, "Account removal cascades only that user's state");
  await assert.rejects(db.exec(migration), /already exist; review schema/);
  await db.exec("ROLLBACK");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM opportunity_user_states")).rows[0].n, 1);
  assert.deepEqual((await db.query("SELECT * FROM unrelated_sentinel")).rows, [{ value: "unchanged" }]);
  process.stdout.write("Opportunity Radar PostgreSQL: migration, columns, constraints, indexes, fixture isolation, real persistence filters/upserts, stable timestamps, RLS/grants, ownership, FK/delete behavior and non-destructive rerun refusal passed.\n");
} finally { await db.close(); }

const conflictDb = new PGlite();
try {
  await conflictDb.exec("CREATE TABLE public.opportunities (sentinel text); INSERT INTO public.opportunities VALUES ('preserve incompatible existing data')");
  await assert.rejects(conflictDb.exec(migration), /already exist; review schema/);
  await conflictDb.exec("ROLLBACK");
  assert.deepEqual((await conflictDb.query("SELECT * FROM opportunities")).rows, [{ sentinel: "preserve incompatible existing data" }]);
  assert.equal((await conflictDb.query("SELECT to_regclass('public.opportunity_user_states') AS relation")).rows[0].relation, null);
  process.stdout.write("Conflicting existing schema: migration refused atomically, sentinel data preserved, no partial second table created.\n");
} finally { await conflictDb.close(); }
