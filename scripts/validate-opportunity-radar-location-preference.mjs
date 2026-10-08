import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { createOpportunityRadarHandler } from "../lib/opportunityRadar/routes.js";
import { createLocationPreferenceRepository } from "../lib/opportunityRadar/location/preferencePersistence.js";
import { LOCATION_CONSENT_VERSION, LOCATION_PREFERENCE_PATH as path, validateLocationPreference } from "../lib/opportunityRadar/location/preferenceValidation.js";
import { PILOT_PLACES } from "../lib/opportunityRadar/location/places.js";
import { locationDatabaseFixture } from "./fixtures/opportunity-location-repository.mjs";

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = new Date("2030-01-01T00:00:00Z");
const db = locationDatabaseFixture();
const repository = createLocationPreferenceRepository(() => db.client, () => now);
const authenticate = async req => req.owner ? { ok: true, user: { id: req.owner } } : { ok: false, status: 401 };
const handle = createOpportunityRadarHandler({ authenticate, locationRepository: repository,
  loadProfile: async () => { throw new Error("Preference must not require a profile"); } });
const invoke = (method, body, owner = a, extra = {}) => handle({ method, url: path, owner, body, ...extra }, path);
const manual = { source: "manual", place_id: PILOT_PLACES[0].place_id, enabled: true, radius_km: 25, include_remote: false, consent_version: LOCATION_CONSENT_VERSION };
const browser = { source: "browser", approximate_latitude: 41.01234567, approximate_longitude: 28.98765432, enabled: true, radius_km: 10, include_remote: true, consent_version: LOCATION_CONSENT_VERSION };
for (const method of ["GET", "PUT", "PATCH", "DELETE"]) assert.equal((await invoke(method, manual, null)).status, 401);
assert.equal(db.calls.length, 0);
assert.deepEqual((await invoke("GET")).body, { success: true, preference: null });
for (const place of PILOT_PLACES) {
  const response = await invoke("PUT", { ...manual, place_id: place.place_id });
  assert.equal(response.status, 200);
  assert.equal(response.body.preference.city, place.city);
  assert.equal(response.body.preference.country_code, place.country_code);
  assert.equal(response.body.preference.place_id, place.place_id);
  const row = db.rows.get(a);
  assert.equal(row.consented_at, now.toISOString());
  assert.equal(row.user_id, a);
  assert.equal(row.approximate_latitude, null);
  for (const alias of [place.names.TR, place.names.EN]) assert.throws(() => validateLocationPreference({ ...manual, place_id: alias }));
}
await invoke("PUT", manual, b);
const bBefore = structuredClone(db.rows.get(b));
const result = await invoke("PUT", browser);
assert.equal(result.status, 200);
assert.equal(result.body.preference.city, null);
assert.ok(!JSON.stringify(result).includes("latitude"));
assert.ok(!JSON.stringify(result).includes(a));
assert.equal(db.rows.get(a).approximate_latitude, 41.01);
assert.equal(db.rows.get(a).approximate_longitude, 28.99);
assert.equal(db.rows.get(a).uncertainty_km, null);
assert.equal(db.rows.get(a).country_code, null);
assert.ok(!JSON.stringify(db.calls).includes("01234567"));
for (const enabled of [false, true]) {
  assert.equal((await invoke("PATCH", { enabled })).body.preference.enabled, enabled);
  assert.equal(db.rows.get(a).consented_at, now.toISOString());
}
assert.equal((await invoke("GET", undefined, b)).body.preference.source, "manual");
assert.deepEqual((await invoke("DELETE")).body, { success: true, removed: true });
assert.deepEqual((await invoke("DELETE")).body, { success: true, removed: true });
assert.equal((await invoke("PATCH", { enabled: true })).body.error, "LOCATION_PREFERENCE_NOT_FOUND");
assert.deepEqual(db.rows.get(b), bBefore);
for (const field of ["user_id", "country_code", "region", "city", "location_precision", "uncertainty_km", "created_at", "updated_at", "consented_at", "metadata", "address", "street", "postal_code", "history"]) {
  for (const base of [manual, browser]) {
    const before = db.calls.length;
    assert.equal((await invoke("PUT", { ...base, [field]: b })).body.error, "INVALID_LOCATION_PREFERENCE");
    assert.equal(db.calls.length, before);
  }
}
for (const input of [[], null, {}, { ...manual, place_id: "unknown" }, { ...manual, radius_km: 11 }, { ...manual, radius_km: "25" },
  { ...manual, enabled: "true" }, { ...manual, include_remote: 0 }, { ...manual, consent_version: "unsupported" },
  { ...manual, approximate_latitude: 0 }, { ...browser, place_id: manual.place_id }]) assert.equal((await invoke("PUT", input)).body.error, "INVALID_LOCATION_PREFERENCE");
for (const coordinates of [{ approximate_latitude: NaN }, { approximate_longitude: Infinity }, { approximate_latitude: 91 },
  { approximate_longitude: -181 }, { approximate_latitude: "0" }]) {
  assert.throws(() => validateLocationPreference({ ...browser, ...coordinates }));
  assert.equal((await invoke("PUT", { ...browser, ...coordinates })).body.error, "INVALID_LOCATION_PREFERENCE");
}
for (const input of [[], {}, { enabled: null }, { enabled: true, user_id: b }, { enabled: false, radius_km: 10 }]) assert.equal((await invoke("PATCH", input)).body.error, "INVALID_LOCATION_PREFERENCE");
assert.equal((await invoke("PUT", "{")).body.error, "INVALID_JSON");
assert.equal((await invoke("PUT", "x".repeat(2049))).body.error, "INPUT_TOO_LARGE");
const stream = Readable.from([JSON.stringify(manual)]);
Object.assign(stream, { method: "PUT", owner: a, url: path });
assert.equal((await handle(stream, path)).status, 200);
const oversized = Readable.from([Buffer.alloc(1024), Buffer.alloc(1025)]);
Object.assign(oversized, { method: "PUT", owner: a, url: path });
assert.equal((await handle(oversized, path)).body.error, "INPUT_TOO_LARGE");
assert.equal((await invoke("POST")).body.error, "METHOD_NOT_ALLOWED");
assert.equal((await handle({ owner: a, method: "GET" }, path + "/invalid")).body.error, "NOT_FOUND");
for (const [operation, method, body] of [["get", "GET"], ["upsert", "PUT", manual], ["setEnabled", "PATCH", { enabled: false }], ["remove", "DELETE"]]) {
  for (const thrown of [false, true]) {
    db.fail = operation; db.thrown = thrown;
    const before = JSON.stringify([...db.rows]);
    assert.deepEqual(await invoke(method, body), { status: 503, body: { success: false, error: "RADAR_UNAVAILABLE" } });
    assert.equal(JSON.stringify([...db.rows]), before);
  }
}
db.fail = null;
for (const action of [() => repository.get(null), () => repository.upsert(null, manual), () => repository.setEnabled(null, true), () => repository.remove(null)]) await assert.rejects(action, error => error.code === "AUTH_REQUIRED");
await repository.upsert(a, { ...validateLocationPreference(manual), user_id: b, city: "forged", created_at: "forged" });
assert.equal(db.rows.get(a).city, PILOT_PLACES[0].city);
assert.equal(db.rows.get(a).created_at, undefined);
// Slice 3 loads preference once; absent preference preserves legacy All/Saved.
let preferenceReads = 0;
const oldFeed = createOpportunityRadarHandler({ authenticate, loadProfile: async () => ({}),
  repository: { list: async () => ({ opportunities: [] }), states: async () => [], hydrate: async () => [] },
  locationRepository: { getForEvaluation: async () => { preferenceReads++; return null; } } });
for (const state of ["", "&state=saved"]) assert.equal((await oldFeed({ owner: a, method: "GET", url: `/api/opportunity-radar?lang=TR&limit=20&...route=opportunity-radar${state}`, query: { lang: ["wrong"] } }, "/api/opportunity-radar")).status, 200);
assert.equal(preferenceReads, 2);
assert.equal((await repository.getForEvaluation(a)).place_id, manual.place_id);
await repository.setEnabled(a, false);
assert.deepEqual(await repository.getForEvaluation(a), { enabled: false });
await repository.remove(a);
assert.equal(await repository.getForEvaluation(a), null);
await repository.upsert(a, validateLocationPreference(browser));
assert.equal((await repository.getForEvaluation(a)).approximate_latitude, 41.01);
db.fail = 'get';
await assert.rejects(repository.getForEvaluation(a), error => error.code === 'RADAR_UNAVAILABLE');
db.fail = null;
for (const file of ["preferenceValidation.js", "preferencePersistence.js"]) {
  const source = readFileSync(new URL(`../lib/opportunityRadar/location/${file}`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.|localStorage|watchPosition|reverseGeocode/);
}
process.stdout.write("PASS: preference validation, reviewed places, coarsening/privacy, owner-scoped real repository CRUD, safe failures, bounded bodies and unchanged All/Saved.\n");
