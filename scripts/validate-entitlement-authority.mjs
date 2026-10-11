import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createEntitlementAuthority, setTrustedPlan } from "../lib/entitlements/authority.js";
import { transitionOnboarding } from "../lib/entitlements/onboardingLifecycle.js";
import { handleCareerApi } from "../lib/vercelApi/careerApiRouter.js";
import { normalizeVercelApiPath } from "../api/[...route].js";
import { ledger, USER_A as A, USER_B as B, WINDOW_MS, LEASE_MS } from "./fixtures/entitlement-ledger.mjs";

const input = { cvText: "CV", jobDescription: "JD" };
const key = "11111111-1111-4111-8111-111111111111";
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const req = (id = A, requestKey) => ({ headers: { authorization: id, ...(requestKey ? { "idempotency-key": requestKey } : {}) } });
function fixture(options = {}) {
  const model = ledger(options), engineInputs = [];
  const deps = {
    verify: async r => [A,B].includes(r?.headers?.authorization)
      ? { ok: true, user: { id: r.headers.authorization, email: "user@example.invalid", email_confirmed_at: "2026-01-01" } }
      : { ok: false, status: 401 },
    getClient: () => model.client, loadMemory: async id => ({ owner: id, serverMemory: true }),
    adminEmail: () => "", timeoutMs: options.timeoutMs || 1000,
    analyze: async value => { engineInputs.push(value); return options.analyze ? options.analyze(value) : { Output: { tier: value.isPro ? "pro" : "free" } }; },
  };
  return { ...model, deps, engineInputs, authority: createEntitlementAuthority(deps), row: () => model.accounts.get(A) };
}

let f = fixture();
let response = await f.authority.run(req(), { ...input, isPro: true, plan: "pro", user_id: B, analysis_count: 0, onboarding: true, careerMemory: { fake: true } });
assert.equal(response.status, 200); assert.equal(response.body.Output.tier, "free");
assert.deepEqual(f.engineInputs[0].careerMemory, { owner: A, serverMemory: true });
assert.equal(f.row().count, 1); assert.equal(f.calls[0].p_kind, "normal");
f = fixture({ plan: "pro", count: 900 });
assert.equal((await f.authority.run(req(), { ...input, isPro: false })).body.Output.tier, "pro");
assert.equal(f.row().count, 900);
f = fixture({ count: 2 }); assert.equal((await f.authority.run(req(), input)).status, 403); assert.equal(f.engineInputs.length, 0);
f = fixture(); assert.equal((await f.authority.snapshot(req())).body.plan, "free");
f = fixture({ historical: true, plan: "pro" });
assert.equal((await f.authority.run(req(), input)).body.error, "ENTITLEMENT_REVIEW_REQUIRED"); assert.equal(f.engineInputs.length, 0);
f = fixture({ count: 1 });
assert.deepEqual((await Promise.all([f.authority.run(req(), input), f.authority.run(req(), input)])).map(r => r.status).sort(), [200,403]);
assert.equal(f.row().count, 2);
f = fixture(); assert.equal((await f.authority.run({ authUser: { id: A }, headers: {} }, input)).status, 401); assert.equal(f.calls.length, 0);
f = fixture(); await f.authority.run(req(), { ...input, user_id: B });
assert(!f.accounts.has(B)); assert.equal(f.row().count, 1);
f = fixture({ analyze: async () => { throw new Error("private prompt error"); } });
response = await f.authority.run(req(), input); assert.equal(response.status, 502); assert.equal(f.row().count, 0);
assert.equal([...f.requests.values()][0].status, "released"); assert(!JSON.stringify(response).includes("private"));
for (const malformed of [{}, [], {success:false}, {Output:[],degraded:true}]) {
  f=fixture({analyze:async()=>malformed});
  assert.equal((await f.authority.run(req(),input)).status,502);
  assert.equal(f.row().count,0);
}
f = fixture({ timeoutMs: 5, analyze: () => new Promise(() => {}) });
response = await f.authority.run(req(), input); assert.equal(response.status, 504); assert.equal(response.body.error, "ANALYSIS_TIMEOUT");
assert.equal(f.row().count, 0); assert.equal([...f.requests.values()][0].status, "released");
f = fixture({ failComplete: true }); response = await f.authority.run(req(), input);
assert.equal(response.status, 503); assert.equal(f.calls.filter(c => c.p_action === "release").length, 0);
assert.equal([...f.requests.values()][0].status, "pending"); assert(!JSON.stringify(response).includes("private"));
f.advance(LEASE_MS); await f.authority.snapshot(req()); assert.equal([...f.requests.values()][0].status, "expired");
assert.equal(f.row().count, 0);
f = fixture({ count: 2 });
assert.equal((await f.authority.runOnboarding(req(), { ...input, isPro: true })).status, 200);
assert.equal(f.row().state, "consumed"); assert.equal(f.row().count, 2); assert.equal(f.engineInputs[0].isPro, false);
assert.equal((await f.authority.runOnboarding(req(), input)).body.error, "ONBOARDING_BENEFIT_UNAVAILABLE");
for (const reason of ["skipped", "completed"]) {
  f = fixture();
  await transitionOnboarding(f.client, A, "close", reason);
  assert.equal(f.row().state, "closed");
  await transitionOnboarding(f.client, A, "prepare");
  assert.equal((await f.authority.runOnboarding(req(), { ...input, onboarding_state: "available", onboarding_eligible: true, completedAt: null })).status, 403);
  await transitionOnboarding(f.client, A, "close", reason);
  assert.equal(f.row().state, "closed");
}
f = fixture({ prepared: false }); assert.equal((await f.authority.runOnboarding(req(), input)).status, 403);
await transitionOnboarding(f.client, A, "prepare"); assert.equal((await f.authority.runOnboarding(req(), input)).status, 200);
f = fixture();
assert.deepEqual((await Promise.all([f.authority.runOnboarding(req(), input), f.authority.runOnboarding(req(), input)])).map(r => r.status).sort(), [200,403]);
// Close while running: late output cannot settle or reopen the benefit.
let finish;
f = fixture({ analyze: () => new Promise(resolve => { finish = resolve; }) });
const running = f.authority.runOnboarding(req(), input);
while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
await transitionOnboarding(f.client, A, "close", "skipped");
finish({ Output: { tier: "free" } }); assert.equal((await running).status, 503); assert.equal(f.row().state, "closed");
f = fixture({ analyze: async () => { throw new Error("failed"); } });
await f.authority.runOnboarding(req(), input); assert.equal(f.row().state, "available");

// Same key cannot start the engine twice; changed input/user cannot reuse it.
f = fixture();
assert.equal((await f.authority.run(req(A,key), input)).status, 200);
assert.equal((await f.authority.run(req(A,key), input)).body.error, "ANALYSIS_ALREADY_COMPLETED");
assert.equal((await f.authority.run(req(A,key), { ...input, cvText: "different" })).body.error, "IDEMPOTENCY_CONFLICT");
assert.equal((await f.authority.run(req(B,key), input)).body.error, "IDEMPOTENCY_CONFLICT");
assert.equal(f.engineInputs.length, 1); assert.equal(f.row().count, 1);
assert.equal((await f.authority.run({ headers: { authorization: A, "idempotency-key": [key] } }, input)).status, 400);
f = fixture();
const sameKey = await Promise.all([f.authority.run(req(A,key), input), f.authority.run(req(A,key), input)]);
assert.deepEqual(sameKey.map(r => r.status).sort(), [200,409]); assert.equal(f.engineInputs.length, 1);

// Direct model RPCs provide controlled time: exact boundary, pending across reset,
// expiration, duplicate release/complete and settlement fences.
const op = (m, action, kind = "normal", reason = null) => m.client.rpc("hirefit_analysis_entitlement",
  { p_user_id:A, p_action:action, p_request_id:key, p_kind:kind, p_is_admin:false, p_input_hash:"a".repeat(64), p_reason:reason });
f = fixture({ count: 2 }); await f.authority.snapshot(req());
f.advance(WINDOW_MS-1); assert.equal((await f.authority.snapshot(req())).body.allowed, false);
f.advance(1); assert.equal((await f.authority.snapshot(req())).body.allowed, true); assert.equal(f.row().count, 0);
f = fixture({ count: 1 }); await f.authority.snapshot(req()); f.advance(WINDOW_MS-1000);
await op(f,"reserve"); f.advance(1000); await f.authority.snapshot(req());
assert.equal(f.row().count, 0); assert.equal((await f.authority.snapshot(req())).body.pending_count, 1);
await op(f,"complete"); await op(f,"complete"); assert.equal(f.row().count, 1);
f = fixture(); await op(f,"reserve","onboarding"); f.advance(LEASE_MS);
await f.authority.snapshot(req()); assert.equal(f.row().state,"available");
assert.equal((await op(f,"complete","onboarding")).data.error, "ANALYSIS_REQUEST_EXPIRED");
assert.equal((await f.authority.runOnboarding(req(A,key), input)).body.error, "IDEMPOTENCY_CONFLICT");
assert.equal((await f.authority.runOnboarding(req(), input)).status, 200);
f = fixture(); await op(f,"reserve"); await op(f,"release","normal","engine_failure"); await op(f,"release","normal","engine_failure");
assert.equal(f.row().count,0); assert((await op(f,"complete")).error);

f = fixture();
assert.equal((await createEntitlementAuthority({ ...f.deps, adminEmail: () => "user@example.invalid" }).run(req(),input)).body.Output.tier,"pro");
assert.equal((await createEntitlementAuthority({ ...f.deps, verify: async () => ({ ok:false,status:503 }) }).snapshot(req())).status,503);
assert((await setTrustedPlan(f.client,A,"pro","payment")).error); // never reaches unreviewed payment RPC
assert.equal(f.calls.length,2);
assert((await setTrustedPlan({ rpc:async () => ({ data:{success:false} }) },A,"pro","admin")).error);

for (const [url,method] of [["/api/entitlements","GET"],["/api/analyze-v2","POST"],["/api/onboarding-analysis","POST"],
 ["/api/career-onboarding/prepare","POST"],["/api/career-onboarding/complete","POST"],["/api/career-onboarding/first-analysis","PATCH"]]) {
  let output; const res = { statusCode:0, setHeader() {}, end(text) { output=JSON.parse(text); } };
  const request = { url,method,headers:{},body:input,query:{route:[url.split("/").at(-1)]} };
  await handleCareerApi(request,res,normalizeVercelApiPath(request));
  assert.equal(res.statusCode,401); assert(output.error);
}
const app=read("src/App.jsx"), express=read("server/server.js"), router=read("lib/vercelApi/careerApiRouter.js");
assert(!/\.from\("user_plans"\)|increment_user_plan_analysis/.test(app));
assert.match(express,/registerEntitlementRoutes\(app\)/); assert.match(router,/entitlementAuthority\.runOnboarding/);
assert(!express.includes("runAnalyzeV2WithCompanyIntel")); assert(!router.includes("runAnalyzeV2WithCompanyIntel"));
assert(!read("src/utils/firstCareerAnalysis.js").includes("isPro:"));
const a=read("docs/database/security-hardening-20261011/entitlement-authority-phase-a.DRAFT.sql").replace(/\r/g,"");
const b=read("docs/database/security-hardening-20261011/entitlement-authority-phase-b.DRAFT.sql").replace(/\r/g,"");
assert.match(a,/FOR UPDATE/); assert.match(a,/pg_advisory_xact_lock/); assert.match(a,/a\.analysis_count::bigint\+pending<2/);
assert.match(a,/interval '720 hours'/); assert.match(a,/interval '15 minutes'/);
assert.match(a,/SECURITY INVOKER/); assert(!a.replace(/^\s*--.*$/gm,"").includes("SECURITY DEFINER"));
assert(!a.includes("onboarding_completed")); assert(!a.includes("completedAt")); assert(!a.includes("onboarding_eligible"));
assert.match(a,/status='expired'/); assert.match(a,/onboarding_state='closed'/); assert.match(a,/onboarding_state='reserved'/);
assert.match(b,/REVOKE SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public\.user_plans FROM PUBLIC,anon,authenticated,service_role/);
assert(!/GRANT[^;]*(?:INSERT|UPDATE)[^;]*TO authenticated/.test(b));
assert.match(b,/REVOKE EXECUTE ON FUNCTION public\.increment_user_plan_analysis/);
for (const sql of [a,b]) { assert.match(sql,/\nBEGIN;/); assert.match(sql,/COMMIT;\s*$/); assert(!/GRANT ALL|ALTER TABLE auth\.|ALTER TABLE storage\.|INSERT INTO supabase_migrations/i.test(sql)); }
for (const tag of ["authority","plan"]) {
  const body=a.split("$"+tag+"$")[1];
  assert(b.includes(createHash("md5").update(body).digest("hex")), "Phase B verifies exact normalized Phase A body");
}
// Captured default grants must be compared once per actual owner, not mutually exclusive grantors.
assert.equal((a.match(/\$defaults\$/g)||[]).length,2);
assert(!a.includes("postgres=rwU/supabase_admin"));
assert(!a.includes("postgres=rwU/supabase_auth_admin"));
// Optional local audit evidence; never require or stage a production capture for CI.
if (existsSync(new URL("../hirefit-prod-schema-capture-20261008.txt",import.meta.url))) {
  const capture=JSON.parse(read("hirefit-prod-schema-capture-20261008.txt"));
  const legacy=capture.find(r=>r.object_name==="increment_user_plan_analysis(uuid)"&&r.metadata.definition);
  const legacyHash=createHash("md5").update(legacy.metadata.definition.replace(/\r/g,"")).digest("hex");
  assert(a.includes(legacyHash)); assert(b.includes(legacyHash));
  for (const expected of JSON.parse(a.split("$defaults$")[1])) {
    const actual=capture.find(r=>r.section==="09_default_acl"&&r.object_name===`${expected.owner} / ${expected.schema} / ${expected.kind}`);
    assert(actual); assert.deepEqual(actual.metadata.acl.slice(1,-1).split(",").sort(),expected.acl);
  }
}
assert.match(a,/format\('public\.user_plans\.%I',p\.polname\)/);
assert.match(b,/format\('public\.user_plans\.%I',p\.polname\)/);
const isolated=read("docs/database/security-hardening-20261011/entitlement-isolated-verification.DRAFT.sql");
for (const sql of [a,b,isolated]) {
  assert.match(sql,/to_regnamespace\('supabase_migrations'\) IS NULL/);
  assert.match(sql,/to_regclass\('supabase_migrations\.schema_migrations'\) IS NULL/);
  const historyChecks=[...sql.matchAll(/EXECUTE \$history_check\$([\s\S]*?)\$history_check\$ INTO history_matches;/g)];
  assert.equal(historyChecks.length,2,"History verified before and after draft work");
  for (const [,query] of historyChecks) assert.match(query,
    /^SELECT count\(\*\) = 1 AND count\(\*\) FILTER \(\s*WHERE version::text = '20261010120000' AND name = 'production_state_baseline'\) = 1\s*FROM supabase_migrations\.schema_migrations$/);
  assert.equal((sql.match(/IF history_matches IS DISTINCT FROM true THEN/g)||[]).length,2);
  assert(!/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\s+supabase_migrations\b/i.test(sql),"History is read-only");
}
assert.equal((isolated.match(/^BEGIN;$/gm)||[]).length,1);
assert.match(isolated,/ROLLBACK;\s*$/);
assert(!/^\s*(?:CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|COMMIT)\b/im.test(isolated));
assert(!/\bsetval\s*\(/i.test(isolated));
assert.equal(createHash("sha256").update(readFileSync(new URL("../supabase/migrations/20261010120000_production_state_baseline.sql",import.meta.url))).digest("hex"),
  "ed6a2878faaf90d9f500d29b19bdfb3950b9f67c685f1d1d1c847e68d786f103");
// eslint-disable-next-line no-console
console.log("PASS: entitlement lifecycle, modeled reset/concurrency/expiry, idempotency, auth/tier isolation, payment hold, routing and draft safety. PostgreSQL execution NOT performed.");
