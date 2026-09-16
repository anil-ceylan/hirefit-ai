import assert from "node:assert/strict";
import { registerHooks } from "node:module";
const rows = new Map();
let readError = false;
let writes = 0;
const clone = (v) => v == null ? v : structuredClone(v);
const client = { auth: { getUser: async () => ({ data: { user: { id: "account-a" } }, error: null }) }, from(table) {
  assert.equal(table, "career_profiles");
  let id;
  let value;
  return {
    select() { return this; },
    eq(key, v) { assert.equal(key, "user_id"); id = v; return this; },
    upsert(v, options) { assert.equal(options.onConflict, "user_id"); value = v; id = v.user_id; return this; },
    async maybeSingle() { return { data: readError ? null : clone(rows.get(id)), error: readError ? { code: "synthetic" } : null }; },
    async single() { writes += 1; rows.set(id, { ...rows.get(id), ...clone(value) }); return { data: clone(rows.get(id)), error: null }; },
  };
} };
const key = "__returningProfileTestClient";
globalThis[key] = client;
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const names = ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const env = names.map((n) => process.env[n]);
process.env.VITE_SUPABASE_URL = "https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic";
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === "@supabase/supabase-js") return { url: `data:text/javascript,${encodeURIComponent(`export const createClient = () => globalThis.${key};`)}`, shortCircuit: true };
  return next(specifier, context);
} });
try {
  const { completeOnboarding, loadFullCareerProfile, upsertOnboardingDraft } = await import("../lib/careerOnboarding/persistence.js");
  const { loadCareerProfile, saveCareerProfile } = await import("../lib/careerMemory/persistence.js");
  const { handleCareerApi } = await import("../lib/vercelApi/careerApiRouter.js");
  const { fetchCareerOnboarding, resolvePostLoginPath } = await import("../src/utils/careerOnboardingClient.js");
  const { saveLocalCareerProfile, loadLocalCareerProfile, fetchCareerProfileStatus } = await import("../src/utils/careerMemoryClient.js");
  const input = { basic: { fullName: "Fixture User", department: "Economics" }, goals: { industries: ["finance"], targetRoles: ["financial_analyst"] }, dnaAnswers: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`likert_${i + 1}`, 4])), readinessAnswers: {}, lang: "TR" };
  const result = await completeOnboarding("account-a", input);
  assert.equal(result.storageUnavailable, false);
  assert.equal(result.profile.onboarding_completed, true);
  for (const read of [loadFullCareerProfile, loadCareerProfile]) {
    const fresh = await read("account-a");
    assert.equal(fresh.user_id, "account-a");
    assert.equal(fresh.onboarding_completed, true);
    assert.equal(fresh.basic_profile.fullName, input.basic.fullName);
    assert.deepEqual(fresh.career_dna.answers, input.dnaAnswers);
    assert.equal(await read("new-account"), null);
  }
  const stored = JSON.stringify(rows.get("account-a"));
  const writeCount = writes;
  readError = true;
  await assert.rejects(loadFullCareerProfile("account-a"), /storage unavailable/);
  await assert.rejects(loadCareerProfile("account-a"), /storage unavailable/);
  await assert.rejects(upsertOnboardingDraft("account-a", { step: 1, draft: {} }), /storage unavailable/);
  await assert.rejects(saveCareerProfile("account-a", {}), /storage unavailable/);
  await assert.rejects(completeOnboarding("account-a", input), /storage unavailable/);
  assert.equal(writes, writeCount, "failed reads cannot overwrite completed profile or claim save success");
  assert.equal(JSON.stringify(rows.get("account-a")), stored);
  const oldAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const oldError = console.error;
  process.env.VITE_SUPABASE_ANON_KEY = "synthetic";
  console.error = () => {};
  try {
    for (const path of ["/api/career-profile", "/api/career-onboarding"]) {
      const req = { method: "GET", url: path, headers: { authorization: "Bearer synthetic" }, query: {} };
      const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
      await handleCareerApi(req, res, path);
      assert.equal(res.body.exists, null, "real route must distinguish failed read from absent row");
      assert.equal(res.body.profileFetchFailed, true);
      assert.equal(res.body.profile, null);
    }
  } finally {
    console.error = oldError;
    if (oldAnonKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY; else process.env.VITE_SUPABASE_ANON_KEY = oldAnonKey;
  }
  readError = false;
  let response;
  globalThis.fetch = async () => {
    if (response instanceof Error) throw response;
    return { ok: response.status === 200, status: response.status, json: async () => response.body };
  };
  for (const context of ["hard-refresh", "logout-login", "fresh-browser"]) {
    const storage = new Map();
    globalThis.localStorage = { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
    response = { status: 200, body: { success: true, exists: true, authenticated: true, profile: await loadFullCareerProfile("account-a"), onboarding_completed: true } };
    assert.equal((await fetchCareerOnboarding("", async () => ({}), "TR")).profile.onboarding_completed, true, context);
    assert.equal(await resolvePostLoginPath("", async () => ({})), "/dashboard");
    assert.equal((await fetchCareerProfileStatus("", async () => ({}), { allowLocalFallback: false })).profile.basic_profile.fullName, input.basic.fullName);
    saveLocalCareerProfile(response.body.profile);
    assert.equal(loadLocalCareerProfile("account-a").user_id, "account-a");
    assert.equal(loadLocalCareerProfile("account-b"), null);
    assert.equal(loadLocalCareerProfile(), null);
  }
  for (const failure of [{ status: 401, body: {} }, { status: 200, body: { exists: null, profileFetchFailed: true } }, new Error("Failed to fetch"), { status: 200, body: { exists: false, authenticated: false } }]) {
    response = failure;
    const data = await fetchCareerOnboarding("", async () => ({}), "TR");
    assert.equal(data.exists, null);
    assert.equal(data.profile, null);
    assert.equal(await resolvePostLoginPath("", async () => ({})), "/dashboard");
  }
  response = { status: 200, body: { exists: false, profile: null } };
  assert.equal(await resolvePostLoginPath("", async () => ({})), "/onboarding");
  assert.equal(JSON.stringify(rows.get("account-a")), stored);
  process.stdout.write("Returning profile: real save/read functions, completion fields, fail-closed writes, fresh browser/session fixtures, error routing and account-scoped cache passed.\n");
} finally {
  hooks.deregister();
  delete globalThis[key];
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
  names.forEach((name, i) => { if (env[i] === undefined) delete process.env[name]; else process.env[name] = env[i]; });
}
