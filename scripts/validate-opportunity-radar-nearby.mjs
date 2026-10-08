import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOpportunityLocationRepository, LOCATION_READ_COLUMNS } from '../lib/opportunityRadar/location/opportunityLocationPersistence.js';
import { evaluateLocationMatch } from '../lib/opportunityRadar/location/evaluation.js';
import { evaluateOpportunity, profileContext, rankOpportunity, sortRankedOpportunities } from '../lib/opportunityRadar/ranking.js';
import { WEIGHTS, CANDIDATE_LIMIT, SMALL_CATALOG_LIMIT } from '../lib/opportunityRadar/constants.js';
import { COMPACT_COLUMNS } from '../lib/opportunityRadar/persistence.js';
import { createOpportunityRadarHandler } from '../lib/opportunityRadar/routes.js';
import { validateListQuery } from '../lib/opportunityRadar/validation.js';
import { opportunityFixtures } from './fixtures/opportunity-radar.mjs';
import { listOpportunities, radarErrorMessage } from '../src/utils/opportunityRadarClient.js';

const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const now = new Date('2030-01-01T00:00:00Z');
const preference = { enabled: true, approximate_latitude: 0, approximate_longitude: 0,
  location_precision: 'city_centroid', uncertainty_km: 1, place_id: 'fixture:search', country_code: 'TR', city: 'Fixture', radius_km: 10, include_remote: false };
const point = (latitude, longitude, uncertainty_km = 0) => ({ latitude, longitude, uncertainty_km,
  location_precision: 'source_point', place_id: null, country_code: null, city: null });
const inside = point(0, 0.01), outside = point(10, 10), boundary = point(0, 0.09);
const unknown = { latitude: null, longitude: null, uncertainty_km: null, location_precision: 'city_only', place_id: 'fixture:other', country_code: null, city: 'Other' };
const same = { ...unknown, place_id: 'fixture:search', country_code: 'TR', city: 'Fixture' };
const set = (locations, locationsComplete = true) => ({ locations, locationsComplete });
const make = n => ({ ...opportunityFixtures[0], id: id(n), type: 'job', subtype: 'internship', role_tags: [], sector_tags: [], skill_tags: [],
  country: 'TR', city: 'İstanbul', work_mode: 'onsite', requirements: {}, source_type: 'employer', active: true, published: true,
  verification_status: 'verified', last_verified_at: '2029-12-01T00:00:00Z', expires_at: '2030-02-01T00:00:00Z' });
assert.deepEqual(WEIGHTS, { target_role: 30, target_sector: 15, skills: 20, location: 10, work_mode: 10, experience_level: 10, career_direction: 5 });
assert.equal(CANDIDATE_LIMIT, 200); assert.equal(SMALL_CATALOG_LIMIT, 1000);
const cases = [
  [set([inside]), 'onsite', 1, true, 'approximate_distance'],
  [set([inside], false), 'onsite', 1, true, 'approximate_distance'],
  [set([outside]), 'hybrid', 0, false, 'outside'],
  [set([same]), 'flexible', 1, true, 'same_city'],
  [set([boundary]), 'onsite', null, true, 'boundary_uncertain'],
  [set([unknown]), 'onsite', null, false, 'unknown'],
  [set([outside, unknown]), 'onsite', null, false, 'unknown'],
  [set([outside], false), 'onsite', null, false, 'unknown'],
  [set([outside, inside]), 'onsite', 1, true, 'approximate_distance'],
  [set([outside, same]), 'onsite', 1, true, 'same_city'],
  [set([inside]), 'remote', null, false, 'remote'],
  [set([]), 'onsite', null, false, 'unknown'],
];
const profile = { career_goals: { targetCountries: ['TR'], workMode: ['remote'] } };
for (const [locationSet, workMode, score, nearby, kind] of cases) {
  const result = evaluateLocationMatch(preference, locationSet, workMode);
  assert.equal(result.signal.score, score); assert.equal(result.nearby, nearby); assert.equal(result.metadata.kind, kind);
  const row = { ...make(1), work_mode: workMode };
  const compact = Object.fromEntries(COMPACT_COLUMNS.split(',').map(key => [key, row[key]]));
  const numeric = evaluateOpportunity(compact, profileContext(profile), { preference, locationSet });
  const detailed = rankOpportunity(row, profile, null, { now, preference, locationSet });
  assert.equal(numeric.match_score, detailed.match_score); assert.equal(numeric.alignment_coverage, detailed.alignment_coverage);
  assert.deepEqual(numeric.location_match, detailed.location_match);
  assert.equal(detailed.ranking_version, 'jobs-location-v1'); assert.equal(detailed.score_kind, 'profile_alignment');
  assert.equal(numeric.signals.find(s => s.dimension === 'location').weight, 10);
  if (workMode === 'remote') {
    assert.equal(numeric.signals.find(s => s.dimension === 'work_mode').score, 1);
    assert.equal(detailed.location_match.radius_relation, null);
    assert.equal(detailed.location_match.approximate_distance_km, undefined);
  }
  assert.doesNotMatch(JSON.stringify(detailed), /approximate_latitude|approximate_longitude|evidence_reference|fixture:search/);
}
assert.equal(evaluateLocationMatch({ ...preference, include_remote: true }, set([]), 'remote').nearby, true);
const unbounded = evaluateLocationMatch({ ...preference, uncertainty_km: null }, set([inside]), 'onsite');
assert.equal(unbounded.signal.score, null); assert.equal(unbounded.nearby, false);
assert.equal(evaluateLocationMatch(preference, set([{ ...inside, location_precision: 'city_centroid', place_id: 'fixture:city', city: 'City' }]), 'onsite').metadata.distance_basis, 'city_centroid');
assert.deepEqual(rankOpportunity(make(1), profile, null, { now }), rankOpportunity(make(1), profile, null, { now, preference: { enabled: false } }));
assert.equal(rankOpportunity(make(1), profile, null, { now }).ranking_version, 'jobs-v1');
assert.deepEqual(sortRankedOpportunities([2, 1].map(n => ({ id: id(n), match_score: null, alignment_coverage: 0 }))).map(row => row.id), [id(1), id(2)]);

// Execute real repository with a bounded, lower-than-requested server page cap.
let dbRows = Array.from({ length: 205 }, (_, n) => ({ id: id(n + 1), location_set_complete: true,
  opportunity_locations: [{ location_key: 'one', ...inside }] }));
let dbError = false, unrelated = false;
const queries = [];
const client = { from(table) {
  assert.equal(table, 'opportunities'); let ids, cursor = null;
  const q = {
    select(columns) { assert.equal(columns, LOCATION_READ_COLUMNS); return q; },
    in(key, values) { assert.equal(key, 'id'); assert.ok(values.length <= 100); ids = values; return q; },
    gt(key, value) { assert.equal(key, 'id'); cursor = value; return q; },
    order(key, options) { assert.equal(key, options.referencedTable ? 'location_key' : 'id'); return q; },
    limit(value, options) { assert.equal(value, options?.referencedTable ? 11 : 100); return q; },
    then(resolve, reject) { return Promise.resolve().then(() => {
      queries.push({ ids, cursor });
      return { error: dbError ? { message: 'private database error' } : null,
        data: unrelated ? [{ ...dbRows[0], id: id(999) }] : dbRows.filter(row => ids.includes(row.id) && (!cursor || row.id > cursor)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 37) };
    }).then(resolve, reject); },
  }; return q;
} };
const locationsRepo = createOpportunityLocationRepository(() => client);
const grouped = await locationsRepo.locationsForOpportunities(user, dbRows.map(row => row.id));
assert.equal(grouped.size, 205); assert.equal(grouped.get(id(1)).locationsComplete, true);
assert.equal(queries.length, 10, 'Bounded batches and keyset drain, not N+1');
assert.deepEqual(await locationsRepo.locationsForOpportunities(user, []), new Map());
for (const ids of [[id(1), id(1)], ['not-uuid'], Array.from({ length: 1001 }, (_, n) => id(n + 1))]) await assert.rejects(locationsRepo.locationsForOpportunities(user, ids), e => e.code === 'RADAR_UNAVAILABLE');
await assert.rejects(locationsRepo.locationsForOpportunities(null, []), e => e.code === 'AUTH_REQUIRED');
dbRows = [dbRows[0]];
for (const rows of [Array(11).fill({ location_key: 'one', ...inside }), [{ location_key: 'one', ...inside, latitude: 91 }],
  [{ location_key: 'one', ...inside, evidence_reference: 'private' }], [{ location_key: 'one', ...inside, latitude: null }],
  [{ location_key: 'one', ...inside }, { location_key: 'one', ...inside }]]) {
  dbRows[0].opportunity_locations = rows;
  await assert.rejects(locationsRepo.locationsForOpportunities(user, [id(1)]), e => e.code === 'RADAR_UNAVAILABLE');
}
dbRows[0].opportunity_locations = [{ location_key: 'one', ...inside }];
unrelated = true; await assert.rejects(locationsRepo.locationsForOpportunities(user, [id(1)])); unrelated = false;
dbError = true; await assert.rejects(locationsRepo.locationsForOpportunities(user, [id(1)]), e => e.message === 'RADAR_UNAVAILABLE'); dbError = false;

let pref = null, preferenceFailure = false, preferenceReads = 0, locationReads = 0, onHydrate = () => {};
let catalog = [make(1)], states = [], evidence = new Map([[id(1), set([inside])]]), evidenceFailure = false;
const handler = createOpportunityRadarHandler({ clock: () => now, authenticate: async req => req.authorized === false ? { ok: false, status: 401 } : { ok: true, user: { id: user } },
  loadProfile: async () => profile,
  locationRepository: { getForEvaluation: async owner => { assert.equal(owner, user); preferenceReads++; if (preferenceFailure) throw new Error('private'); return pref; } },
  opportunityLocations: { locationsForOpportunities: async (owner, ids) => { assert.equal(owner, user); locationReads++; if (evidenceFailure) throw new Error('private'); return new Map(ids.map(value => [value, evidence.get(value) || set([], false)])); } },
  repository: { list: async () => ({ opportunities: catalog }), states: async () => states,
    hydrate: async (_owner, ids) => { onHydrate(); return catalog.filter(row => ids.includes(row.id)); } } });
async function get(query = '', authorized = true) {
  preferenceReads = 0; locationReads = 0;
  const result = await handler({ method: 'GET', url: `/api/opportunity-radar?lang=TR&limit=20&...route=opportunity-radar${query}`, authorized, query: { view: ['wrong'], route: ['opportunity-radar'] } }, '/api/opportunity-radar');
  assert.ok(preferenceReads <= 1); return result;
}
assert.equal((await get('', false)).status, 401); assert.equal(preferenceReads, 0);
const legacy = await get(); assert.equal(legacy.status, 200); assert.equal(locationReads, 0);
pref = { enabled: false }; assert.deepEqual(await get(), legacy);
for (const value of [null, { enabled: false }]) { pref = value; assert.equal((await get('&view=nearby')).body.error, 'LOCATION_PREFERENCE_REQUIRED'); }
preferenceFailure = true; assert.equal((await get()).body.error, 'RADAR_UNAVAILABLE'); preferenceFailure = false;
pref = preference;
for (const [locations, mode, , included] of cases) {
  catalog = [{ ...make(1), work_mode: mode }]; evidence = new Map([[id(1), locations]]);
  assert.equal((await get('&view=nearby')).body.opportunities.length, included ? 1 : 0);
  assert.equal((await get()).body.opportunities.length, 1, 'Unknown/outside remain in All');
}
pref = { ...preference, include_remote: true }; catalog = [{ ...make(1), work_mode: 'remote' }];
assert.equal((await get('&view=nearby')).body.opportunities.length, 1); pref = preference;
catalog = [make(1)]; evidence = new Map([[id(1), set([inside])]]);
states = [{ opportunity_id: id(1), state: 'dismissed' }];
assert.equal((await get('&view=nearby')).body.opportunities.length, 0);
states[0].state = 'acted_on'; assert.equal((await get('&view=nearby')).body.opportunities[0].current_user_state, 'acted_on');
states[0].state = 'saved'; assert.equal((await get('&state=saved')).body.opportunities.length, 1);
states = []; catalog = Array.from({ length: 301 }, (_, n) => make(n + 1));
evidence = new Map(catalog.map(row => [row.id, set([outside])])); evidence.set(id(301), set([inside]));
const nearby = await get('&view=nearby'); assert.equal(nearby.body.opportunities[0].id, id(301));
assert.equal(nearby.body.meta.ranking_version, 'jobs-location-v1'); assert.equal(nearby.body.meta.candidates_truncated, false);
assert.equal(locationReads, 2, 'One bounded pass before selection and another after hydration');
catalog = Array.from({ length: 301 }, (_, n) => ({ ...make(n + 1), work_mode: n === 300 ? 'onsite' : 'remote' }));
evidence = new Map([[id(301), set([boundary])]]);
assert.equal((await get('&view=nearby')).body.opportunities[0].id, id(301), 'Low-scoring boundary match must not be displaced by 300 higher-scoring remote records excluded from Nearby');
catalog = Array.from({ length: 1000 }, (_, n) => make(n + 1));
assert.equal((await get()).status, 200, 'Enabled preference preserves 1000 bound');
catalog = [make(1)]; evidence = new Map([[id(1), set([inside])]]);
onHydrate = () => evidence.set(id(1), set([outside])); assert.equal((await get('&view=nearby')).body.opportunities.length, 0);
onHydrate = () => { catalog[0].active = false; }; evidence.set(id(1), set([inside]));
assert.equal((await get('&view=nearby')).body.opportunities.length, 0);
onHydrate = () => {}; catalog = [make(1)]; evidenceFailure = true;
assert.equal((await get()).body.error, 'RADAR_UNAVAILABLE'); evidenceFailure = false;
catalog = Array.from({ length: 1001 }, (_, n) => make(n + 1));
assert.equal((await get()).body.error, 'CATALOG_LIMIT_EXCEEDED'); catalog = [make(1)];
for (const query of ['&view=all', '&view=nearby&view=nearby', '&state=saved&view=nearby', '&state=acted_on&view=nearby', '&unknown=x', '&...route=wrong']) assert.equal((await get(query)).body.error, 'INVALID_QUERY');
assert.throws(() => validateListQuery({ view: ['nearby'] }));

const originalFetch = globalThis.fetch;
try {
  const calls = [], headers = async () => ({ Authorization: 'Bearer fixture' });
  const live = { ...make(1), expires_at: '2099-01-01T00:00:00Z', last_verified_at: '2025-01-01T00:00:00Z' };
  for (const filter of ['all', 'saved', 'nearby']) {
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ success: true, opportunities: [{ ...live,
      current_user_state: filter === 'saved' ? 'saved' : null, location_match: { kind: 'same_city', radius_relation: 'unknown', reason: 'reviewed_city_identity' } }] })); };
    assert.equal((await listOpportunities(headers, { filter })).opportunities.length, 1);
    const params = new URL(calls.at(-1).url, 'https://test.invalid').searchParams;
    assert.equal(params.get('view'), filter === 'nearby' ? 'nearby' : null);
    assert.equal(params.get('state'), filter === 'saved' ? 'saved' : null);
    assert.ok([...params.keys()].every(key => ['lang', 'limit', 'state', 'view'].includes(key)));
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'LOCATION_PREFERENCE_REQUIRED' }), { status: 409 });
  await assert.rejects(listOpportunities(headers, { filter: 'nearby' }), e => e.code === 'LOCATION_PREFERENCE_REQUIRED');
  assert.match(radarErrorMessage({ code: 'LOCATION_PREFERENCE_REQUIRED' }), /Konum tercihi gerekiyor/);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, opportunities: [{ ...live, location_match: { kind: 'remote', radius_relation: null, reason: 'remote_opportunity', approximate_distance_km: 8 } }] }));
  await assert.rejects(listOpportunities(headers, { filter: 'nearby' }), e => e.code === 'INVALID_RESPONSE');
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, opportunities: [{ ...live, location_match: { kind: 'unknown', radius_relation: 'unknown', reason: 'location_unknown' } }] }));
  await assert.rejects(listOpportunities(headers, { filter: 'nearby' }), e => e.code === 'INVALID_RESPONSE');
} finally { globalThis.fetch = originalFetch; }
for (const file of ['evaluation.js', 'opportunityLocationPersistence.js']) assert.doesNotMatch(readFileSync(new URL(`../lib/opportunityRadar/location/${file}`, import.meta.url), 'utf8'), /console\.|localStorage|reverseGeocode/);
process.stdout.write('PASS: shared location parity, strict batched repository, complete-set negatives, Nearby before shortlist, preference states, evidence/visibility races, weights/version, query/client/state/privacy contracts.\n');
