import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const sql = readFileSync(new URL('../supabase/migrations/20261008120000_opportunity_radar_location_v1.sql', import.meta.url), 'utf8');
const statements = sql.replace(/--[^\n]*/g, '');
assert.match(statements, /^\s*BEGIN;/);
assert.match(statements, /COMMIT;\s*$/);
assert.doesNotMatch(statements, /\b(?:DROP|TRUNCATE)\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+public\./i);
assert.equal((statements.match(/CREATE TABLE /g) || []).length, 2);
for (const table of ['opportunity_locations', 'opportunity_location_preferences']) {
  assert.ok(sql.includes(`to_regclass('public.${table}')`));
  assert.ok(sql.includes(`to_regtype('public.${table}')`));
  assert.ok(sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`));
  assert.ok(sql.includes(`BEFORE UPDATE ON public.${table}`));
}
assert.match(sql, /FROM PUBLIC, anon, authenticated/);
assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON .* TO service_role/);
assert.doesNotMatch(statements, /CREATE POLICY|GRANT .* TO authenticated/);
assert.match(sql, /REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
assert.match(sql, /REFERENCES public\.opportunities\(id\) ON DELETE CASCADE/);
assert.match(sql, /PRIMARY KEY \(opportunity_id, location_key\)/);
assert.match(sql, /uncertainty_km < 'Infinity'::numeric/);
assert.doesNotMatch(statements, /employer_source_point|type\s*=\s*'job'/);
assert.match(statements, /ALTER TABLE public\.opportunities ADD COLUMN location_set_complete boolean NOT NULL DEFAULT false/);
assert.doesNotMatch(statements, /country_code IS NOT NULL/);
assert.equal((statements.match(/place_id IS NOT NULL AND city IS NOT NULL/g) || []).length, 3);
process.stdout.write('PASS: additive migration structural checks, transaction/conflict guards, ownership, neutral evidence, default-deny RLS/grants.\n');

let PGlite;
try { ({ PGlite } = createRequire(import.meta.url)(process.env.HIREFIT_PGLITE_MODULE || '@electric-sql/pglite')); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  process.stdout.write('UNAVAILABLE: isolated PostgreSQL execution (@electric-sql/pglite missing); structural checks are not database acceptance.\n');
  process.exit(0);
}
// Only an ephemeral in-memory engine. No Supabase client, URL, key or network.
const db = new PGlite();
const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const oid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`);
  const base = readFileSync(new URL('../supabase/migrations/20260925120000_opportunity_radar.sql', import.meta.url), 'utf8');
  await db.exec(base);
  await db.exec(`INSERT INTO auth.users VALUES ('${uid}');
    INSERT INTO public.opportunities(id,type,subtype,title,source,source_type,source_item_id,url)
    VALUES ('${oid}','event','program','Existing','fixture','fixture','one','https://example.invalid/one');`);
  await db.exec(sql);
  assert.equal((await db.query('SELECT location_set_complete FROM opportunities')).rows[0].location_set_complete, false);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM opportunities')).rows[0].n, 1);
  await db.exec(`INSERT INTO opportunity_location_preferences(user_id,source,place_id,country_code,city,location_precision,radius_km,consent_version)
    VALUES ('${uid}','manual','hf:place:0002',NULL,'Lefkoşa','city_only',25,'v1');
    INSERT INTO opportunity_locations(opportunity_id,location_key,country_code,city,place_id,location_precision,evidence_kind,evidence_reference,normalization_version,verified_at)
    VALUES ('${oid}','place-0002',NULL,'Lefkoşa','hf:place:0002','city_only','reviewed_city_mapping','pilot-city-only-v2','v1',now());`);
  await db.exec('UPDATE opportunity_location_preferences SET enabled=true');
  assert.equal((await db.query('SELECT country_code FROM opportunity_location_preferences')).rows[0].country_code, null);
  assert.equal((await db.query('SELECT country_code FROM opportunity_locations')).rows[0].country_code, null);
  for (const statement of [
    'UPDATE opportunity_location_preferences SET radius_km=11',
    'UPDATE opportunity_location_preferences SET place_id=NULL',
    'UPDATE opportunity_location_preferences SET city=NULL',
    "UPDATE opportunity_location_preferences SET country_code='invalid'",
    'UPDATE opportunity_locations SET place_id=NULL',
    'UPDATE opportunity_locations SET city=NULL',
    "UPDATE opportunity_location_preferences SET uncertainty_km='NaN'",
    "UPDATE opportunity_location_preferences SET uncertainty_km='Infinity'",
    'UPDATE opportunity_location_preferences SET approximate_latitude=0',
    "UPDATE opportunity_location_preferences SET source='browser'",
    'UPDATE opportunity_locations SET latitude=91,longitude=0',
    "UPDATE opportunity_locations SET evidence_kind='source_point'",
  ]) await assert.rejects(db.exec(statement));
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    for (const table of ['opportunity_locations', 'opportunity_location_preferences']) {
      await assert.rejects(db.exec(`SELECT * FROM ${table}`));
      await assert.rejects(db.exec(`DELETE FROM ${table}`));
    }
    await db.exec('RESET ROLE');
  }
  const rls = await db.query("SELECT relrowsecurity FROM pg_class WHERE relname IN ('opportunity_locations','opportunity_location_preferences')");
  assert.ok(rls.rows.every(row => row.relrowsecurity));
  await assert.rejects(db.exec(sql)); await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM opportunity_locations')).rows[0].n, 1);
  await db.exec(`DELETE FROM auth.users WHERE id='${uid}'`);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM opportunity_location_preferences')).rows[0].n, 0);
  await db.exec(`DELETE FROM opportunities WHERE id='${oid}'`);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM opportunity_locations')).rows[0].n, 0);
  process.stdout.write('PASS: isolated PostgreSQL migration, constraints, access denial, RLS, conflict rollback, existing catalog preservation and cascades.\n');
} finally { await db.close(); }
