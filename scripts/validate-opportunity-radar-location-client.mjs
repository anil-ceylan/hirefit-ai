import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getLocationPreference, saveLocationPreference, setLocationPreferenceEnabled, deleteLocationPreference } from "../src/utils/opportunityLocationClient.js";
import { LOCATION_CONSENT_VERSION, LOCATION_PREFERENCE_PATH, validateLocationPreference, projectLocationPreference } from "../lib/opportunityRadar/location/preferenceValidation.js";
const original = globalThis.fetch;
const calls = [];
const auth = async options => { assert.equal(options.requireSession, true); return { Authorization: "Bearer fixture" }; };
const manual = { source: "manual", place_id: "hf:place:0001", radius_km: 25, include_remote: false, enabled: true, consent_version: LOCATION_CONSENT_VERSION };
const browser = { source: "browser", approximate_latitude: 41.0123456, approximate_longitude: 28.9876543, radius_km: 25, include_remote: false, enabled: true, consent_version: LOCATION_CONSENT_VERSION };
const safe = projectLocationPreference(validateLocationPreference(manual));
function respond(body, status = 200) {
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(body), { status }); };
}
try {
  respond({ success: true, preference: null }); assert.equal(await getLocationPreference(auth), null);
  for (const input of [manual, browser]) {
    const projected = projectLocationPreference(validateLocationPreference(input));
    respond({ success: true, preference: projected });
    assert.deepEqual(await saveLocationPreference(auth, input), projected);
    assert.equal(calls.at(-1).options.method, "PUT");
    const sent = JSON.parse(calls.at(-1).options.body);
    if (input.source === "browser") {
      assert.equal(sent.approximate_latitude, 41.01); assert.equal(sent.approximate_longitude, 28.99);
      assert.ok(!calls.at(-1).options.body.includes("0123456"));
    } else assert.deepEqual(sent, manual);
  }
  respond({ success: true, preference: { ...safe, enabled: false } });
  assert.equal((await setLocationPreferenceEnabled(auth, false)).enabled, false);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { enabled: false });
  respond({ success: true, removed: true }); assert.deepEqual(await deleteLocationPreference(auth), { removed: true });
  assert.equal(calls.at(-1).options.method, "DELETE");
  for (const call of calls) {
    assert.ok(call.url.endsWith(LOCATION_PREFERENCE_PATH)); assert.ok(!call.url.includes("?"));
    assert.equal(call.options.headers.Authorization, "Bearer fixture");
  }
  for (const preference of [undefined, [], { ...safe, user_id: "secret" }, { ...safe, approximate_latitude: 0 }, { ...safe, city: "forged" }, { ...safe, enabled: "true" }]) {
    respond({ success: true, preference });
    await assert.rejects(getLocationPreference(auth), error => error.code === "INVALID_RESPONSE");
  }
  respond({ success: true, preference: null });
  await assert.rejects(saveLocationPreference(auth, manual), error => error.code === "INVALID_RESPONSE");
  respond({ success: true, removed: false });
  await assert.rejects(deleteLocationPreference(auth), error => error.code === "INVALID_RESPONSE");
  for (const [status, code] of [[401, "AUTH_REQUIRED"], [400, "INVALID_LOCATION_PREFERENCE"], [404, "LOCATION_PREFERENCE_NOT_FOUND"], [413, "INPUT_TOO_LARGE"], [405, "METHOD_NOT_ALLOWED"]]) {
    respond({ error: code }, status);
    await assert.rejects(getLocationPreference(auth), error => error.code === code);
  }
  respond({ error: "private SQL details" }, 503);
  await assert.rejects(getLocationPreference(auth), error => error.code === "RADAR_UNAVAILABLE" && !error.message.includes("private"));
  globalThis.fetch = async () => { throw new Error("private network details"); };
  await assert.rejects(getLocationPreference(auth), error => error.code === "RADAR_UNAVAILABLE" && error.message === "RADAR_UNAVAILABLE");
  await assert.rejects(getLocationPreference(async () => { throw new Error("private session details"); }), error => error.message === "RADAR_UNAVAILABLE");
  let count = 0;
  globalThis.fetch = async () => { count++; return new Promise(() => {}); };
  await assert.rejects(getLocationPreference(auth, { timeoutMs: 10 }), error => error.code === "TIMEOUT");
  await assert.rejects(getLocationPreference(() => new Promise(() => {}), { timeoutMs: 10 }), error => error.code === "TIMEOUT");
  const controller = new AbortController(); controller.abort(); const before = count;
  await assert.rejects(getLocationPreference(auth, { signal: controller.signal }), error => error.code === "CANCELLED");
  assert.equal(count, before);
  assert.doesNotMatch(readFileSync(new URL('../src/utils/opportunityLocationClient.js', import.meta.url), 'utf8'), /localStorage|console\.|URLSearchParams/);
  process.stdout.write("PASS: location client auth, safe response validation, coarsened bodies, CRUD, errors, timeout and cancellation; no coordinate URLs/storage.\n");
} finally { globalThis.fetch = original; }
