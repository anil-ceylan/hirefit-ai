import { apiUrl } from "./apiBase.js";
import { isVisibleJob } from "../../lib/opportunityRadar/validation.js";

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
    if (response.status === 409 && body?.error === "CAREER_PROFILE_REQUIRED") throw failure("CAREER_PROFILE_REQUIRED");
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
  const query = new URLSearchParams({ lang, limit: String(limit) });
  if (filter === "saved") query.set("state", "saved");
  const body = await requestOpportunityRadar(`/api/opportunity-radar?${query}`, getHeaders, settings);
  if (!Array.isArray(body.opportunities)) throw failure("INVALID_RESPONSE");
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
  if (error?.code === "AUTH_REQUIRED") return tr ? "Oturumunu doğrulayamadık. Devam etmek için tekrar giriş yap." : "We could not verify your session. Please sign in again.";
  if (error?.code === "OPPORTUNITY_NOT_FOUND") return tr ? "Bu fırsat artık erişilebilir olmayabilir. Listeyi yenileyebilirsin." : "This opportunity may no longer be available. Refresh the list.";
  if (mutation) return tr ? "İşlemin sonucu doğrulanamadı. Kartı koruduk; listeyi yenileyerek durumunu kontrol edebilirsin." : "We could not confirm the update. The card is preserved; refresh to check its status.";
  if (error?.code === "TIMEOUT") return tr ? "Fırsatları yüklemek beklenenden uzun sürdü. Tekrar deneyebilirsin." : "Loading opportunities took too long. Please try again.";
  return tr ? "Fırsatlar şu anda yüklenemiyor. Lütfen tekrar dene." : "Opportunities could not load right now. Please try again.";
}
