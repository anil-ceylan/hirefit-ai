import { getServiceClient } from "../../careerMemory/persistence.js";
import { radarError } from "../validation.js";
import { SMALL_CATALOG_LIMIT } from "../constants.js";
import { MAX_LOCATIONS, validateLocationEvidence } from "./primitives.js";

const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const LOCATION_BATCH_SIZE = 100;
export const LOCATION_READ_COLUMNS = "id,location_set_complete,opportunity_locations(location_key,country_code,city,place_id,latitude,longitude,location_precision,uncertainty_km)";

// Type-neutral catalog read. Caller supplies IDs from eligible retrieval. No
// user/profile columns, evidence references, source payloads or write methods.
export function createOpportunityLocationRepository(getClient = getServiceClient) {
  return { async locationsForOpportunities(userId, ids) {
    if (!uuid(userId)) throw radarError("AUTH_REQUIRED", 401);
    if (!Array.isArray(ids) || ids.length > SMALL_CATALOG_LIMIT || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length) throw radarError("RADAR_UNAVAILABLE", 503);
    const result = new Map(ids.map(id => [id, { locations: [], locationsComplete: false }]));
    if (!ids.length) return result;
    try {
      const client = getClient();
      if (!client) throw new Error("Unavailable");
      for (let offset = 0; offset < ids.length; offset += LOCATION_BATCH_SIZE) {
        const batch = ids.slice(offset, offset + LOCATION_BATCH_SIZE), allowed = new Set(batch);
        let cursor = null;
        for (;;) {
          let query = client.from("opportunities").select(LOCATION_READ_COLUMNS).in("id", batch)
            .order("id", { ascending: true }).limit(LOCATION_BATCH_SIZE)
            .order("location_key", { referencedTable: "opportunity_locations", ascending: true })
            .limit(MAX_LOCATIONS + 1, { referencedTable: "opportunity_locations" });
          if (cursor) query = query.gt("id", cursor);
          const { data, error } = await query;
          if (error || !Array.isArray(data) || data.length > batch.length) throw new Error("Invalid location response");
          if (!data.length) break;
          for (const row of data) {
            if (!allowed.has(row.id) || (cursor && row.id <= cursor) || typeof row.location_set_complete !== "boolean" ||
                !Array.isArray(row.opportunity_locations) || row.opportunity_locations.length > MAX_LOCATIONS) throw new Error("Invalid location set");
            cursor = row.id;
            const keys = new Set();
            const locations = row.opportunity_locations.map(raw => {
              const { location_key, ...evidence } = raw;
              if (typeof location_key !== "string" || !location_key.trim() || location_key.length > 160 || keys.has(location_key) ||
                  !["city_only", "city_centroid", "source_point"].includes(evidence.location_precision)) throw new Error("Invalid location row");
              keys.add(location_key);
              for (const field of ["latitude", "longitude", "uncertainty_km", "place_id", "country_code", "city"]) if (!Object.hasOwn(evidence, field)) throw new Error("Incomplete row");
              const normalized = validateLocationEvidence(evidence);
              if (normalized.location_precision !== "source_point" && (!normalized.place_id || !normalized.city)) throw new Error("Unreviewed city");
              return { key: location_key, evidence: normalized };
            }).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0).map(item => item.evidence);
            result.set(row.id, { locations, locationsComplete: row.location_set_complete });
          }
        }
      }
      return result;
    } catch { throw radarError("RADAR_UNAVAILABLE", 503); }
  } };
}
