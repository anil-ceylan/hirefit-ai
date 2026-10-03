import { getServiceClient } from "../careerMemory/persistence.js";
import { SMALL_CATALOG_LIMIT, JOB_SUBTYPES } from "./constants.js";
import { isVisibleJob, radarError, validateStateInput } from "./validation.js";

export const OPPORTUNITY_COLUMNS = "id,type,subtype,title,organization,description,source,source_type,source_item_id,url,country,city,work_mode,role_tags,sector_tags,skill_tags,eligibility,requirements,deadline_at,starts_at,ends_at,published,active,verification_status,last_verified_at,expires_at,created_at,updated_at";

export const COMPACT_COLUMNS = "id,type,subtype,url,source_type,country,city,work_mode,role_tags,sector_tags,skill_tags,requirements,deadline_at,ends_at,published,active,verification_status,last_verified_at,expires_at";

function eligibleQuery(client, now, columns = OPPORTUNITY_COLUMNS) {
  const timestamp = now.toISOString();
  return client.from("opportunities").select(columns)
    .eq("type", "job").in("subtype", JOB_SUBTYPES)
    .in("source_type", ["employer", "job_board", "curated"])
    .eq("published", true).eq("active", true).eq("verification_status", "verified")
    .lte("last_verified_at", timestamp).gt("expires_at", timestamp)
    .or(`deadline_at.is.null,deadline_at.gt.${timestamp}`)
    .or(`ends_at.is.null,ends_at.gt.${timestamp}`);
}

export function createOpportunityRepository(getClient = getServiceClient) {
  function clientFor(userId) {
    if (!userId || typeof userId !== "string") throw radarError("AUTH_REQUIRED", 401);
    const client = getClient();
    if (!client) throw radarError("RADAR_UNAVAILABLE", 503);
    return client;
  }
  return {
    async list(userId, now, state = null) {
      const client = clientFor(userId);
      const rows = [];
      let cursor = null;
      for (;;) {
        const columns = state ? `${COMPACT_COLUMNS},opportunity_user_states!inner(user_id,state)` : COMPACT_COLUMNS;
        let query = eligibleQuery(client, now, columns).order("id", { ascending: true }).limit(Math.min(250, SMALL_CATALOG_LIMIT + 1 - rows.length));
        if (state) query = query.eq("opportunity_user_states.user_id", userId).eq("opportunity_user_states.state", state);
        if (cursor) query = query.gt("id", cursor);
        const { data, error } = await query;
        if (error) throw radarError("RADAR_UNAVAILABLE", 503);
        const page = data || [];
        if (page.some((row, index) => !row.id || row.id <= (index ? page[index - 1].id : cursor || ""))) throw radarError("RADAR_UNAVAILABLE", 503);
        rows.push(...page);
        if (rows.length > SMALL_CATALOG_LIMIT) throw radarError("CATALOG_LIMIT_EXCEEDED", 503);
        if (!page.length) break;
        cursor = page.at(-1).id;
      }
      return { opportunities: rows.filter(row => isVisibleJob(row, now)), truncated: false };
    },
    async hydrate(userId, ids, now) {
      const client = clientFor(userId);
      const rows = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await eligibleQuery(client, now).in("id", ids.slice(offset, offset + 100));
        if (error) throw radarError("RADAR_UNAVAILABLE", 503);
        rows.push(...(data || []).filter(row => isVisibleJob(row, now)));
      }
      return rows;
    },
    async states(userId, ids) {
      const client = clientFor(userId);
      const result = [];
      // Keep PostgREST URLs bounded, including when the candidate window is full.
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await client.from("opportunity_user_states")
          .select("opportunity_id,state,updated_at").eq("user_id", userId).in("opportunity_id", ids.slice(offset, offset + 100));
        if (error) throw radarError("RADAR_UNAVAILABLE", 503);
        result.push(...(data || []));
      }
      return result;
    },
    async setState(userId, id, state, now) {
      const input = validateStateInput(id, { state });
      const client = clientFor(userId);
      const { data: opportunity, error: lookupError } = await eligibleQuery(client, now).eq("id", input.id).maybeSingle();
      if (lookupError) throw radarError("RADAR_UNAVAILABLE", 503);
      if (!opportunity || !isVisibleJob(opportunity, now)) throw radarError("OPPORTUNITY_NOT_FOUND", 404);
      // Only these three fields can be written. A service client bypasses RLS;
      // the authenticated user ID and composite conflict key are mandatory.
      const { data, error } = await client.from("opportunity_user_states")
        .upsert({ user_id: userId, opportunity_id: input.id, state: input.state }, { onConflict: "user_id,opportunity_id" })
        .select("opportunity_id,state,updated_at").single();
      if (error) throw radarError("RADAR_UNAVAILABLE", 503);
      return data;
    },
  };
}
