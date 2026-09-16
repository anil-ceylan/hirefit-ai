import assert from "node:assert/strict";
import { registerHooks, createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const routerUrl = new URL("lib/vercelApi/careerApiRouter.js", root).href;
const authUrl = new URL("lib/auth/verifySupabaseJwt.js", root).href;
const persistenceUrl = new URL("lib/careerActionLoop/persistence.js", root).href;
const calls = [];
const key = "__weeklyOutcomeRoutingTest";
const previous = globalThis[key];
globalThis[key] = (name, ...args) => {
  calls.push({ name, args });
  return name.includes("Outcome") ? { outcome: { outcome_id: "test-outcome" }, storageUnavailable: false }
    : { action: { action_id: "test-action" }, storageUnavailable: false };
};
const moduleUrl = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const names = ["completeCareerAction", "getCareerActionOutcome", "getCurrentCareerAction", "startCareerAction", "upsertCareerActionOutcome", "upsertRecommendedCareerAction"];
const mockPersistence = moduleUrl(names.map((name) => `export const ${name} = (...args) => globalThis.${key}('${name}', ...args);`).join("\n"));
const mockAuth = moduleUrl("export const createClient = () => ({auth:{getUser:async token => ({data:{user:token === 'test-token' ? {id:'authenticated-user'} : null},error:null})}});");
const env = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].map((name) => [name, process.env[name]]);
process.env.VITE_SUPABASE_URL = "https://routing-test.invalid";
process.env.VITE_SUPABASE_ANON_KEY = "synthetic-test-key";
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === authUrl && specifier === "@supabase/supabase-js") return { url: mockAuth, shortCircuit: true };
  if (context.parentURL === routerUrl && specifier.startsWith(".") && new URL(specifier, routerUrl).href === persistenceUrl) return { url: mockPersistence, shortCircuit: true };
  return next(specifier, context);
} });
try {
  const { default: handler } = await import("../api/career-actions/[...rest].js");
  const { default: existing } = await import("../api/career-actions/[...rest].js");
  const payload = { outcome_type: "COMPLETED_WITH_RESULT", summary: "Closed Beta test sonucu", measurable_result: "", proof_reference: "", source: "weekly_decision_center" };
  async function invoke(entry, method, url, query = {}, authorized = true) {
    const req = { method, url, query, body: payload, headers: authorized ? { authorization: "Bearer test-token" } : {} };
    const res = { statusCode: 200, setHeader() {}, end(body) { this.json = JSON.parse(body); } };
    await entry(req, res);
    return res;
  }
  const ids = [
    "063381ae-2184-4814-9000-eca6f9b89c9e:2026-W37:bir-ürün-strateji-kararını-problem-seçenekler-karar-sonuç-formatında-tek-ö",
    "test:2026-W37:literal-%3A-İstanbul",
  ];
  const rewrite = JSON.parse(readFileSync("vercel.json", "utf8")).rewrites.find((r) => r.source === "/api/career-actions/:actionId/outcome");
  assert.equal(rewrite?.destination, "/api/career-actions/outcome?outcomeActionId=:actionId");
  let compiledRewrite;
  if (process.env.HIREFIT_ROUTE_UTILS) {
    const { getTransformedRoutes } = createRequire(import.meta.url)(process.env.HIREFIT_ROUTE_UTILS);
    const compiled = getTransformedRoutes(JSON.parse(readFileSync("vercel.json", "utf8")));
    assert.equal(compiled.error, null);
    compiledRewrite = compiled.routes.find((r) => r.dest?.includes("outcomeActionId="));
    assert.ok(compiledRewrite);
  }
  for (const id of ids) {
    for (const method of ["POST", "GET"]) {
      const publicPath = `/api/career-actions/${encodeURIComponent(id)}/outcome`;
      const destination = compiledRewrite
        ? compiledRewrite.dest.replace(/\$(\d+)/g, (_, n) => publicPath.match(new RegExp(compiledRewrite.src))[Number(n)])
        : rewrite.destination.replace(":actionId", encodeURIComponent(id));
      const rewritten = new URL(destination, "https://test.invalid");
      for (const url of [`/api/career-actions/${encodeURIComponent(id)}/outcome`, rewritten.pathname, "/api/career-actions/[...rest]"]) {
        calls.length = 0;
        const query = { ...Object.fromEntries(rewritten.searchParams), rest: "outcome" };
        const denied = await invoke(handler, method, url, query, false);
        assert.equal(denied.statusCode, 401);
        assert.equal(calls.length, 0);
        const res = await invoke(handler, method, url, query);
        assert.equal(res.statusCode, 200);
        assert.equal(res.json.success, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].name, method === "POST" ? "upsertCareerActionOutcome" : "getCareerActionOutcome");
        assert.deepEqual(calls[0].args.slice(0, 2), ["authenticated-user", id]);
        if (method === "POST") assert.deepEqual(calls[0].args[2], payload);
      }
    }
  }
  for (const [path, method, name] of [["current", "GET", "getCurrentCareerAction"], ["recommended", "POST", "upsertRecommendedCareerAction"], ["start", "POST", "startCareerAction"], ["complete", "POST", "completeCareerAction"]]) {
    payload.action_id = "test-action";
    calls.length = 0;
    const res = await invoke(existing, method, `/api/career-actions/${path}`);
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].name, name);
  }
  const functions = readdirSync("api", { recursive: true }).filter((file) => file.endsWith(".js"));
  assert.equal(functions.length, 10);
  assert.ok(functions.length <= 12);
  process.stdout.write("Outcome routing: rewrite GET/POST, unauthorized 401, authenticated persistence dispatch, exact Unicode/colon/percent decoding, existing routes and 10-function budget passed.\n");
} finally {
  hooks.deregister();
  if (previous === undefined) delete globalThis[key]; else globalThis[key] = previous;
  for (const [name, value] of env) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
}
