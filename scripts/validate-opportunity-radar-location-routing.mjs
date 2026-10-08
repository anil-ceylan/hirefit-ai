import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { createLocationPreferenceRepository } from "../lib/opportunityRadar/location/preferencePersistence.js";
import { LOCATION_CONSENT_VERSION, LOCATION_PREFERENCE_PATH as path } from "../lib/opportunityRadar/location/preferenceValidation.js";
import { locationDatabaseFixture } from "./fixtures/opportunity-location-repository.mjs";

// Actual adapter + dispatcher + handler, but isolated authentication/storage.
// Exact configured narrow rewrite exercised here; official compilation remains
// a separate validator, not claimed by this test.
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const rewrite = config.rewrites.find(row => row.source === path);
assert.equal(rewrite?.destination, '/api/opportunity-radar?radarEndpoint=location-preference');
assert.equal(readdirSync('api', { recursive: true }).filter(file => file.endsWith('.js')).length, 10);
const db = locationDatabaseFixture(), user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const key = '__locationRoutingFixture';
globalThis[key] = createLocationPreferenceRepository(() => db.client);
const root = new URL('../', import.meta.url);
const mocks = new Map([
  ['lib/auth/verifySupabaseJwt.js', `export const getUserFromRequest=async req=>req.headers.authorization==='Bearer fixture'?{ok:true,user:{id:'${user}'}}:{ok:false,status:401};`],
  ['lib/opportunityRadar/location/preferencePersistence.js', `export const createLocationPreferenceRepository=()=>globalThis.${key};`],
].map(([file, source]) => [new URL(file, root).href, `data:text/javascript,${encodeURIComponent(source)}`]));
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.')) {
    const mock = mocks.get(new URL(specifier, context.parentURL).href);
    if (mock) return { url: mock, shortCircuit: true };
  }
  return next(specifier, context);
} });
try {
  const { default: handler, normalizeVercelApiPath } = await import('../api/[...route].js');
  const manual = { source: 'manual', place_id: 'hf:place:0001', enabled: true, include_remote: false, radius_km: 25, consent_version: LOCATION_CONSENT_VERSION };
  for (const url of [path, rewrite.destination + '&...route=opportunity-radar', '/api/[...route]?radarEndpoint=location-preference&...route=opportunity-radar']) {
    for (const [method, body] of [['GET'], ['PUT', manual], ['PATCH', { enabled: false }], ['DELETE']]) {
      for (const authorized of [false, true]) {
        const query = { route: ['opportunity-radar'], radarEndpoint: 'location-preference', lang: ['ignored'], arbitrary: ['metadata'] };
        const req = { method, url, query, body, headers: authorized ? { authorization: 'Bearer fixture' } : {} };
        const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
        assert.equal(normalizeVercelApiPath(req), path);
        const before = db.calls.length;
        await handler(req, res);
        assert.equal(res.statusCode, authorized ? 200 : 401);
        if (!authorized) assert.equal(db.calls.length, before);
        else assert.ok(db.calls.slice(before).every(call => call.owner === user));
      }
    }
  }
  assert.equal(normalizeVercelApiPath({ url: '/api/opportunity-radar?lang=TR&limit=20&...route=opportunity-radar', query: { route: ['opportunity-radar'] } }), '/api/opportunity-radar');
  assert.equal(normalizeVercelApiPath({ url: '/api/opportunity-radar', query: { route: ['opportunity-radar'], radarEndpoint: 'state', opportunityId: user } }), `/api/opportunity-radar/${user}/state`);
  const nearbyReq = { method: 'GET', url: '/api/opportunity-radar?lang=TR&limit=20&view=nearby&...route=opportunity-radar',
    query: { route: ['opportunity-radar'], view: ['ignored'] }, headers: { authorization: 'Bearer fixture' } };
  const nearbyRes = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
  await handler(nearbyReq, nearbyRes);
  assert.equal(nearbyRes.statusCode, 409);
  assert.equal(nearbyRes.body.error, 'LOCATION_PREFERENCE_REQUIRED');
  process.stdout.write('PASS: exact preference rewrite + real Vercel adapter/dispatcher/handler GET/PUT/PATCH/DELETE, array metadata, JSON auth isolation, list/state normalization and 10 functions. Official compilation is separate.\n');
} finally { hooks.deregister(); delete globalThis[key]; }
