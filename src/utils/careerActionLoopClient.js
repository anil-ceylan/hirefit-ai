import { apiUrl } from "./apiBase.js";

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

async function postAction(path, getHeaders, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: await getHeaders({ requireSession: true }),
    body: JSON.stringify(body || {}),
  });
  const data = await parseJson(res);
  if (!res.ok || data?.storageUnavailable) return { action: null, storageUnavailable: true };
  return data;
}

export async function fetchCurrentCareerAction({ getHeaders, actionId, weekKey }) {
  const params = new URLSearchParams();
  if (actionId) params.set("action_id", actionId);
  if (weekKey) params.set("week_key", weekKey);
  const res = await fetch(apiUrl(`/api/career-actions/current?${params.toString()}`), {
    headers: await getHeaders({ requireSession: true }),
  });
  const data = await parseJson(res);
  if (!res.ok || data?.storageUnavailable) return { action: null, storageUnavailable: true };
  return data;
}

export function upsertRecommendedCareerAction({ getHeaders, action }) {
  return postAction("/api/career-actions/recommended", getHeaders, { action });
}

export function startCareerAction({ getHeaders, actionId }) {
  return postAction("/api/career-actions/start", getHeaders, { action_id: actionId });
}

export function completeCareerAction({ getHeaders, actionId }) {
  return postAction("/api/career-actions/complete", getHeaders, { action_id: actionId });
}

export async function fetchCareerActionOutcome({ getHeaders, actionId }) {
  const res = await fetch(apiUrl(`/api/career-actions/${encodeURIComponent(actionId)}/outcome`), {
    headers: await getHeaders({ requireSession: true }),
  });
  const data = await parseJson(res);
  if (!res.ok || data?.storageUnavailable) return { outcome: null, storageUnavailable: true };
  return data;
}

export function upsertCareerActionOutcome({ getHeaders, actionId, outcome }) {
  return postAction(`/api/career-actions/${encodeURIComponent(actionId)}/outcome`, getHeaders, { outcome });
}
