import { radarError } from "../validation.js";
import { getPilotPlace } from "./places.js";
import { coarsenBrowserCoordinates } from "./primitives.js";

export const LOCATION_CONSENT_VERSION = "radar-location-v1";
export const LOCATION_PREFERENCE_PATH = "/api/opportunity-radar/location-preference";
export const LOCATION_RADII = Object.freeze([10, 25, 50, 100]);
const common = ["source", "enabled", "radius_km", "include_remote", "consent_version"];
const invalid = () => { throw radarError("INVALID_LOCATION_PREFERENCE"); };

function object(body, keys) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(body, key))) invalid();
}

export function validateLocationPreference(body) {
  const manual = body?.source === "manual";
  object(body, [...common, ...(manual ? ["place_id"] : ["approximate_latitude", "approximate_longitude"])]);
  if (!["manual", "browser"].includes(body.source) || typeof body.enabled !== "boolean" ||
      typeof body.include_remote !== "boolean" || !LOCATION_RADII.includes(body.radius_km) ||
      body.consent_version !== LOCATION_CONSENT_VERSION) invalid();
  const result = { source: body.source, enabled: body.enabled, radius_km: body.radius_km,
    include_remote: body.include_remote, consent_version: LOCATION_CONSENT_VERSION };
  if (manual) {
    const place = getPilotPlace(body.place_id);
    if (!place) invalid();
    return { ...result, place_id: place.place_id, country_code: place.country_code, region: place.region, city: place.city,
      approximate_latitude: place.latitude, approximate_longitude: place.longitude,
      location_precision: place.location_precision, uncertainty_km: place.uncertainty_km };
  }
  let point;
  try { point = coarsenBrowserCoordinates({ latitude: body.approximate_latitude, longitude: body.approximate_longitude }); }
  catch { invalid(); }
  // Grid error alone does not bound device/sensor error. Null is intentional.
  return { ...result, place_id: null, country_code: null, region: null, city: null,
    approximate_latitude: point.latitude, approximate_longitude: point.longitude,
    location_precision: point.location_precision, uncertainty_km: null };
}

export function validateLocationEnabled(body) {
  object(body, ["enabled"]);
  if (typeof body.enabled !== "boolean") invalid();
  return body.enabled;
}

// Strict public projection: no user ID, coordinates, uncertainty or timestamps.
export function projectLocationPreference(row) {
  if (!row || !["manual", "browser"].includes(row.source) || typeof row.enabled !== "boolean" ||
      typeof row.include_remote !== "boolean" || !LOCATION_RADII.includes(row.radius_km)) throw radarError("RADAR_UNAVAILABLE", 503);
  const place = row.source === "manual" ? getPilotPlace(row.place_id) : null;
  if (row.source === "manual" && !place) throw radarError("RADAR_UNAVAILABLE", 503);
  return { source: row.source, place_id: place?.place_id ?? null, country_code: place?.country_code ?? null,
    region: place?.region ?? null, city: place?.city ?? null,
    location_precision: place?.location_precision ?? "grid_0_01_degree",
    radius_km: row.radius_km, include_remote: row.include_remote, enabled: row.enabled };
}
