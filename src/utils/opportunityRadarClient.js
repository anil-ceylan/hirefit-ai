import { apiUrl } from "./apiBase.js";
import { isVisibleJob } from "../../lib/opportunityRadar/validation.js";
import { LOCATION_PREFERENCE_PATH } from "../../lib/opportunityRadar/location/preferenceValidation.js";

const failure = code => Object.assign(new Error(code), { code });

export async function requestOpportunityRadar(path, getHeaders, { signal, timeoutMs = 15000, ...options } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(failure("CANCELLED"));
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(controller.signal.reason || failure("CANCELLED"));
  controller.signal.addEventListener("abort", onAbort, { once: true });
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(() => controller.abort(failure("TIMEOUT")), timeoutMs);
  const run = async () => {
    const headers = await getHeaders({ requireSession: true });
    controller.signal.throwIfAborted();
    const response = await fetch(apiUrl(path), { ...options, signal: controller.signal, headers: { ...headers, "Content-Type": "application/json" } });
    const body = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) throw failure("AUTH_REQUIRED");
    if (path === LOCATION_PREFERENCE_PATH && !response.ok) {
      const safeErrors = { INVALID_LOCATION_PREFERENCE: 400, INVALID_JSON: 400, INPUT_TOO_LARGE: 413,
        LOCATION_PREFERENCE_NOT_FOUND: 404, METHOD_NOT_ALLOWED: 405, NOT_FOUND: 404 };
      throw failure(safeErrors[body?.error] === response.status ? body.error : "RADAR_UNAVAILABLE");
    }
    if (response.status === 409 && body?.error === "CAREER_PROFILE_REQUIRED") throw failure("CAREER_PROFILE_REQUIRED");
    if (response.status === 409 && body?.error === "LOCATION_PREFERENCE_REQUIRED") throw failure("LOCATION_PREFERENCE_REQUIRED");
    if (response.status === 404) throw failure("OPPORTUNITY_NOT_FOUND");
    if (!response.ok || body?.success !== true) throw failure("RADAR_UNAVAILABLE");
    return body;
  };
  try { return await Promise.race([aborted, run()]); }
  finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener("abort", onAbort);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function listOpportunities(getHeaders, { lang = "TR", filter = "all", limit = 20, ...settings } = {}) {
  if (!["all", "nearby", "saved"].includes(filter)) throw failure("INVALID_QUERY");
  const query = new URLSearchParams({ lang, limit: String(limit) });
  if (filter === "saved") query.set("state", "saved");
  if (filter === "nearby") query.set("view", "nearby");
  const body = await requestOpportunityRadar(`/api/opportunity-radar?${query}`, getHeaders, settings);
  if (!Array.isArray(body.opportunities)) throw failure("INVALID_RESPONSE");
  for (const item of body.opportunities) {
    const match = item?.location_match;
    if (match === undefined && filter !== "nearby") continue;
    if (!match || typeof match !== "object" || Array.isArray(match) ||
        !["approximate_distance", "same_city", "boundary_uncertain", "outside", "remote", "unknown"].includes(match.kind) ||
        !["within", "outside", "boundary_uncertain", "unknown", null].includes(match.radius_relation) ||
        typeof match.reason !== "string" || match.reason.length > 80 ||
        Object.keys(match).some(key => !["kind", "radius_relation", "reason", "approximate_distance_km", "distance_basis"].includes(key)) ||
        (match.approximate_distance_km !== undefined && (!Number.isInteger(match.approximate_distance_km) || match.approximate_distance_km < 0 || match.approximate_distance_km > 20016)) ||
        (match.distance_basis !== undefined && !["city_centroid", "source_point"].includes(match.distance_basis)) ||
        (["remote", "same_city", "unknown"].includes(match.kind) && match.approximate_distance_km !== undefined) ||
        (match.kind === "remote" && match.radius_relation !== null) ||
        ((match.approximate_distance_km !== undefined) !== (match.distance_basis !== undefined)) ||
        (filter === "nearby" && !["same_city", "boundary_uncertain", "remote"].includes(match.kind) &&
          !(match.kind === "approximate_distance" && match.radius_relation === "within"))) throw failure("INVALID_RESPONSE");
  }
  return { ...body, opportunities: body.opportunities.filter(item =>
    isVisibleJob(item) && typeof item.id === "string" && typeof item.title === "string" &&
    (filter === "saved" ? item.current_user_state === "saved" : item.current_user_state !== "dismissed")) };
}

export async function updateOpportunityState(getHeaders, id, state, settings = {}) {
  const body = await requestOpportunityRadar(`/api/opportunity-radar/${encodeURIComponent(id)}/state`, getHeaders,
    { ...settings, method: "PATCH", body: JSON.stringify({ state }) });
  if (body.opportunity_id !== id || body.state !== state) throw failure("INVALID_RESPONSE");
  return body;
}

export function radarErrorMessage(error, lang = "TR", mutation = false) {
  const tr = lang === "TR";
  if (error?.code === "LOCATION_PREFERENCE_REQUIRED") return tr ? "Konum tercihi gerekiyor. Yakındaki fırsatlar için arama konumunu etkinleştir." : "Enable a search location to see nearby opportunities.";
  if (error?.code === "AUTH_REQUIRED") return tr ? "Oturumunu doğrulayamadık. Devam etmek için tekrar giriş yap." : "We could not verify your session. Please sign in again.";
  if (error?.code === "OPPORTUNITY_NOT_FOUND") return tr ? "Bu fırsat artık erişilebilir olmayabilir. Listeyi yenileyebilirsin." : "This opportunity may no longer be available. Refresh the list.";
  if (mutation) return tr ? "İşlemin sonucu doğrulanamadı. Kartı koruduk; listeyi yenileyerek durumunu kontrol edebilirsin." : "We could not confirm the update. The card is preserved; refresh to check its status.";
  if (error?.code === "TIMEOUT") return tr ? "Fırsatları yüklemek beklenenden uzun sürdü. Tekrar deneyebilirsin." : "Loading opportunities took too long. Please try again.";
  return tr ? "Fırsatlar şu anda yüklenemiyor. Lütfen tekrar dene." : "Opportunities could not load right now. Please try again.";
}
