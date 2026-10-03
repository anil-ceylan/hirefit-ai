import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { opportunityFixtures } from './fixtures/opportunity-radar.mjs';
import { createOpportunityRepository, COMPACT_COLUMNS } from '../lib/opportunityRadar/persistence.js';
import { createOpportunityRadarHandler } from '../lib/opportunityRadar/routes.js';
import { evaluateOpportunity, profileContext, rankOpportunity, sortRankedOpportunities } from '../lib/opportunityRadar/ranking.js';

const now = new Date('2030-01-01T00:00:00Z');
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const make = n => ({ ...opportunityFixtures[0], id: id(n), source_type: 'employer', published: true, active: true,
  verification_status: 'verified', last_verified_at: '2029-12-31T00:00:00Z', expires_at: '2030-02-01T00:00:00Z',
  role_tags: ['software_engineer'], description: 'Full description should only be hydrated after selection' });
let catalog = Array.from({ length: 301 }, (_, i) => make(i + 1));
catalog[300] = { ...catalog[300], role_tags: ['data_analyst'], last_verified_at: '2029-12-01T00:00:00Z' };
let stateRows = [{ user_id: 'A', opportunity_id: id(301), state: 'saved' }, { user_id: 'B', opportunity_id: id(301), state: 'dismissed' }];
let profile = { career_goals: { targetRoles: ['data_analyst'] } };
const calls = [];
let onHydrate = () => {};
// Execute the real repository with an in-memory PostgREST query double.
const client = { from(table) {
  let columns, limit = Infinity; const filters = []; const predicates = [];
  const q = {
    select(value) { columns = value; return q; },
    eq(k, v) { filters.push([k, v]); if (!k.includes('.')) predicates.push(r => r[k] === v); return q; },
    in(k, v) { predicates.push(r => v.includes(r[k])); return q; },
    lte(k, v) { predicates.push(r => r[k] != null && r[k] <= v); return q; },
    gt(k, v) { predicates.push(r => r[k] != null && r[k] > v); return q; },
    or(expression) { const [field] = expression.split('.'); const timestamp = expression.split('.gt.')[1]; predicates.push(r => r[field] == null || r[field] > timestamp); return q; },
    order(k, options) { assert.equal(k, 'id'); assert.equal(options.ascending, true); return q; },
    limit(n) { limit = n; return q; },
    then(resolve, reject) { return Promise.resolve().then(() => {
      const full = table === 'opportunities' && columns.includes('description');
      if (full) onHydrate();
      let rows = (table === 'opportunities' ? catalog : stateRows).filter(r => predicates.every(p => p(r)));
      if (columns.includes('!inner')) {
        const user = filters.find(([k]) => k === 'opportunity_user_states.user_id')?.[1];
        const state = filters.find(([k]) => k === 'opportunity_user_states.state')?.[1];
        assert.ok(user && state);
        rows = rows.filter(r => stateRows.some(s => s.user_id === user && s.state === state && s.opportunity_id === r.id));
      }
      rows = [...rows].sort((a, b) => (a.id || '').localeCompare(b.id || '')).slice(0, Math.min(limit, 137)); // server page cap below requested size
      calls.push({ table, columns, count: rows.length, full });
      const selected = columns.split(',').filter(k => !k.includes('!'));
      return { data: rows.map(r => Object.fromEntries(selected.filter(k => k in r).map(k => [k, r[k]]))), error: null };
    }).then(resolve, reject); },
  }; return q;
} };
const repository = createOpportunityRepository(() => client);
const handler = createOpportunityRadarHandler({ repository, clock: () => now,
  authenticate: async req => ({ ok: true, user: { id: req.user } }), loadProfile: async () => profile });
const get = (user = 'A', query = '') => handler({ method: 'GET', url: `/api/opportunity-radar${query}`, user }, '/api/opportunity-radar');
let result = await get();
assert.equal(result.status, 200);
assert.equal(result.body.opportunities[0].id, id(301), 'Older strong match beyond former 200 window');
assert.equal(result.body.meta.candidate_limit, 200);
assert.equal(result.body.meta.candidates_truncated, true);
assert.ok(calls.filter(c => c.full).reduce((n, c) => n + c.count, 0) <= 200);
assert.ok(!COMPACT_COLUMNS.includes('description'));
assert.equal((await get('A', '?state=saved')).body.opportunities[0].id, id(301));
assert.ok(!(await get('B')).body.opportunities.some(r => r.id === id(301)));
assert.equal((await get('B', '?state=dismissed')).body.opportunities[0].id, id(301));
stateRows[0].state = 'acted_on';
assert.equal((await get()).body.opportunities[0].current_user_state, 'acted_on');
assert.equal((await get('A', '?state=acted_on')).body.opportunities[0].id, id(301));
profile = { career_goals: { targetRoles: ['software_engineer'] } };
assert.equal((await get()).body.opportunities[0].id, id(1));
const compact = row => Object.fromEntries(COMPACT_COLUMNS.split(',').map(k => [k, row[k]]));
for (const p of [{}, profile, { skills: ['SQL'] }, { career_goals: { workMode: ['flexible'], targetCountries: ['DE'], lookingFor: ['internship'] } }]) {
  for (const row of [catalog[0], catalog[300], { ...catalog[0], role_tags: [], sector_tags: [], skill_tags: [], country: null, city: null, work_mode: null, requirements: {} }]) {
    const numeric = evaluateOpportunity(compact(row), profileContext(p)); const detailed = rankOpportunity(row, p, null, { now });
    assert.equal(numeric.match_score, detailed.match_score);
    assert.equal(numeric.alignment_coverage, detailed.alignment_coverage);
  }
}
assert.deepEqual(sortRankedOpportunities([id(2), id(1)].map(value => ({ id: value, match_score: null, alignment_coverage: 0 }))).map(r => r.id), [id(1), id(2)]);
catalog = [{ ...make(1), role_tags: [], sector_tags: [], skill_tags: [], country: null, city: null, work_mode: null, requirements: {} }];
profile = {};
assert.equal((await get()).body.opportunities[0].match_score, null);
for (const patch of [{ active: false }, { published: false }, { verification_status: 'unverified' }, { source_type: 'fixture' }, { expires_at: now.toISOString() }, { deadline_at: now.toISOString() }, { ends_at: now.toISOString() }]) {
  catalog = [{ ...make(1), ...patch }]; assert.equal((await get()).body.opportunities.length, 0);
}
catalog = [make(1)]; onHydrate = () => { catalog[0].active = false; };
assert.equal((await get()).body.opportunities.length, 0, 'Visibility changed after shortlist');
onHydrate = () => {}; catalog = Array.from({ length: 1000 }, (_, i) => make(i + 1));
const start = performance.now();
assert.equal((await get()).status, 200);
const elapsed = performance.now() - start;
catalog.push(make(1001));
result = await get();
assert.equal(result.status, 503);
assert.equal(result.body.error, 'CATALOG_LIMIT_EXCEEDED');
assert.equal(result.body.opportunities, undefined);
process.stdout.write(`PASS: compact retrieval, keyset batching, state isolation, parity, visibility races and 1000/1001 boundary; in-memory 1000-row request ${elapsed.toFixed(1)}ms.\n`);
