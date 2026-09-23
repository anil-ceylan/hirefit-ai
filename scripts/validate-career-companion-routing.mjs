import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";

// Required official compilers; deliberately fail rather than silently substitute
// a hand-written interpretation of Vercel's filesystem/catch-all semantics.
const require = createRequire(import.meta.url);
const { detectBuilders } = require(process.env.HIREFIT_ROUTE_AUDIT_MODULE || "@vercel/fs-detectors");
const { getTransformedRoutes } = require(process.env.HIREFIT_ROUTE_UTILS || "@vercel/routing-utils");
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const files = readdirSync("api", { recursive: true }).filter(x => x.endsWith(".js")).map(x => `api/${x.replaceAll("\\", "/")}`);
const detected = await detectBuilders(files, JSON.parse(readFileSync("package.json", "utf8")), { projectSettings: { framework: "vite" } });
assert.equal(detected.errors, null);
assert.equal(files.length, 10);
assert.ok(files.length <= 12);
const compiled = getTransformedRoutes(config);
assert.equal(compiled.error, null);
function substitute(route, pathname) {
  const match = pathname.match(new RegExp(route.src));
  return match && route.dest?.replace(/\$(\d+)/g, (_, n) => match[Number(n)]);
}
function resolve(publicUrl, rewrites = compiled.routes) {
  let url = new URL(publicUrl, "https://www.hirefit.co");
  let file = detected.defaultRoutes.find(r => r.dest && substitute(r, url.pathname));
  if (!file) {
    const rewrite = rewrites.find(r => r.dest && substitute(r, url.pathname));
    if (!rewrite) return null;
    const next = new URL(substitute(rewrite, url.pathname), url);
    for (const [k, v] of url.searchParams) if (!next.searchParams.has(k)) next.searchParams.append(k, v);
    url = next;
    file = detected.defaultRoutes.find(r => r.dest && substitute(r, url.pathname));
  }
  if (!file) return null;
  const target = new URL(substitute(file, url.pathname), url);
  const query = Object.fromEntries(url.searchParams);
  for (const [k, v] of target.searchParams) query[k.replace(/^\.\.\./, "")] = v;
  return { target: target.pathname, url, query };
}
const old = getTransformedRoutes({ ...config, rewrites: config.rewrites.filter(r => !r.source.startsWith("/api/career-companion/")) });
assert.equal(resolve("/api/career-companion/cases", old.routes), null, "Reproduce production platform 404 before fix");
assert.equal(resolve("/api/career-companion/cases/id/unsupported"), null);

const calls = [];
const key = "__companionRoutingFixture";
globalThis[key] = (name, ...args) => {
  calls.push({ name, args });
  if (name === "getCase") return { id: args[1], user_id: args[0] };
  if (name === "loadCareerProfile") return { career_identity: "fixture" };
  return {};
};
const root = new URL("../", import.meta.url);
const moduleSource = names => names.map(name => `export const ${name} = (...args) => globalThis.${key}('${name}', ...args);`).join("\n");
const mocks = new Map([
  ["lib/auth/verifySupabaseJwt.js", "export async function getUserFromRequest(req) { return req.headers.authorization === 'Bearer fixture' ? {ok:true,user:{id:'owner'}} : {ok:false,status:401,error:'Missing bearer token'}; }"],
  ["lib/careerCompanion/persistence.js", moduleSource(["getCase", "listCases", "saveCase", "saveOutcome"])],
  ["lib/careerMemory/persistence.js", moduleSource(["loadCareerProfile", "saveCareerProfile", "getServiceClient"])],
  ["lib/careerCompanion/aiGuidance.js", moduleSource(["generatePromotionRaiseGuidance"]) + "export const PROMOTION_RAISE_PROMPT_VERSION='fixture';"],
  ["lib/careerActionLoop/persistence.js", moduleSource(["completeCareerAction", "getCareerActionOutcome", "getCurrentCareerAction", "startCareerAction", "upsertCareerActionOutcome", "upsertRecommendedCareerAction"])],
].map(([file, source]) => [new URL(file, root).href, `data:text/javascript,${encodeURIComponent(source)}`]));
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".")) {
    const replacement = mocks.get(new URL(specifier, context.parentURL).href);
    if (replacement) return { url: replacement, shortCircuit: true };
  }
  return next(specifier, context);
} });
try {
  const input = { what_happened: "Review", desired_outcome: "Promotion", role_context: "Analyst", achievements: "Improved reports", urgency: "medium" };
  const id = "case:İstanbul-%3A";
  const endpoints = [
    ["GET", "/api/career-companion/cases", "listCases", {}],
    ["POST", "/api/career-companion/cases", "saveCase", input],
    ["GET", `/api/career-companion/cases/${encodeURIComponent(id)}`, "getCase", {}],
    ["POST", `/api/career-companion/cases/${encodeURIComponent(id)}/guidance`, "generatePromotionRaiseGuidance", { lang: "TR" }],
    ["POST", `/api/career-companion/cases/${encodeURIComponent(id)}/outcome`, "saveOutcome", { manager_response: "Agreed", outcome_date: "2026-09-23" }],
    ["GET", "/api/career-actions/current", "getCurrentCareerAction", {}],
    ["POST", "/api/career-actions/start", "startCareerAction", { action_id: id }],
    ["POST", "/api/career-actions/complete", "completeCareerAction", { action_id: id }],
    ["GET", `/api/career-actions/${encodeURIComponent(id)}/outcome`, "getCareerActionOutcome", {}],
    ["POST", `/api/career-actions/${encodeURIComponent(id)}/outcome`, "upsertCareerActionOutcome", { summary: "Result" }],
  ];
  for (const [method, path, expected, body] of endpoints) {
    const route = resolve(`${path}?sentinel=preserved`);
    assert.ok(route, `${method} ${path} must reach a deployed function`);
    assert.equal(route.query.sentinel, "preserved");
    const { default: handler } = await import(new URL(route.target.slice(1), root));
    // Exercise original URL, rewrite destination, and function-runtime URL.
    for (const url of [path, route.url.pathname, route.target.replace(/\.js$/, "")]) {
      for (const authorized of [false, true]) {
        calls.length = 0;
        const req = { method, url, query: route.query, body, headers: authorized ? { authorization: "Bearer fixture" } : {} };
        const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.json = JSON.parse(value); } };
        await handler(req, res);
        assert.equal(res.statusCode, authorized ? (expected === "saveCase" ? 201 : 200) : 401);
        assert.match(res.headers["Content-Type"], /application\/json/);
        if (!authorized) { assert.equal(calls.length, 0); continue; }
        assert.ok(calls.some(c => c.name === expected), expected);
        for (const call of calls.filter(c => ["getCase", "saveOutcome", "getCareerActionOutcome", "upsertCareerActionOutcome"].includes(c.name))) assert.deepEqual(call.args.slice(0, 2), ["owner", id]);
        if (expected === "saveOutcome") assert.equal(calls.find(c => c.name === expected).args[2].manager_response, body.manager_response);
        if (expected === "generatePromotionRaiseGuidance") {
          assert.deepEqual(calls.find(c => c.name === "loadCareerProfile").args, ["owner"]);
          assert.equal(calls.find(c => c.name === expected).args[0].lang, body.lang);
        }
        assert.deepEqual(req.body, body);
      }
    }
  }
  process.stdout.write("Official Vercel compiled routes: old platform 404 reproduced; all 5 Companion methods, JSON 401, authenticated dispatch, query/body/ID preservation, Weekly Action routes and 10/12 functions passed.\n");
} finally { hooks.deregister(); delete globalThis[key]; }
