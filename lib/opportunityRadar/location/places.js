import { resolveCountryCode } from "../../../src/data/locationData.js";

export const PLACE_CATALOG_VERSION = "pilot-city-only-v2";
// Opaque permanent identities, not country/jurisdiction or language encodings.
// Cyprus-related entries deliberately bypass the existing CY display convention.
// Null country is unknown/not asserted, never a legal or eligibility conclusion.
// These are city labels, not reviewed boundaries, provinces or precise points.
export const PILOT_PLACES = Object.freeze([
  { place_id: "hf:place:0001", country_code: null, region: null, city: "Gazimağusa", names: { TR: "Gazimağusa", EN: "Famagusta" }, aliases: ["Gazimağusa", "Gazimagusa", "Famagusta"] },
  { place_id: "hf:place:0002", country_code: null, region: null, city: "Lefkoşa", names: { TR: "Lefkoşa", EN: "Nicosia" }, aliases: ["Lefkoşa", "Lefkosa", "Nicosia"] },
  { place_id: "hf:place:0003", country_code: null, region: null, city: "Girne", names: { TR: "Girne", EN: "Kyrenia" }, aliases: ["Girne", "Kyrenia"] },
  { place_id: "hf:place:0004", country_code: "TR", region: null, city: "İstanbul", names: { TR: "İstanbul", EN: "Istanbul" }, aliases: ["İstanbul", "Istanbul"] },
  { place_id: "hf:place:0005", country_code: "TR", region: null, city: "Ankara", names: { TR: "Ankara", EN: "Ankara" }, aliases: ["Ankara"] },
  { place_id: "hf:place:0006", country_code: "TR", region: null, city: "İzmir", names: { TR: "İzmir", EN: "Izmir" }, aliases: ["İzmir", "Izmir"] },
].map(place => Object.freeze({ ...place, country_code: place.country_code === null ? null : resolveCountryCode(place.country_code),
  names: Object.freeze(place.names), aliases: Object.freeze(place.aliases),
  display_labels: Object.freeze({ TR: `${place.names.TR} · ${place.country_code || "Kıbrıs adası"}`, EN: `${place.names.EN} · ${place.country_code || "Cyprus island"}` }),
  latitude: null, longitude: null, location_precision: "city_only", uncertainty_km: null,
  catalog_version: PLACE_CATALOG_VERSION })));

export function getPilotPlace(placeId) {
  return PILOT_PLACES.find(place => place.place_id === placeId) ?? null;
}

const aliasKey = value => typeof value === "string" ? value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ı/g, "i") : "";
// Exact normalized aliases only, never fuzzy/prefix matching or first-match wins.
// Optional context disambiguates names; null country is NOT a wildcard.
export function resolvePilotPlaceAlias(alias, context = {}, catalog = PILOT_PLACES) {
  const key = aliasKey(alias);
  if (!key || !context || typeof context !== "object" || Array.isArray(context) ||
      Object.keys(context).some(field => !["place_id", "country_code", "region"].includes(field))) return null;
  const matches = catalog.filter(place => place.aliases.some(value => aliasKey(value) === key) &&
    Object.entries(context).every(([field, value]) => place[field] === value));
  return matches.length === 1 ? matches[0] : null;
}
