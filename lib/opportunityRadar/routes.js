import { getUserFromRequest } from "../auth/verifySupabaseJwt.js";
import { loadCareerProfile } from "../careerMemory/persistence.js";
import { CANDIDATE_LIMIT, SMALL_CATALOG_LIMIT, RANKING_VERSION } from "./constants.js";
import { createOpportunityRepository } from "./persistence.js";
import { evaluateOpportunity, profileContext, rankOpportunity, sortRankedOpportunities } from "./ranking.js";
import { isVisibleJob, radarError, validateListQuery, validateStateInput } from "./validation.js";
import { createLocationPreferenceRepository } from "./location/preferencePersistence.js";
import { LOCATION_PREFERENCE_PATH, validateLocationPreference, validateLocationEnabled } from "./location/preferenceValidation.js";

async function readMutationBody(req) {
  const maxBytes = 2048;
  let raw = req.body;
  if (raw === undefined && req[Symbol.asyncIterator]) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += Buffer.byteLength(chunk);
      if (length > maxBytes) throw radarError("INPUT_TOO_LARGE", 413);
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  if (typeof raw !== "string") raw = JSON.stringify(raw ?? {});
  if (Buffer.byteLength(raw) > maxBytes) throw radarError("INPUT_TOO_LARGE", 413);
  try { return JSON.parse(raw); } catch { throw radarError("INVALID_JSON"); }
}

// Both Express and Vercel call the same handler; dependencies are injectable only
// from server/test code, never from request payloads.
export function createOpportunityRadarHandler({ authenticate = getUserFromRequest, loadProfile = loadCareerProfile, repository = createOpportunityRepository(), clock = () => new Date(), locationRepository = createLocationPreferenceRepository() } = {}) {
  return async function handle(req, path) {
    try {
      const auth = await authenticate(req);
      if (!auth.ok || !auth.user?.id) return { status: auth.status || 401, body: { success: false, error: "AUTH_REQUIRED" } };
      req.authUser = auth.user;
      const now = clock();
      const method = String(req.method || "GET").toUpperCase();
      if (path === LOCATION_PREFERENCE_PATH) {
        const userId = req.authUser.id;
        if (method === "GET") return { status: 200, body: { success: true, preference: await locationRepository.get(userId) } };
        if (method === "PUT") return { status: 200, body: { success: true, preference: await locationRepository.upsert(userId, validateLocationPreference(await readMutationBody(req))) } };
        if (method === "PATCH") return { status: 200, body: { success: true, preference: await locationRepository.setEnabled(userId, validateLocationEnabled(await readMutationBody(req))) } };
        if (method === "DELETE") { await locationRepository.remove(userId); return { status: 200, body: { success: true, removed: true } }; }
        throw radarError("METHOD_NOT_ALLOWED", 405);
      }
      const statePath = path.match(/^\/api\/opportunity-radar\/([^/]+)\/state$/);
      if (path !== "/api/opportunity-radar" && !statePath) throw radarError("NOT_FOUND", 404);
      if (path === "/api/opportunity-radar" && method === "GET") {
        const params = new URL(req.url || "/", "https://www.hirefit.co").searchParams;
        if ([...params.keys()].some(key => params.getAll(key).length > 1)) throw radarError("INVALID_QUERY");
        // Vercel's catch-all injects this exact transport parameter into req.url.
        if (params.has("...route")) {
          if (params.get("...route") !== "opportunity-radar") throw radarError("INVALID_QUERY");
          params.delete("...route");
        }
        // Only the request URL defines list semantics; req.query is runtime transport metadata.
        const query = validateListQuery(Object.fromEntries(params));
        const profile = await loadProfile(req.authUser.id);
        if (!profile) throw radarError("CAREER_PROFILE_REQUIRED", 409);
        const catalog = await repository.list(req.authUser.id, now, query.state);
        if (catalog.truncated || catalog.opportunities.length > SMALL_CATALOG_LIMIT) throw radarError("CATALOG_LIMIT_EXCEEDED", 503);
        const candidates = catalog.opportunities.filter(row => isVisibleJob(row, now));
        const states = await repository.states(req.authUser.id, candidates.map(row => row.id));
        const stateById = new Map(states.map(row => [row.opportunity_id, row.state]));
        const context = profileContext(profile);
        const evaluated = candidates.filter(row => query.state ? stateById.get(row.id) === query.state : stateById.get(row.id) !== "dismissed")
          .map(row => evaluateOpportunity(row, context));
        const ids = sortRankedOpportunities(evaluated).slice(0, CANDIDATE_LIMIT).map(row => row.id);
        const hydrated = await repository.hydrate(req.authUser.id, ids, now);
        const latestStates = await repository.states(req.authUser.id, ids);
        const latestById = new Map(latestStates.map(row => [row.opportunity_id, row.state]));
        const selected = new Set(ids);
        const ranked = hydrated.filter(row => selected.has(row.id) && isVisibleJob(row, now))
          .filter(row => query.state ? latestById.get(row.id) === query.state : latestById.get(row.id) !== "dismissed")
          .map(row => rankOpportunity(row, profile, latestById.get(row.id) || null, { lang: query.lang, now }));
        return { status: 200, body: { success: true, opportunities: sortRankedOpportunities(ranked).slice(0, query.limit),
          meta: { ranking_version: RANKING_VERSION, score_kind: "profile_alignment", evaluated_at: now.toISOString(),
            candidate_limit: CANDIDATE_LIMIT, candidates_truncated: evaluated.length > CANDIDATE_LIMIT, limit: query.limit } } };
      }
      if (statePath && method === "PATCH") {
        let id;
        try { id = decodeURIComponent(statePath[1]); } catch { throw radarError("INVALID_STATE_INPUT"); }
        const input = validateStateInput(id, await readMutationBody(req));
        const result = await repository.setState(req.authUser.id, input.id, input.state, now);
        return { status: 200, body: { success: true, ...result } };
      }
      throw radarError("METHOD_NOT_ALLOWED", 405);
    } catch (error) {
      const safeCodes = new Set(["AUTH_REQUIRED", "INVALID_QUERY", "INVALID_JSON", "INPUT_TOO_LARGE", "INVALID_STATE_INPUT", "INVALID_LOCATION_PREFERENCE", "LOCATION_PREFERENCE_NOT_FOUND", "CAREER_PROFILE_REQUIRED", "OPPORTUNITY_NOT_FOUND", "METHOD_NOT_ALLOWED", "NOT_FOUND"]);
      const known = safeCodes.has(error?.code) || error?.code === "CATALOG_LIMIT_EXCEEDED";
      return { status: known ? error.status : 503, body: { success: false, error: known ? error.code : "RADAR_UNAVAILABLE" } };
    }
  };
}

const handle = createOpportunityRadarHandler();
export async function handleOpportunityRadar(req, res, path) {
  const result = await handle(req, path);
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  return res.end(JSON.stringify(result.body));
}

export function registerOpportunityRadarRoutes(app) {
  app.all(LOCATION_PREFERENCE_PATH, (req, res) => handleOpportunityRadar(req, res, LOCATION_PREFERENCE_PATH));
  app.all("/api/opportunity-radar", (req, res) => handleOpportunityRadar(req, res, "/api/opportunity-radar"));
  app.all("/api/opportunity-radar/:id/state", (req, res) => handleOpportunityRadar(req, res, `/api/opportunity-radar/${encodeURIComponent(req.params.id)}/state`));
}
