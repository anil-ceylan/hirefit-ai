import { evaluateOpportunityLocations } from "./primitives.js";

// One projection for numeric matching, Nearby and public explanations. Never
// fall back to unreviewed legacy city strings when the preference is enabled.
export function evaluateLocationMatch(preference, set, workMode) {
  const search = { latitude: preference.approximate_latitude, longitude: preference.approximate_longitude,
    uncertainty_km: preference.uncertainty_km, location_precision: preference.location_precision,
    place_id: preference.place_id, country_code: preference.country_code, city: preference.city };
  const locations = set?.locations || [];
  const evaluation = evaluateOpportunityLocations(search, locations, { radiusKm: preference.radius_km,
    remote: workMode === "remote", locationsComplete: set?.locationsComplete === true });
  // A reviewed same-city positive is also sufficient when coordinates cannot
  // establish distance; other unresolved alternatives do not erase a positive.
  const sameCity = evaluation.results.some(item => item.kind === "same_city");
  const within = evaluation.radius_relation === "within";
  const remote = evaluation.kind === "remote";
  const kind = !within && sameCity ? "same_city" : evaluation.kind;
  const score = remote ? null : within || sameCity ? 1 : evaluation.local_alignment === false ? 0 : null;
  const nearby = remote ? preference.include_remote : within || sameCity || kind === "boundary_uncertain";
  const reasons = { approximate_distance: "approximate_straight_line", same_city: "reviewed_city_identity",
    boundary_uncertain: "radius_boundary_uncertain", outside: "outside_search_radius", remote: "remote_opportunity", unknown: "location_unknown" };
  const metadata = { kind, radius_relation: remote ? null : kind === "same_city" ? "unknown" : evaluation.radius_relation, reason: reasons[kind] };
  // Report only the distance supporting the selected kind, not an arbitrary
  // primary alternative. Rounded to whole km; never expose user coordinates.
  const supporting = evaluation.results.map((value, index) => ({ ...value, precision: locations[index].location_precision }))
    .filter(item => Number.isFinite(item.distance_km) &&
      (within ? item.radius_relation === "within" : kind === "boundary_uncertain" ? item.kind === kind : kind === "outside" ? item.kind === "outside" : kind === "approximate_distance" && item.kind === kind))
    .sort((a, b) => a.distance_km - b.distance_km || a.precision.localeCompare(b.precision));
  if (supporting.length) {
    metadata.approximate_distance_km = Math.round(supporting[0].distance_km);
    metadata.distance_basis = supporting[0].precision === "city_centroid" ? "city_centroid" : "source_point";
  }
  return { signal: { dimension: "location", score, reason: metadata.reason, values: [] }, nearby, metadata };
}
