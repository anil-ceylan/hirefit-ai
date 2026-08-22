/**
 * Central API base URL for HireFit frontend.
 * Dev: empty string → Vite proxies `/api` to localhost:3000 (see vite.config.js).
 * Prod: VITE_API_URL or Railway default.
 */

const PROD_DEFAULT = "https://hirefit-ai-production.up.railway.app";

export function getApiBase() {
  const raw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
      ? String(import.meta.env.VITE_API_URL).trim()
      : "";

  if (import.meta.env?.DEV) {
    if (!raw) return "";
    if (/^https?:\/\/(localhost|127\.0\.0\.1):3000\/?$/i.test(raw)) return "";
    return raw.replace(/\/$/, "");
  }

  return raw ? raw.replace(/\/$/, "") : PROD_DEFAULT;
}

export function isNetworkError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("connection refused") ||
    msg.includes("err_connection") ||
    msg.includes("err_name_not_resolved") ||
    msg.includes("authretryablefetcherror") ||
    msg.includes("supabase_unavailable") ||
    msg.includes("supabase_network_unavailable") ||
    msg.includes("bağlantı") ||
    msg.includes("baglanti")
  );
}

export function apiErrorKind(status, err) {
  if (isNetworkError(err)) return "network";
  if (Number(status) === 401 || Number(status) === 403) return "auth";
  if (Number(status) === 404) return "not_found";
  if (Number(status) >= 500) return "server";
  return "unknown";
}

export function friendlyApiMessage(status, err, lang = "TR") {
  const tr = lang === "TR";
  const kind = apiErrorKind(status, err);
  if (kind === "network") {
    return tr
      ? "Bağlantı geçici olarak kurulamadı. Lütfen tekrar deneyin."
      : "The connection could not be established temporarily. Please try again.";
  }
  if (kind === "auth") {
    return tr ? "Devam etmek için giriş yap." : "Please sign in to continue.";
  }
  if (kind === "not_found") {
    return tr ? "Kayıt bulunamadı." : "Record not found.";
  }
  return tr
    ? "Geçici bir sorun oluştu. Lütfen tekrar deneyin."
    : "A temporary issue occurred. Please try again.";
}

/** Build API path; empty base = same-origin (Vite proxy in dev). */
export function apiUrl(path) {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : apiUrl(path);
  return fetch(url, options);
}

