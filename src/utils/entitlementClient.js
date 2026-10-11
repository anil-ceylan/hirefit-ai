import { apiUrl } from "./apiBase.js";

// Memory-only key: same uncertain attempt reuses it; a changed input is a new operation.
export function analysisAttempt(previous, payload, scope = "") {
  const fingerprint = JSON.stringify([scope, payload]);
  return previous?.fingerprint === fingerprint ? previous : { key: crypto.randomUUID(), fingerprint };
}

export function isDefinitiveAnalysisResponse(status, body) {
  return status === 200 || ["ANALYSIS_FAILED", "ANALYSIS_TIMEOUT", "ANALYSIS_REQUEST_EXPIRED",
    "ANALYSIS_REQUEST_RELEASED", "INVALID_ANALYSIS_INPUT", "INVALID_IDEMPOTENCY_KEY"].includes(body?.error);
}

export async function loadEntitlements(getHeaders, fetchImpl = fetch) {
  const response = await fetchImpl(apiUrl("/api/entitlements"), {
    headers: await getHeaders({ requireSession: true }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true || typeof body.is_pro !== "boolean" ||
      !Number.isInteger(body.analysis_count) || typeof body.allowed !== "boolean") {
    throw new Error("ENTITLEMENT_UNAVAILABLE");
  }
  return body;
}
