import { createClient } from "@supabase/supabase-js";

const env = import.meta.env || {};
const supabaseUrl = String(env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY || "").trim();

function validateSupabaseUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    return Boolean(parsed.hostname) && (parsed.protocol === "https:" || (isLocal && parsed.protocol === "http:"));
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = validateSupabaseUrl(supabaseUrl) && Boolean(supabaseAnonKey);

export const AUTH_SESSION_MODE_KEY = "hirefit-auth-session-mode";
export const AUTH_OAUTH_SESSION_MODE_KEY = "hirefit-oauth-session-mode";
export const AUTH_SESSION_MODE_PERSISTENT = "persistent";
export const AUTH_SESSION_MODE_SESSION = "session";

function getBrowserStorage(kind) {
  if (typeof window === "undefined") return null;
  try {
    return kind === AUTH_SESSION_MODE_SESSION ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function safeGetStorageItem(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetStorageItem(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function safeRemoveStorageItem(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function getAuthSessionPersistenceMode() {
  const sessionStorage = getBrowserStorage(AUTH_SESSION_MODE_SESSION);
  const localStorage = getBrowserStorage(AUTH_SESSION_MODE_PERSISTENT);
  const oauthMode = safeGetStorageItem(sessionStorage, AUTH_OAUTH_SESSION_MODE_KEY);
  if (oauthMode === AUTH_SESSION_MODE_SESSION || oauthMode === AUTH_SESSION_MODE_PERSISTENT) return oauthMode;
  const sessionMode = safeGetStorageItem(sessionStorage, AUTH_SESSION_MODE_KEY);
  if (sessionMode === AUTH_SESSION_MODE_SESSION) return AUTH_SESSION_MODE_SESSION;
  const localMode = safeGetStorageItem(localStorage, AUTH_SESSION_MODE_KEY);
  if (localMode === AUTH_SESSION_MODE_SESSION) return AUTH_SESSION_MODE_SESSION;
  return AUTH_SESSION_MODE_PERSISTENT;
}

export function setAuthSessionPersistenceMode(keepSignedIn = true) {
  const mode = keepSignedIn ? AUTH_SESSION_MODE_PERSISTENT : AUTH_SESSION_MODE_SESSION;
  const sessionStorage = getBrowserStorage(AUTH_SESSION_MODE_SESSION);
  const localStorage = getBrowserStorage(AUTH_SESSION_MODE_PERSISTENT);
  if (mode === AUTH_SESSION_MODE_SESSION) {
    safeSetStorageItem(sessionStorage, AUTH_SESSION_MODE_KEY, AUTH_SESSION_MODE_SESSION);
    safeRemoveStorageItem(localStorage, AUTH_SESSION_MODE_KEY);
  } else {
    safeSetStorageItem(localStorage, AUTH_SESSION_MODE_KEY, AUTH_SESSION_MODE_PERSISTENT);
    safeRemoveStorageItem(sessionStorage, AUTH_SESSION_MODE_KEY);
  }
  return mode;
}

export function setOAuthSessionPersistencePreference(keepSignedIn = true) {
  const mode = keepSignedIn ? AUTH_SESSION_MODE_PERSISTENT : AUTH_SESSION_MODE_SESSION;
  const sessionStorage = getBrowserStorage(AUTH_SESSION_MODE_SESSION);
  safeSetStorageItem(sessionStorage, AUTH_OAUTH_SESSION_MODE_KEY, mode);
  setAuthSessionPersistenceMode(keepSignedIn);
  return mode;
}

export function consumeOAuthSessionPersistencePreference() {
  const sessionStorage = getBrowserStorage(AUTH_SESSION_MODE_SESSION);
  const mode = safeGetStorageItem(sessionStorage, AUTH_OAUTH_SESSION_MODE_KEY);
  if (mode === AUTH_SESSION_MODE_SESSION || mode === AUTH_SESSION_MODE_PERSISTENT) {
    setAuthSessionPersistenceMode(mode === AUTH_SESSION_MODE_PERSISTENT);
  }
  safeRemoveStorageItem(sessionStorage, AUTH_OAUTH_SESSION_MODE_KEY);
  return mode || null;
}

function isSupabaseAuthStorageKey(key = "") {
  const normalized = String(key || "").toLowerCase();
  return (
    normalized === "sb-auth-token" ||
    (normalized.startsWith("sb-") &&
      (normalized.includes("-auth-token") || normalized.includes("code-verifier")))
  );
}

function removeSupabaseAuthKeysFromStorage(storage) {
  if (!storage) return;
  try {
    for (const key of Object.keys(storage)) {
      if (isSupabaseAuthStorageKey(key)) storage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function prepareAuthSessionStorage({ keepSignedIn = true, clearExistingAuth = true } = {}) {
  const mode = setAuthSessionPersistenceMode(keepSignedIn);
  if (clearExistingAuth) {
    removeSupabaseAuthKeysFromStorage(getBrowserStorage(AUTH_SESSION_MODE_PERSISTENT));
    removeSupabaseAuthKeysFromStorage(getBrowserStorage(AUTH_SESSION_MODE_SESSION));
  } else if (mode === AUTH_SESSION_MODE_SESSION) {
    removeSupabaseAuthKeysFromStorage(getBrowserStorage(AUTH_SESSION_MODE_PERSISTENT));
  } else {
    removeSupabaseAuthKeysFromStorage(getBrowserStorage(AUTH_SESSION_MODE_SESSION));
  }
  return mode;
}

function createSessionAwareAuthStorage() {
  return {
    getItem(key) {
      const mode = getAuthSessionPersistenceMode();
      const primary = getBrowserStorage(mode);
      const fallback = getBrowserStorage(
        mode === AUTH_SESSION_MODE_SESSION ? AUTH_SESSION_MODE_PERSISTENT : AUTH_SESSION_MODE_SESSION
      );
      return safeGetStorageItem(primary, key) ?? safeGetStorageItem(fallback, key);
    },
    setItem(key, value) {
      const mode = getAuthSessionPersistenceMode();
      const primary = getBrowserStorage(mode);
      const other = getBrowserStorage(
        mode === AUTH_SESSION_MODE_SESSION ? AUTH_SESSION_MODE_PERSISTENT : AUTH_SESSION_MODE_SESSION
      );
      safeSetStorageItem(primary, key, value);
      safeRemoveStorageItem(other, key);
    },
    removeItem(key) {
      safeRemoveStorageItem(getBrowserStorage(AUTH_SESSION_MODE_PERSISTENT), key);
      safeRemoveStorageItem(getBrowserStorage(AUTH_SESSION_MODE_SESSION), key);
    },
  };
}

export function createSupabaseAuthStorageAdapterForTest() {
  return createSessionAwareAuthStorage();
}

async function safeSupabaseFetch(input, init) {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(JSON.stringify({ message: "SUPABASE_NETWORK_UNAVAILABLE" }), {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "application/json" },
    });
  }
}

function authUnavailableError() {
  const error = new Error("SUPABASE_UNAVAILABLE");
  error.name = "AuthUnavailableError";
  error.code = "SUPABASE_UNAVAILABLE";
  return error;
}

function createDisabledQuery() {
  const result = () => Promise.resolve({ data: null, error: authUnavailableError() });
  const query = {
    select: () => query,
    insert: () => query,
    update: () => query,
    upsert: () => query,
    delete: () => query,
    eq: () => query,
    neq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    single: result,
    maybeSingle: result,
    then: (resolve, reject) => result().then(resolve, reject),
    catch: (reject) => result().catch(reject),
  };
  return query;
}

function createDisabledClient() {
  const unavailable = () => Promise.resolve({ data: null, error: authUnavailableError() });
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: unavailable,
      signInWithOAuth: unavailable,
      signUp: unavailable,
      resend: unavailable,
      exchangeCodeForSession: unavailable,
      signOut: async () => {
        clearSupabaseAuthStorage();
        return { error: null };
      },
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
    from: () => createDisabledQuery(),
  };
}

const clientCacheKey = "__hirefitSupabaseClient";
const existingClient = globalThis[clientCacheKey];
const supabase = existingClient || (
  isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: { fetch: safeSupabaseFetch },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: createSessionAwareAuthStorage(),
        },
      })
    : createDisabledClient()
);
globalThis[clientCacheKey] = supabase;

let authInitPromise = null;
let authInitialized = false;
let cachedSession = null;
let lastAuthError = null;
let authFailureCount = 0;
let authRetryBlockedUntil = 0;

export function isSupabaseNetworkError(error) {
  const text = String(error?.message || error?.name || error || "").toLowerCase();
  const status = Number(error?.status || 0);
  if (status >= 500) return true;
  return [
    "failed to fetch",
    "networkerror",
    "err_name_not_resolved",
    "authretryablefetcherror",
    "load failed",
    "network request failed",
    "supabase_unavailable",
    "supabase_network_unavailable",
  ].some((part) => text.includes(part));
}

export function isSupabaseSessionFailure(error) {
  const text = String(error?.message || error?.name || error || "").toLowerCase();
  return isSupabaseNetworkError(error) || [
    "invalid refresh token",
    "refresh token not found",
    "refresh_token",
    "lock broken",
    "lock was not released",
    "aborterror",
    "authstorageerror",
    "invalid local supabase auth storage",
  ].some((part) => text.includes(part));
}

export function isSupabaseStaleSessionError(error) {
  const text = String(error?.message || error?.name || error || "").toLowerCase();
  return [
    "invalid refresh token",
    "refresh token not found",
    "refresh_token",
    "authstorageerror",
    "invalid local supabase auth storage",
    "malformed",
    "jwt malformed",
  ].some((part) => text.includes(part));
}

export function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    removeSupabaseAuthKeysFromStorage(window.localStorage);
    removeSupabaseAuthKeysFromStorage(window.sessionStorage);
    window.localStorage.removeItem(AUTH_SESSION_MODE_KEY);
    window.sessionStorage.removeItem(AUTH_SESSION_MODE_KEY);
    window.sessionStorage.removeItem(AUTH_OAUTH_SESSION_MODE_KEY);
    window.localStorage.removeItem("hirefit-user");
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function markAuthFailure(error) {
  if (!isSupabaseSessionFailure(error)) return;
  authFailureCount += 1;
  if (authFailureCount >= 1) {
    authRetryBlockedUntil = Date.now() + 30_000;
  }
}

function clearAuthFailureBackoff() {
  authFailureCount = 0;
  authRetryBlockedUntil = 0;
}

function authRetryBackoffActive() {
  return authRetryBlockedUntil > Date.now();
}

function findStaleSupabaseAuthStorage() {
  if (typeof window === "undefined") return false;
  try {
    const storages = [window.localStorage, window.sessionStorage].filter(Boolean);
    for (const storage of storages) {
      for (const key of Object.keys(storage)) {
        if (isSupabaseAuthStorageKey(key)) {
          const value = storage.getItem(key);
          if (!value) return true;
          if (String(key).toLowerCase().includes("code-verifier")) continue;
          try {
            JSON.parse(value);
          } catch {
            return true;
          }
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function cacheSupabaseSession(session) {
  cachedSession = session || null;
  authInitialized = true;
  lastAuthError = null;
  clearAuthFailureBackoff();
}

export function clearCachedSupabaseSession(error = null) {
  cachedSession = null;
  authInitialized = true;
  lastAuthError = error;
}

async function recoverFromSessionFailure(error) {
  if (!isSupabaseSessionFailure(error)) return false;
  markAuthFailure(error);
  if (isSupabaseStaleSessionError(error)) {
    if (typeof supabase.auth.stopAutoRefresh === "function") {
      supabase.auth.stopAutoRefresh();
    }
    clearSupabaseAuthStorage();
  }
  clearCachedSupabaseSession(error);
  return true;
}

export async function initializeSupabaseAuth() {
  if (authInitialized) {
    return { session: cachedSession, error: lastAuthError, recovered: Boolean(lastAuthError) };
  }
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    if (!isSupabaseConfigured) {
      const error = authUnavailableError();
      clearCachedSupabaseSession(error);
      return { session: null, error, recovered: true };
    }
    if (authRetryBackoffActive()) {
      return { session: null, error: lastAuthError, recovered: true };
    }
    if (findStaleSupabaseAuthStorage()) {
      const error = new Error("Invalid local Supabase auth storage");
      error.name = "AuthStorageError";
      await recoverFromSessionFailure(error);
      return { session: null, error, recovered: true };
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      cacheSupabaseSession(data?.session || null);
      return { session: cachedSession, error: null, recovered: false };
    } catch (error) {
      const recovered = await recoverFromSessionFailure(error);
      clearCachedSupabaseSession(error);
      return { session: null, error, recovered };
    } finally {
      authInitPromise = null;
    }
  })();

  return authInitPromise;
}

export async function getSupabaseSessionSafe() {
  const result = await initializeSupabaseAuth();
  return result.session || null;
}

export async function handleSupabaseAuthFailure(error) {
  return recoverFromSessionFailure(error);
}

export default supabase;

