// Pure, opportunity-type-neutral geometry. No I/O, browser APIs or persistence.
export const EARTH_RADIUS_KM = 6371.0088;
export const MAX_LOCATIONS = 10;

function fail() { throw new Error("INVALID_LOCATION"); }
function number(value, min, max = Number.MAX_VALUE) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail();
  return value;
}
function shape(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail();
}
export function validateCoordinates(point) {
  shape(point, ["latitude", "longitude"]);
  return { latitude: number(point.latitude, -90, 90), longitude: number(point.longitude, -180, 180) };
}

// Call before transmission, then again before storage. This reduces precision,
// NOT anonymity. Never return/spread the browser Position object or raw samples.
// Rounding alone can displace a point by ~0.8 km; sensor uncertainty is additional.
export function coarsenBrowserCoordinates(point) {
  const { latitude, longitude } = validateCoordinates(point);
  const round = value => Number(value.toFixed(2)) || 0;
  return { latitude: round(latitude), longitude: round(longitude), location_precision: "grid_0_01_degree" };
}

export function haversineKm(first, second) {
  const a = validateCoordinates(first), b = validateCoordinates(second);
  const rad = degrees => degrees * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function radiusRelation(distanceKm, radiusKm, uncertaintyKm = null) {
  number(distanceKm, 0); number(radiusKm, 0);
  if (uncertaintyKm === null) return "unknown";
  number(uncertaintyKm, 0);
  if (distanceKm + uncertaintyKm <= radiusKm) return "within";
  if (Math.max(0, distanceKm - uncertaintyKm) > radiusKm) return "outside";
  return "boundary_uncertain";
}

// Strict projected evidence, not raw ATS/user objects. Unknown uncertainty is
// explicitly null, never silently zero. place_id means a reviewed canonical ID.
export function validateLocationEvidence(value) {
  shape(value, ["latitude", "longitude", "location_precision", "uncertainty_km", "place_id", "country_code", "city"]);
  const latitude = value.latitude ?? null, longitude = value.longitude ?? null;
  if ((latitude === null) !== (longitude === null)) fail();
  if (latitude !== null) validateCoordinates({ latitude, longitude });
  const precision = value.location_precision ?? "city_only";
  if (!["grid_0_01_degree", "city_centroid", "city_only", "source_point"].includes(precision)) fail();
  if ((precision === "city_only") !== (latitude === null)) fail();
  if (precision === "grid_0_01_degree" && (Number(latitude.toFixed(2)) !== latitude || Number(longitude.toFixed(2)) !== longitude)) fail();
  const uncertainty = value.uncertainty_km ?? null;
  if (uncertainty !== null) number(uncertainty, 0);
  for (const field of ["place_id", "country_code", "city"]) {
    if (value[field] != null && (typeof value[field] !== "string" || !value[field].trim() || value[field].length > 160)) fail();
  }
  if (value.country_code != null && !/^[A-Z]{2}$/.test(value.country_code)) fail();
  return { latitude, longitude, location_precision: precision, uncertainty_km: uncertainty,
    place_id: value.place_id ?? null, country_code: value.country_code ?? null, city: value.city ?? null };
}

export function evaluateLocation(search, location, radiusKm) {
  const a = validateLocationEvidence(search), b = validateLocationEvidence(location);
  number(radiusKm, 0);
  // Reviewed global place identity is sufficient when country is unasserted.
  // Explicit conflicting country evidence still prevents a same-city claim.
  const sameCity = Boolean(a.place_id && a.place_id === b.place_id &&
    (!a.country_code || !b.country_code || a.country_code === b.country_code));
  if (a.latitude !== null && b.latitude !== null) {
    const distance = haversineKm({ latitude: a.latitude, longitude: a.longitude }, { latitude: b.latitude, longitude: b.longitude });
    const uncertainty = a.uncertainty_km === null || b.uncertainty_km === null ? null : a.uncertainty_km + b.uncertainty_km;
    const relation = radiusRelation(distance, radiusKm, uncertainty);
    return { kind: relation === "outside" ? "outside" : relation === "boundary_uncertain" ? "boundary_uncertain" : "approximate_distance",
      distance_km: distance, radius_relation: relation, same_city: sameCity };
  }
  return { kind: sameCity ? "same_city" : "unknown", distance_km: null, radius_relation: "unknown", same_city: sameCity };
}

export function evaluateOpportunityLocations(search, locations, { radiusKm, remote = false, locationsComplete = false } = {}) {
  validateLocationEvidence(search); number(radiusKm, 0);
  if (!Array.isArray(locations) || locations.length > MAX_LOCATIONS || typeof remote !== "boolean" || typeof locationsComplete !== "boolean") fail();
  const results = locations.map(location => evaluateLocation(search, location, radiusKm));
  // Remote is explicitly supplied evidence, not inferred from multiple places.
  if (remote) return { kind: "remote", radius_relation: "unknown", local_alignment: null, results: [] };
  if (results.some(item => item.radius_relation === "within")) return { kind: "approximate_distance", radius_relation: "within", local_alignment: true, results };
  if (locationsComplete && results.length && results.every(item => item.radius_relation === "outside")) return { kind: "outside", radius_relation: "outside", local_alignment: false, results };
  if (results.some(item => item.kind === "same_city")) return { kind: "same_city", radius_relation: "unknown", local_alignment: null, results };
  if (results.some(item => item.radius_relation === "boundary_uncertain")) return { kind: "boundary_uncertain", radius_relation: "boundary_uncertain", local_alignment: null, results };
  return { kind: results.some(item => item.kind === "approximate_distance") ? "approximate_distance" : "unknown", radius_relation: "unknown", local_alignment: null, results };
}
