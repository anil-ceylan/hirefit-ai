import assert from "node:assert/strict";
import fs from "node:fs";

const persistence = fs.readFileSync(new URL("../lib/careerCompanion/persistence.js", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20260916100000_career_companion.sql", import.meta.url), "utf8");

assert.match(persistence, /select\("id, user_id"\).*eq\("id", value\.id\)/s);
assert.match(persistence, /if \(!existing \|\| existing\.user_id !== userId\) throw ownershipError/);
assert.match(persistence, /\.update\(updates\)\.eq\("id", value\.id\)\.eq\("user_id", userId\)/);
assert.match(persistence, /value\[field\] !== null && value\[field\] !== undefined/);
assert.match(persistence, /select\("id, user_id"\).*eq\("id", caseId\)\.eq\("user_id", userId\)/s);
assert.match(persistence, /if \(!ownedCase\) throw ownershipError/);
assert.match(persistence, /onConflict: "case_id"/);
assert.match(migration, /career_companion_cases_id_user_unique UNIQUE \(id, user_id\)/);
assert.match(migration, /career_companion_outcomes_case_user_fk[\s\S]*FOREIGN KEY \(case_id, user_id\)[\s\S]*REFERENCES public\.career_companion_cases\(id, user_id\)[\s\S]*ON DELETE CASCADE/);
assert.match(migration, /EXCEPTION WHEN duplicate_object THEN NULL/);
assert.equal(/\b(DROP|TRUNCATE|DELETE FROM)\b/i.test(migration), false);
process.stdout.write("Career Companion ownership and migration hardening validation passed.\n");
