import { apiUrl } from "./apiBase.js";

export const CAREER_COMPANION_REQUEST_TIMEOUT_MS = 30000;

const safeMessages = {
  MALFORMED_GUIDANCE_OUTPUT: "Rehberlik yanıtı okunamadı. Kaydın korunuyor; tekrar deneyebilirsin.",
  GUIDANCE_UNAVAILABLE: "Rehberlik şu anda oluşturulamadı. Kaydın korunuyor; tekrar deneyebilirsin.",
  STORAGE_UNAVAILABLE: "Kayıt işlemi şu anda tamamlanamadı. Lütfen tekrar dene.",
  COMPANION_UNAVAILABLE: "Rehberlik şu anda kullanılamıyor. Kaydın korunuyor; tekrar deneyebilirsin.",
};

export function normalizeCareerCompanionCase(item) {
  if (!item || typeof item !== "object" || typeof item.guidance !== "string") return item;
  try {
    const guidance = JSON.parse(item.guidance);
    return guidance && typeof guidance === "object" ? { ...item, guidance } : item;
  } catch {
    return item;
  }
}

function getRequestError(data) {
  const code = typeof data?.error === "string" ? data.error : "REQUEST_FAILED";
  const error = new Error(safeMessages[code] || "İstek tamamlanamadı. Lütfen tekrar dene.");
  error.code = code;
  return error;
}

export async function requestCareerCompanion(path, getHeaders, options = {}, settings = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMs || CAREER_COMPANION_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(path), { ...options, signal: controller.signal, headers: { "Content-Type": "application/json", ...(await getHeaders({ requireSession: true })) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw getRequestError(data);
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("İstek zaman aşımına uğradı. Kaydın korunuyor; tekrar deneyebilirsin.");
      timeoutError.code = "CAREER_COMPANION_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export const listCareerCompanionCases = async (getHeaders) => { const data = await requestCareerCompanion("/api/career-companion/cases", getHeaders); return { ...data, cases: (data.cases || []).map(normalizeCareerCompanionCase) }; };
export const createCareerCompanionCase = (getHeaders, input) => requestCareerCompanion("/api/career-companion/cases", getHeaders, { method: "POST", body: JSON.stringify(input) });
export const generateCareerCompanionGuidance = async (getHeaders, id, lang) => { const data = await requestCareerCompanion(`/api/career-companion/cases/${encodeURIComponent(id)}/guidance`, getHeaders, { method: "POST", body: JSON.stringify({ lang }) }); return { ...data, case: normalizeCareerCompanionCase(data.case) }; };
export const saveCareerCompanionOutcome = (getHeaders, id, outcome) => requestCareerCompanion(`/api/career-companion/cases/${encodeURIComponent(id)}/outcome`, getHeaders, { method: "POST", body: JSON.stringify(outcome) });
export const deleteCareerCompanionCase = (getHeaders, id) => requestCareerCompanion(`/api/career-companion/cases/${encodeURIComponent(id)}`, getHeaders, { method: "DELETE" });
