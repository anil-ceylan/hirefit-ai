import { apiUrl } from "./apiBase.js";
async function request(path, getHeaders, options = {}) { const res = await fetch(apiUrl(path), { ...options, headers: { "Content-Type": "application/json", ...(await getHeaders({ requireSession: true })) } }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || "REQUEST_FAILED"); return data; }
export const listCareerCompanionCases = (getHeaders) => request("/api/career-companion/cases", getHeaders);
export const createCareerCompanionCase = (getHeaders, input) => request("/api/career-companion/cases", getHeaders, { method: "POST", body: JSON.stringify(input) });
export const generateCareerCompanionGuidance = (getHeaders, id, lang) => request(`/api/career-companion/cases/${encodeURIComponent(id)}/guidance`, getHeaders, { method: "POST", body: JSON.stringify({ lang }) });
export const saveCareerCompanionOutcome = (getHeaders, id, outcome) => request(`/api/career-companion/cases/${encodeURIComponent(id)}/outcome`, getHeaders, { method: "POST", body: JSON.stringify(outcome) });
