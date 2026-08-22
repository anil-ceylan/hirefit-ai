import assert from "node:assert/strict";
import fs from "node:fs";

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  get length() {
    return this.map.size;
  }
  key(index) {
    return [...this.map.keys()][index] || null;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    const k = String(key);
    const v = String(value);
    this.map.set(k, v);
    this[k] = v;
  }
  removeItem(key) {
    const k = String(key);
    this.map.delete(k);
    delete this[k];
  }
  clear() {
    for (const key of this.map.keys()) delete this[key];
    this.map.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
globalThis.window = { localStorage, sessionStorage };

const auth = await import(`../src/supabaseClient.js?authSprint62=${Date.now()}`);
const {
  AUTH_SESSION_MODE_KEY,
  AUTH_OAUTH_SESSION_MODE_KEY,
  AUTH_SESSION_MODE_PERSISTENT,
  AUTH_SESSION_MODE_SESSION,
  clearSupabaseAuthStorage,
  consumeOAuthSessionPersistencePreference,
  createSupabaseAuthStorageAdapterForTest,
  getAuthSessionPersistenceMode,
  prepareAuthSessionStorage,
  setAuthSessionPersistenceMode,
  setOAuthSessionPersistencePreference,
} = auth;

function resetStorage() {
  localStorage.clear();
  sessionStorage.clear();
}

resetStorage();
assert.equal(getAuthSessionPersistenceMode(), AUTH_SESSION_MODE_PERSISTENT, "Keep-signed-in must default to persistent mode");

setAuthSessionPersistenceMode(true);
assert.equal(localStorage.getItem(AUTH_SESSION_MODE_KEY), AUTH_SESSION_MODE_PERSISTENT);
assert.equal(sessionStorage.getItem(AUTH_SESSION_MODE_KEY), null);

setAuthSessionPersistenceMode(false);
assert.equal(sessionStorage.getItem(AUTH_SESSION_MODE_KEY), AUTH_SESSION_MODE_SESSION);
assert.equal(localStorage.getItem(AUTH_SESSION_MODE_KEY), null);

resetStorage();
prepareAuthSessionStorage({ keepSignedIn: true });
let adapter = createSupabaseAuthStorageAdapterForTest();
adapter.setItem("sb-test-auth-token", JSON.stringify({ access_token: "persistent-token" }));
assert.equal(localStorage.getItem("sb-test-auth-token"), JSON.stringify({ access_token: "persistent-token" }));
assert.equal(sessionStorage.getItem("sb-test-auth-token"), null);

resetStorage();
prepareAuthSessionStorage({ keepSignedIn: false });
adapter = createSupabaseAuthStorageAdapterForTest();
adapter.setItem("sb-test-auth-token", JSON.stringify({ access_token: "session-token" }));
assert.equal(sessionStorage.getItem("sb-test-auth-token"), JSON.stringify({ access_token: "session-token" }));
assert.equal(localStorage.getItem("sb-test-auth-token"), null);
assert.equal(adapter.getItem("sb-test-auth-token"), JSON.stringify({ access_token: "session-token" }), "Refresh must preserve session-only token within current tab session");

for (const storage of [localStorage, sessionStorage]) {
  for (const key of storage.map.keys()) {
    assert.ok(!/password|sifre|şifre/i.test(key), "Password-related key must never be written");
    assert.ok(!/password|sifre|şifre/i.test(storage.getItem(key)), "Password text must never be written");
  }
}

prepareAuthSessionStorage({ keepSignedIn: true });
localStorage.setItem("sb-local-auth-token", "{}");
sessionStorage.setItem("sb-session-auth-token", "{}");
clearSupabaseAuthStorage();
assert.equal(localStorage.getItem("sb-local-auth-token"), null, "Logout must clear persistent auth storage");
assert.equal(sessionStorage.getItem("sb-session-auth-token"), null, "Logout must clear session-only auth storage");
assert.equal(localStorage.getItem(AUTH_SESSION_MODE_KEY), null, "Logout must clear persistent mode key");
assert.equal(sessionStorage.getItem(AUTH_SESSION_MODE_KEY), null, "Logout must clear session mode key");

resetStorage();
setOAuthSessionPersistencePreference(false);
assert.equal(sessionStorage.getItem(AUTH_OAUTH_SESSION_MODE_KEY), AUTH_SESSION_MODE_SESSION);
assert.equal(getAuthSessionPersistenceMode(), AUTH_SESSION_MODE_SESSION, "Google preference must survive redirect in session storage");
assert.equal(consumeOAuthSessionPersistencePreference(), AUTH_SESSION_MODE_SESSION);
assert.equal(sessionStorage.getItem(AUTH_OAUTH_SESSION_MODE_KEY), null);
assert.equal(getAuthSessionPersistenceMode(), AUTH_SESSION_MODE_SESSION);

const app = fs.readFileSync("src/App.jsx", "utf8");
const onboarding = fs.readFileSync("src/CareerOnboardingPage.jsx", "utf8");
const appRendered = app.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

assert.ok(app.includes('const [keepSignedIn, setKeepSignedIn] = useState(true)'), "Keep-signed-in checkbox must be checked by default");
assert.ok(appRendered.includes("Bu cihazda oturumumu açık tut"), "Turkish keep-signed-in label missing");
assert.ok(app.includes("Keep me signed in"), "English keep-signed-in label missing");
assert.ok(appRendered.includes("Yalnızca kişisel cihazlarında kullanmanı öneririz."), "Turkish keep-signed-in helper missing");
assert.ok(app.includes("Recommended only on personal devices."), "English keep-signed-in helper missing");
assert.ok(app.includes("login({ keepSignedIn })"), "Email login must receive storage preference");
assert.ok(app.includes("loginWithGoogle(authNextPath"), "Google login call must preserve next path");
assert.ok(app.includes("{ keepSignedIn }"), "Google login must receive storage preference");
assert.ok(app.includes("prepareAuthSessionStorage({ keepSignedIn, clearExistingAuth: true })"), "Email login must prepare selected storage mode");
assert.ok(app.includes("setOAuthSessionPersistencePreference(keepSignedIn)"), "Google login must persist only the boolean preference");

assert.ok(app.includes('const [authStatus, setAuthStatus] = useState("initializing")'), "Auth initialization state missing");
assert.ok(onboarding.includes('if (authStatus === "initializing") return;'), "Career Discovery must not redirect before auth restoration finishes");
assert.ok(appRendered.includes("Oturumun kontrol ediliyor"), "Session restoration copy missing");
assert.ok(app.includes("getSafeAuthNext(location?.search"), "next parameter must remain preserved");

assert.ok(app.includes('const [profileStatus, setProfileStatus] = useState("idle")'), "Profile status state missing");
assert.ok(app.includes('"profile_missing"'), "Profile missing state missing");
assert.ok(app.includes('"profile_error"'), "Profile error state missing");
assert.ok(app.includes("retryCareerProfileLoad"), "Profile retry action missing");
assert.ok(appRendered.includes("Hesabına giriş yapıldı ancak kariyer profilin yüklenemedi."), "Dedicated profile error copy missing");
assert.ok(app.includes("setProfileError(profileLoadErrorMessage(lang))"), "Profile failure must use profile error channel");
assert.ok(!app.includes("setError(profileState.error)"), "Profile fetch error must not be mixed into generic login error state");
assert.ok(!app.includes("handleSupabaseAuthFailure(profileState"), "Profile fetch failure must not trigger auth logout handling");

assert.ok(app.includes("clearSupabaseAuthStorage()"), "Logout must clear Supabase auth storage");
assert.ok(app.includes("setCareerProfile(null);") && app.includes('setProfileStatus("profile_loading")'), "Switching users must clear previous profile while loading");

process.stdout.write("Sprint 6.2 auth/session validation passed.\n");
