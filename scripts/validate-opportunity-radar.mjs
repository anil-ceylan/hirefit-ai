import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { opportunityFixtures } from "./fixtures/opportunity-radar.mjs";
import { WEIGHTS } from "../lib/opportunityRadar/constants.js";
import { isVisibleJob, validateListQuery, validateStateInput } from "../lib/opportunityRadar/validation.js";
import { profileContext, rankOpportunity, sortRankedOpportunities } from "../lib/opportunityRadar/ranking.js";
import { createOpportunityRadarHandler } from "../lib/opportunityRadar/routes.js";

const now = new Date("2030-01-01T00:00:00Z");
// Positive-path simulations exist only in this test's in-memory repository.
const live = { ...opportunityFixtures[0], source_type: "employer", published: true, active: true,
  verification_status: "verified", last_verified_at: "2029-12-30T00:00:00Z", expires_at: "2030-02-01T00:00:00Z" };
const profile = { skills: ["SQL", "Python"], career_goals: { targetRoles: ["Data Analyst"], industries: ["technology"],
  targetCountries: ["Türkiye"], targetCities: [{ countryCode: "TR", city: "İstanbul" }], workMode: ["hybrid"], experienceLevels: ["entry"], lookingFor: ["full-time"] } };
assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
assert.ok(isVisibleJob(live, now));
for (const row of opportunityFixtures) assert.equal(isVisibleJob(row, now), false);
const exclusions = [
  { type: "person" }, { type: "event" }, { subtype: "program" }, { active: false }, { published: false },
  { verification_status: "unverified" }, { verification_status: "rejected" }, { source_type: "fixture" },
  { expires_at: now.toISOString() }, { expires_at: null }, { expires_at: "invalid" },
  { deadline_at: now.toISOString() }, { ends_at: now.toISOString() }, { last_verified_at: null },
  { last_verified_at: "2031-01-01T00:00:00Z" }, { url: "javascript:alert(1)" }, { url: "https://user:secret@example.test" },
];
for (const patch of exclusions) assert.equal(isVisibleJob({ ...live, ...patch }, now), false, JSON.stringify(patch));

const rank = (p, row = live) => rankOpportunity(row, p, null, { now });
const before = JSON.stringify(profile);
assert.equal(rank(profile).match_score, 100);
assert.equal(rank(profile).alignment_coverage, 100);
assert.equal(rank(profile).score_kind, "profile_alignment");
assert.equal(rank({}).match_score, null);
assert.equal(rank({}).alignment_coverage, 0);
assert.equal(rank({ career_goals: { targetRoles: ["data_analyst"] } }).match_score, 100, "Unknown fields never count as zero");
assert.equal(rank({ career_goals: { targetRoles: ["data_analyst"] } }).alignment_coverage, 30);
assert.equal(rank({ career_goals: { lookingFor: ["unsure"], industries: ["unsure"] } }).match_score, null);
assert.equal(rank({ career_goals: { workMode: ["flexible"] } }).match_score, 100);
assert.equal(rank({ career_goals: { targetRoles: ["software_engineer"] } }).match_score, 0);
assert.equal(rank({ skills: ["SQL"] }).match_score, 50);
assert.equal(rank(profile).why_now, null, "Do not fabricate urgency");
assert.equal(rank(profile, { ...live, deadline_at: "2030-01-05T00:00:00Z" }).why_now.code, "application_deadline");
assert.equal(rank(profile, { ...live, starts_at: "2030-01-10T00:00:00Z" }).why_now.code, "start_date");
assert.equal(rank({ career_goals: { targetCountries: ["DE"] } }, { ...live, work_mode: "remote" }).match_score, 0, "Remote does not mean worldwide");
assert.equal(rank({ career_goals: { targetCities: [{ countryCode: "TR", city: "İstanbul" }] } }, { ...live, city: null }).match_score, null);
assert.deepEqual(profileContext({ target_roles: ["Software Engineer"], career_goals: { targetRoles: ["data_analyst"] } }).target_role, ["data_analyst"]);
assert.equal(JSON.stringify(profile), before, "Never mutate Career Memory");
assert.equal(sortRankedOpportunities([rank({}), rank(profile)])[0].match_score, 100);
for (const query of [{ user_id: "victim" }, { careerProfile: "{}" }, { limit: "51" }, { limit: "-1" }, { state: "invalid" }, { lang: ["TR"] }]) assert.throws(() => validateListQuery(query));
assert.throws(() => validateStateInput(live.id, { state: "saved", user_id: "victim" }));
assert.throws(() => validateStateInput("not-a-uuid", { state: "saved" }));

const calls = [];
const states = new Map();
const repository = {
  async hydrate(_user, ids) { return ids.includes(live.id) ? [live] : []; },
  async list(user) { calls.push(["list", user]); return { opportunities: [live, ...exclusions.map(patch => ({ ...live, ...patch }))], truncated: false }; },
  async states(user) { calls.push(["states", user]); return [...states.values()].filter(row => row.owner === user); },
  async setState(user, id, state) { calls.push(["set", user, id, state]); const result = { opportunity_id: id, state, updated_at: "2030-01-01T00:00:00Z" }; states.set(`${user}:${id}`, { ...result, owner: user }); return result; },
};
const authenticate = async req => req.headers?.authorization ? { ok: true, user: { id: req.headers.authorization } } : { ok: false, status: 401 };
const loadProfile = async user => { calls.push(["profile", user]); return profile; };
const handle = createOpportunityRadarHandler({ authenticate, repository, loadProfile, clock: () => now });
const request = (method, user = "owner-a", body, url = "/api/opportunity-radar") => ({ method, url, headers: user ? { authorization: user } : {}, body });
const statePath = `/api/opportunity-radar/${live.id}/state`;
for (const [method, path] of [["GET", "/api/opportunity-radar"], ["PATCH", statePath]]) {
  calls.length = 0;
  assert.equal((await handle(request(method, null), path)).status, 401);
  assert.equal(calls.length, 0, "Unauthenticated requests cannot load memory/storage");
}
let result = await handle(request("GET", "owner-a", { user_id: "victim", careerProfile: {} }), "/api/opportunity-radar");
assert.equal(result.status, 200);
assert.equal(result.body.opportunities.length, 1);
assert.equal(result.body.opportunities[0].match_score, 100);
// Production Vercel metadata must never enter semantic query validation.
for (const route of ['opportunity-radar', ['opportunity-radar']]) {
  const req = request('GET', 'owner-a', undefined, '/api/opportunity-radar?lang=TR&limit=20');
  req.query = { route, lang: 'TR', limit: '20', radarEndpoint: ['internal'], opportunityId: ['internal'] };
  assert.equal((await handle(req, '/api/opportunity-radar')).status, 200);
  await handle(request('PATCH', 'owner-a', { state: 'saved' }), statePath);
  req.url += '&state=saved'; req.query.state = 'saved';
  const saved = await handle(req, '/api/opportunity-radar');
  assert.equal(saved.status, 200);
  assert.equal(saved.body.opportunities[0].current_user_state, 'saved');
}
for (const [key, value] of [['lang', 'TR'], ['limit', '20'], ['state', 'saved']]) {
  for (const values of [[value], [value, value]]) {
    const req = request('GET'); req.query = { route: ['opportunity-radar'], [key]: values };
    assert.equal((await handle(req, '/api/opportunity-radar')).body.error, 'INVALID_QUERY');
  }
  const duplicate = request('GET', 'owner-a', undefined, `/api/opportunity-radar?${key}=${value}&${key}=${value}`);
  duplicate.query = { [key]: value }; // Flattening must not hide URL duplicates.
  assert.equal((await handle(duplicate, '/api/opportunity-radar')).body.error, 'INVALID_QUERY');
}
for (const [url, query] of [
  ['/api/opportunity-radar?lang=XX', { lang: 'TR' }],
  ['/api/opportunity-radar?limit=0', { limit: '20' }],
  ['/api/opportunity-radar?lang=TR', { lang: 'EN' }],
  ['/api/opportunity-radar?state=invalid', {}],
  ['/api/opportunity-radar?unexpected=value', {}],
  ['/api/opportunity-radar', { unexpected: 'value' }],
  ['/api/opportunity-radar', { limit: 20 }],
]) {
  const req = request('GET', 'owner-a', undefined, url); req.query = query;
  assert.deepEqual(await handle(req, '/api/opportunity-radar'), { status: 400, body: { success: false, error: 'INVALID_QUERY' } });
}
const routedState = request('PATCH', 'owner-a', { state: 'saved' });
routedState.query = { route: ['opportunity-radar'], radarEndpoint: 'state', opportunityId: live.id };
assert.equal((await handle(routedState, statePath)).status, 200);
assert.ok(calls.some(call => call[0] === "profile" && call[1] === "owner-a"));
for (const state of ["saved", "dismissed", "acted_on"]) {
  const first = await handle(request("PATCH", "owner-a", { state }), statePath);
  const second = await handle(request("PATCH", "owner-a", JSON.stringify({ state })), statePath);
  assert.deepEqual(first, second);
  assert.equal(first.status, 200);
  assert.equal(states.size, 1);
}
await handle(request("PATCH", "owner-b", { state: "dismissed" }), statePath);
assert.equal(states.size, 2);
assert.equal(states.get(`owner-a:${live.id}`).state, "acted_on");
assert.equal((await handle(request("GET", "owner-b"), "/api/opportunity-radar")).body.opportunities.length, 0);
result = await handle(request("GET", "owner-b", undefined, "/api/opportunity-radar?state=dismissed"), "/api/opportunity-radar");
assert.equal(result.body.opportunities[0].current_user_state, "dismissed");
assert.equal((await handle(request("PATCH", "owner-b", { state: "saved", user_id: "owner-a" }), statePath)).status, 400);
assert.equal((await handle(request("GET", "owner-a", undefined, "/api/opportunity-radar?limit=1&limit=2"), "/api/opportunity-radar")).status, 400);
assert.equal((await handle(request("POST"), "/api/opportunity-radar")).status, 405);
assert.equal((await handle(request("PATCH", "owner-a", "{"), statePath)).body.error, "INVALID_JSON");
assert.equal((await handle(request("PATCH", "owner-a", "x".repeat(2049)), statePath)).status, 413);
const stream = Readable.from([JSON.stringify({ state: "saved" })]);
Object.assign(stream, { method: "PATCH", headers: { authorization: "owner-a" } });
assert.equal((await handle(stream, statePath)).status, 200);
const noProfile = createOpportunityRadarHandler({ authenticate, loadProfile: async () => null, repository });
assert.equal((await noProfile(request("GET"), "/api/opportunity-radar")).status, 409);
const failed = createOpportunityRadarHandler({ authenticate, loadProfile: async () => { throw new Error("private details must not escape"); } });
assert.deepEqual(await failed(request("GET"), "/api/opportunity-radar"), { status: 503, body: { success: false, error: "RADAR_UNAVAILABLE" } });
for (const failingMethod of ["list", "states", "hydrate", "setState"]) {
  const failingRepository = { ...repository, [failingMethod]: async () => { throw new Error("private database diagnostics"); } };
  const failingHandler = createOpportunityRadarHandler({ authenticate, loadProfile, repository: failingRepository, clock: () => now });
  const isWrite = failingMethod === "setState";
  const stateBefore = JSON.stringify([...states]);
  const failure = await failingHandler(request(isWrite ? "PATCH" : "GET", "owner-a", isWrite ? { state: "dismissed" } : undefined), isWrite ? statePath : "/api/opportunity-radar");
  assert.deepEqual(failure, { status: 503, body: { success: false, error: "RADAR_UNAVAILABLE" } });
  assert.equal(JSON.stringify([...states]), stateBefore, "Storage failure does not fabricate success or change state");
}
process.stdout.write("Opportunity Radar: deterministic ranking, unknown coverage, eligibility/freshness, fixtures, server memory, auth, isolated/idempotent states, errors and bounded bodies passed.\n");
