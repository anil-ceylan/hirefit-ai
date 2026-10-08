import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { opportunityFixtures } from "./fixtures/opportunity-radar.mjs";
import { LOCATION_CONSENT_VERSION } from "../lib/opportunityRadar/location/preferenceValidation.js";

// Official Vercel compilers are required. A Vite build alone is not a route test.
const require = createRequire(import.meta.url);
const { detectBuilders } = require(process.env.HIREFIT_ROUTE_AUDIT_MODULE || "@vercel/fs-detectors");
const { getTransformedRoutes } = require(process.env.HIREFIT_ROUTE_UTILS || "@vercel/routing-utils");
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const files = readdirSync("api", { recursive: true }).filter(file => file.endsWith(".js")).map(file => `api/${file.replaceAll("\\", "/")}`);
const detected = await detectBuilders(files, JSON.parse(readFileSync("package.json", "utf8")), { projectSettings: { framework: "vite" } });
assert.equal(detected.errors, null);
assert.equal(files.length, 10);
assert.ok(files.length <= 12);
const compiled = getTransformedRoutes(config);
assert.equal(compiled.error, null);
function substitute(route, path) {
  const match = path.match(new RegExp(route.src));
  return match && route.dest?.replace(/\$(\d+)/g, (_, n) => match[Number(n)]);
}
function resolve(publicUrl, rewrites = compiled.routes) {
  let url = new URL(publicUrl, "https://www.hirefit.co");
  let file = detected.defaultRoutes.find(route => route.dest && substitute(route, url.pathname));
  if (!file) {
    const rewrite = rewrites.find(route => route.dest && substitute(route, url.pathname));
    if (!rewrite) return null;
    const next = new URL(substitute(rewrite, url.pathname), url);
    for (const [key, value] of url.searchParams) if (!next.searchParams.has(key)) next.searchParams.append(key, value);
    url = next;
    file = detected.defaultRoutes.find(route => route.dest && substitute(route, url.pathname));
  }
  if (!file) return null;
  const target = new URL(substitute(file, url.pathname), url);
  const query = Object.fromEntries(url.searchParams);
  for (const [key, value] of target.searchParams) query[key.replace(/^\.\.\./, "")] = value;
  return { target: target.pathname, url, query };
}

const id = opportunityFixtures[0].id;
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const statePath = `/api/opportunity-radar/${id}/state`;
const preferencePath = "/api/opportunity-radar/location-preference";
const withoutRewrite = getTransformedRoutes({ ...config, rewrites: config.rewrites.filter(route => !route.source.startsWith("/api/opportunity-radar/")) });
assert.equal(resolve(statePath, withoutRewrite.routes), null, "Generic Vercel adapter does not match nested state path without the narrow rewrite");
assert.equal(resolve(preferencePath, withoutRewrite.routes), null);
assert.equal(resolve("/api/opportunity-radar/id/unsupported"), null);
const calls = [];
const key = "__radarRoutingFixture";
globalThis[key] = {
  loadCareerProfile: async userId => { calls.push(["profile", userId]); return { career_goals: { targetRoles: ["data_analyst"] } }; },
  repository: {
    async hydrate(userId, ids) { return (await this.list(userId)).opportunities.filter(row => ids.includes(row.id)); },
    async list(userId) { calls.push(["list", userId]); return { opportunities: [{ ...opportunityFixtures[0], source_type: "employer", published: true, active: true,
      verification_status: "verified", last_verified_at: "2025-01-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z" }], truncated: false }; },
    async states(userId) { calls.push(["states", userId]); return []; },
    async setState(userId, opportunityId, state) { calls.push(["set", userId, opportunityId, state]); return { opportunity_id: opportunityId, state, updated_at: "2026-09-25T00:00:00Z" }; },
  },
  locationRepository: {
    async get(userId) { calls.push(["location", userId]); return null; },
    async upsert(userId) { calls.push(["location", userId]); return { enabled: true }; },
    async setEnabled(userId) { calls.push(["location", userId]); return { enabled: false }; },
    async remove(userId) { calls.push(["location", userId]); return { removed: true }; },
  },
};
const root = new URL("../", import.meta.url);
const mocks = new Map([
  ["lib/auth/verifySupabaseJwt.js", `export async function getUserFromRequest(req) { return req.headers.authorization === 'Bearer fixture' ? {ok:true,user:{id:'${owner}'}} : {ok:false,status:401}; }`],
  ["lib/careerMemory/persistence.js", `export const loadCareerProfile=(id)=>globalThis.${key}.loadCareerProfile(id); export const saveCareerProfile=()=>{throw new Error('Profile must not be written')}; export const getServiceClient=()=>{throw new Error('No live DB in test')};`],
  ["lib/opportunityRadar/persistence.js", `export const createOpportunityRepository=()=>globalThis.${key}.repository;`],
  ["lib/opportunityRadar/location/preferencePersistence.js", `export const createLocationPreferenceRepository=()=>globalThis.${key}.locationRepository;`],
].map(([path, source]) => [new URL(path, root).href, `data:text/javascript,${encodeURIComponent(source)}`]));
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".")) {
    const replacement = mocks.get(new URL(specifier, context.parentURL).href);
    if (replacement) return { url: replacement, shortCircuit: true };
  }
  return next(specifier, context);
} });
try {
  for (const [method, path, body, expected] of [
    ["GET", "/api/opportunity-radar?limit=1&lang=EN", undefined, "list"],
    ["PATCH", statePath, { state: "saved" }, "set"],
    ["PATCH", statePath, { state: "dismissed" }, "set"],
    ["PATCH", statePath, { state: "acted_on" }, "set"],
    ["GET", preferencePath, undefined, "location"],
    ["PUT", preferencePath, { source: "manual", place_id: "hf:place:0001", radius_km: 25, enabled: true, include_remote: false, consent_version: LOCATION_CONSENT_VERSION }, "location"],
    ["PATCH", preferencePath, { enabled: false }, "location"],
    ["DELETE", preferencePath, undefined, "location"],
  ]) {
    const route = resolve(path);
    assert.equal(route.target, "/api/[...route].js");
    const { default: handler } = await import(new URL(route.target.slice(1), root));
    const search = method === "GET" ? new URL(path, "https://www.hirefit.co").search : "";
    for (const url of [path, route.url.pathname + search, route.target.replace(/\.js$/, "") + search]) {
      for (const authorized of [false, true]) {
        calls.length = 0;
        const req = { method, url, query: route.query, body, headers: authorized ? { authorization: "Bearer fixture" } : {} };
        const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
        await handler(req, res);
        assert.equal(res.statusCode, authorized ? 200 : 401, `${method} ${url}`);
        assert.match(res.headers["Content-Type"], /application\/json/);
        assert.match(res.headers["Cache-Control"], /no-store/);
        if (!authorized) { assert.equal(calls.length, 0); continue; }
        assert.ok(calls.some(call => call[0] === expected));
        assert.ok(calls.every(call => call[1] === owner));
        if (expected === "set") assert.deepEqual(calls[0], ["set", owner, id, body.state]);
        else if (expected === "list") {
          assert.equal(res.body.meta.limit, 1);
          assert.equal(res.body.opportunities[0].match_score, 100);
          assert.match(res.body.opportunities[0].recommended_next_action.text, /^Open the source/);
        }
        assert.deepEqual(req.body, body);
      }
    }
  }
  process.stdout.write("Opportunity Radar official Vercel compilation: GET/PATCH public URL dispatch, missing-rewrite reproduction, JSON 401, authenticated server memory, state/body/query/UUID preservation, no-store and unchanged 10/12 functions passed.\n");
} finally { hooks.deregister(); delete globalThis[key]; }
