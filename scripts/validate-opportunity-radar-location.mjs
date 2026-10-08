import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coarsenBrowserCoordinates, validateCoordinates, haversineKm, radiusRelation, evaluateLocation, evaluateOpportunityLocations, validateLocationEvidence } from '../lib/opportunityRadar/location/primitives.js';
import { PILOT_PLACES, getPilotPlace, resolvePilotPlaceAlias, PLACE_CATALOG_VERSION } from '../lib/opportunityRadar/location/places.js';

const point = (latitude, longitude) => ({ latitude, longitude });
assert.deepEqual(coarsenBrowserCoordinates(point(0, -0)), { latitude: 0, longitude: 0, location_precision: 'grid_0_01_degree' });
assert.deepEqual(coarsenBrowserCoordinates(point(-12.34567, 45.67891)), { latitude: -12.35, longitude: 45.68, location_precision: 'grid_0_01_degree' });
for (const p of [point(-90, -180), point(90, 180), point(0, 0)]) assert.deepEqual(validateCoordinates(p), p);
for (const p of [point(91, 0), point(-91, 0), point(0, 181), point(0, -181), point(NaN, 0), point(0, Infinity), point(-Infinity, 0), point('0', 0), { ...point(0, 0), address: 'forbidden' }]) assert.throws(() => coarsenBrowserCoordinates(p));
const raw = Object.freeze(point(12.345678, 23.456789));
assert.ok(!JSON.stringify(coarsenBrowserCoordinates(raw)).includes('345678'));
assert.equal(raw.latitude, 12.345678);
assert.equal(haversineKm(raw, raw), 0);
assert.ok(Math.abs(haversineKm(point(0, 0), point(0, 1)) - 111.1950802335329) < 1e-9);
assert.ok(haversineKm(point(0, 179.9), point(0, -179.9)) < 23);
assert.ok(haversineKm(point(89.99, 0), point(89.99, 180)) < 3);
assert.equal(haversineKm(raw, point(-30, -70)), haversineKm(point(-30, -70), raw));
for (const [d, r, u, expected] of [[8, 10, 1, 'within'], [10, 10, 0, 'within'], [9, 10, 1, 'within'], [10, 10, 1, 'boundary_uncertain'], [11, 10, 1, 'boundary_uncertain'], [12, 10, 1, 'outside'], [1, 10, null, 'unknown']]) assert.equal(radiusRelation(d, r, u), expected);
assert.throws(() => radiusRelation(1, 10, NaN));
assert.throws(() => radiusRelation(1, -1, 0));
const evidence = (latitude, longitude, uncertainty_km = 0) => ({ latitude, longitude, uncertainty_km, location_precision: 'source_point' });
const search = Object.freeze(evidence(0, 0, 1));
const inside = evidence(0, 0.01), outside = evidence(10, 10);
const evaluate = (rows, extra = {}) => evaluateOpportunityLocations(search, rows, { radiusKm: 10, locationsComplete: true, ...extra });
assert.equal(evaluate([outside, inside]).local_alignment, true);
assert.equal(evaluate([inside, outside]).local_alignment, true);
assert.equal(evaluate([outside]).local_alignment, false);
assert.equal(evaluate([outside, {}]).local_alignment, null);
assert.equal(evaluate([outside], { locationsComplete: false }).local_alignment, null);
assert.equal(evaluate([]).kind, 'unknown');
assert.equal(evaluate([inside], { remote: true }).kind, 'remote');
assert.equal(evaluate([inside], { remote: true }).local_alignment, null);
const city = { place_id: 'hf:de:berlin', country_code: 'DE', city: 'Berlin' };
assert.equal(evaluateLocation(city, city, 10).kind, 'same_city');
assert.equal(evaluateOpportunityLocations(city, [city], { radiusKm: 10 }).kind, 'same_city');
assert.equal(evaluateOpportunityLocations(city, [city], { radiusKm: 10 }).radius_relation, 'unknown');
assert.equal(evaluateLocation(city, { ...city, country_code: 'US' }, 10).kind, 'unknown');
assert.equal(evaluateLocation(city, {}, 10).kind, 'unknown');
const centroid = { ...evidence(0, 0, null), location_precision: 'city_centroid' };
assert.equal(evaluate([centroid]).kind, 'approximate_distance');
assert.equal(evaluate([centroid]).radius_relation, 'unknown');
assert.equal(evaluate([{ ...centroid, uncertainty_km: 1 }]).radius_relation, 'within');
assert.equal(evaluateLocation(search, evidence(0, 0.09), 10).kind, 'boundary_uncertain');
assert.throws(() => evaluate(Array(11).fill(inside)));
for (const invalid of [{ address: 'forbidden' }, { latitude: 0 }, { ...inside, uncertainty_km: Infinity }, { ...inside, location_precision: 'city_only' }, { ...inside, location_precision: 'grid_0_01_degree', latitude: 0.001 }]) assert.throws(() => validateLocationEvidence(invalid));
const snapshot = JSON.stringify([search, inside, outside]); evaluate([inside, outside]);
assert.equal(JSON.stringify([search, inside, outside]), snapshot);
assert.equal(new Set(PILOT_PLACES.map(p => p.place_id)).size, PILOT_PLACES.length);
for (const place of PILOT_PLACES) {
  assert.equal(place.catalog_version, PLACE_CATALOG_VERSION);
  assert.equal(place.latitude, null); assert.equal(place.longitude, null);
  assert.equal(place.location_precision, 'city_only'); assert.equal(place.uncertainty_km, null);
  assert.equal(getPilotPlace(place.place_id), place); assert.ok(Object.isFrozen(place));
}
assert.equal(getPilotPlace('unknown'), null);
assert.equal(PILOT_PLACES.length, 6);
const projection = place => ({ place_id: place.place_id, country_code: place.country_code, city: place.city });
for (const place of PILOT_PLACES) {
  for (const alias of [...place.aliases, place.names.TR, place.names.EN]) {
    assert.equal(resolvePilotPlaceAlias(alias)?.place_id, place.place_id);
    assert.equal(resolvePilotPlaceAlias(` ${alias.toUpperCase()} `)?.place_id, place.place_id);
  }
  assert.equal(getPilotPlace(place.names.TR), null, 'Display strings cannot substitute for stable IDs');
  const tr = projection(place), en = { ...tr, city: place.names.EN };
  assert.equal(evaluateLocation(tr, en, 25).kind, 'same_city');
  assert.equal(evaluateLocation(tr, en, 25).radius_relation, 'unknown');
  assert.equal(evaluateOpportunityLocations(tr, [en], { radiusKm: 25 }).kind, 'same_city');
}
for (const place of PILOT_PLACES.slice(0, 3)) {
  assert.equal(place.country_code, null);
  assert.equal(validateLocationEvidence(projection(place)).country_code, null);
  assert.equal(resolvePilotPlaceAlias(place.names.EN, { country_code: 'CY' }), null);
  assert.equal(resolvePilotPlaceAlias(place.names.EN, { country_code: null }), place);
}
const nicosia = getPilotPlace('hf:place:0002');
const similarlyNamed = { ...nicosia, place_id: 'fixture:distinct-place', country_code: 'IT', region: 'fixture-region' };
const ambiguousCatalog = [nicosia, similarlyNamed];
assert.equal(resolvePilotPlaceAlias('Nicosia', {}, ambiguousCatalog), null, 'Never choose the first homonym');
assert.equal(resolvePilotPlaceAlias('Nicosia', { place_id: nicosia.place_id }, ambiguousCatalog), nicosia);
assert.equal(resolvePilotPlaceAlias('Nicosia', { region: 'fixture-region' }, ambiguousCatalog), similarlyNamed);
assert.equal(evaluateLocation(projection(nicosia), projection(similarlyNamed), 25).kind, 'unknown');
assert.equal(evaluateLocation(projection(nicosia), { city: nicosia.city }, 25).kind, 'unknown');
assert.equal(resolvePilotPlaceAlias('Nicos'), null);
assert.equal(resolvePilotPlaceAlias('unknown'), null);
assert.equal(resolvePilotPlaceAlias('Nicosia', { address: 'not allowed' }), null);
const source = readFileSync(new URL('../lib/opportunityRadar/location/primitives.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /console\.|fetch\(|localStorage|supabase|watchPosition/);
process.stdout.write('PASS: location coordinates/privacy, geometry, uncertainty, multi-location, remote, strict evidence, immutable pilot vocabulary.\n');
