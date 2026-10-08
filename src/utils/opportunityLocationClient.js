import { requestOpportunityRadar } from "./opportunityRadarClient.js";
import { LOCATION_PREFERENCE_PATH, validateLocationPreference, validateLocationEnabled, projectLocationPreference } from "../../lib/opportunityRadar/location/preferenceValidation.js";

const invalid = () => { throw Object.assign(new Error("INVALID_RESPONSE"), { code: "INVALID_RESPONSE" }); };
async function request(getHeaders, options) {
  try { return await requestOpportunityRadar(LOCATION_PREFERENCE_PATH, getHeaders, options); }
  catch (error) {
    const codes = ["AUTH_REQUIRED", "INVALID_LOCATION_PREFERENCE", "INVALID_JSON", "INPUT_TOO_LARGE",
      "LOCATION_PREFERENCE_NOT_FOUND", "METHOD_NOT_ALLOWED", "NOT_FOUND", "TIMEOUT", "CANCELLED"];
    const code = codes.includes(error?.code) ? error.code : "RADAR_UNAVAILABLE";
    throw Object.assign(new Error(code), { code });
  }
}
function readPreference(body, nullable = false) {
  if (body.preference === null && nullable) return null;
  let projected;
  try { projected = projectLocationPreference(body.preference); } catch { invalid(); }
  const value = body.preference;
  if (Object.keys(value).length !== Object.keys(projected).length ||
      Object.entries(projected).some(([key, expected]) => value[key] !== expected)) invalid();
  return projected;
}

export async function getLocationPreference(getHeaders, settings = {}) {
  return readPreference(await request(getHeaders, { ...settings, method: "GET" }), true);
}

export async function saveLocationPreference(getHeaders, input, settings = {}) {
  // Reject extras locally too; browser coordinates are coarsened BEFORE sending.
  // Server independently validates/coarsens; no client storage or location APIs.
  const normalized = validateLocationPreference(input);
  const body = { source: normalized.source, enabled: normalized.enabled, radius_km: normalized.radius_km,
    include_remote: normalized.include_remote, consent_version: normalized.consent_version };
  if (body.source === "manual") body.place_id = normalized.place_id;
  else { body.approximate_latitude = normalized.approximate_latitude; body.approximate_longitude = normalized.approximate_longitude; }
  return readPreference(await request(getHeaders,
    { ...settings, method: "PUT", body: JSON.stringify(body) }));
}

export async function setLocationPreferenceEnabled(getHeaders, enabled, settings = {}) {
  validateLocationEnabled({ enabled });
  const preference = readPreference(await request(getHeaders,
    { ...settings, method: "PATCH", body: JSON.stringify({ enabled }) }));
  if (preference.enabled !== enabled) invalid();
  return preference;
}

export async function deleteLocationPreference(getHeaders, settings = {}) {
  const result = await request(getHeaders, { ...settings, method: "DELETE" });
  if (result.removed !== true) invalid();
  return { removed: true };
}
