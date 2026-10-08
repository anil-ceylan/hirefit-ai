import { getServiceClient } from "../../careerMemory/persistence.js";
import { radarError } from "../validation.js";
import { validateLocationPreference, projectLocationPreference } from "./preferenceValidation.js";

const TABLE = "opportunity_location_preferences";
const PUBLIC_COLUMNS = "source,place_id,radius_km,include_remote,enabled";

export function createLocationPreferenceRepository(getClient = getServiceClient, clock = () => new Date()) {
  function clientFor(userId) {
    if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw radarError("AUTH_REQUIRED", 401);
    const client = getClient();
    if (!client) throw radarError("RADAR_UNAVAILABLE", 503);
    return client;
  }
  async function safely(operation) {
    try { return await operation(); }
    catch (error) {
      if (["AUTH_REQUIRED", "INVALID_LOCATION_PREFERENCE", "LOCATION_PREFERENCE_NOT_FOUND"].includes(error?.code)) throw error;
      throw radarError("RADAR_UNAVAILABLE", 503);
    }
  }
  return {
    getForEvaluation(userId) { return safely(async () => {
      const { data, error } = await clientFor(userId).from(TABLE)
        .select("source,place_id,enabled,radius_km,include_remote,consent_version,approximate_latitude,approximate_longitude")
        .eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (data === null) return null;
      if (typeof data?.enabled !== "boolean") throw new Error("Invalid preference row");
      if (!data.enabled) return { enabled: false };
      const input = { source: data.source, place_id: data.place_id, enabled: data.enabled, radius_km: data.radius_km,
        include_remote: data.include_remote, consent_version: data.consent_version };
      if (data.source === "browser") {
        delete input.place_id;
        input.approximate_latitude = data.approximate_latitude;
        input.approximate_longitude = data.approximate_longitude;
      }
      // Internal only; never use this projection as an API response. Browser
      // uncertainty remains unbounded, manual evidence is resolved server-side.
      try { return validateLocationPreference(input); }
      catch { throw new Error("Invalid stored preference"); }
    }); },
    get(userId) { return safely(async () => {
      const { data, error } = await clientFor(userId).from(TABLE).select(PUBLIC_COLUMNS).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data === null ? null : projectLocationPreference(data);
    }); },
    upsert(userId, preference) { return safely(async () => {
      const client = clientFor(userId);
      // Re-derive the write allowlist even for internal callers. Never spread a
      // request/DB row: owner, geography, precision and consent time are ours.
      const input = { source: preference?.source, enabled: preference?.enabled, radius_km: preference?.radius_km,
        include_remote: preference?.include_remote, consent_version: preference?.consent_version };
      if (input.source === "manual") input.place_id = preference?.place_id;
      else { input.approximate_latitude = preference?.approximate_latitude; input.approximate_longitude = preference?.approximate_longitude; }
      const validated = validateLocationPreference(input);
      // Each explicit PUT reaffirms consent. PATCH changes only enabled.
      const row = { ...validated, user_id: userId, consented_at: clock().toISOString() };
      const { data, error } = await client.from(TABLE).upsert(row, { onConflict: "user_id" })
        .eq("user_id", userId).select(PUBLIC_COLUMNS).single();
      if (error) throw error;
      return projectLocationPreference(data);
    }); },
    setEnabled(userId, enabled) { return safely(async () => {
      const client = clientFor(userId);
      if (typeof enabled !== "boolean") throw radarError("INVALID_LOCATION_PREFERENCE");
      const { data, error } = await client.from(TABLE).update({ enabled }).eq("user_id", userId).select(PUBLIC_COLUMNS).maybeSingle();
      if (error) throw error;
      if (!data) throw radarError("LOCATION_PREFERENCE_NOT_FOUND", 404);
      return projectLocationPreference(data);
    }); },
    remove(userId) { return safely(async () => {
      const { error } = await clientFor(userId).from(TABLE).delete().eq("user_id", userId);
      if (error) throw error;
      return { removed: true };
    }); },
  };
}
