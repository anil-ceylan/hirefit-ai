import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(process.argv[2] || "src/App.jsx", "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("  const careerProfileUserId =");
const end = source.indexOf("\n\n  useEffect(() => {\n    const trimmed = cvText.trim();", start);
assert.ok(start > 0 && end > start);
const code = source.slice(start, end);
const same = (a, b) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const tick = () => new Promise(setImmediate);
function harness() {
  const slots = [];
  const calls = { profile: [], progress: [] };
  const state = {};
  let cursor;
  let effect;
  let lastDeps;
  let cleanup;
  let pendingEffect;
  let api;
  const request = (kind, account) => new Promise((resolve, reject) => calls[kind].push({ account, resolve, reject }));
  const shared = {
    HF_API_BASE: "", lang: "TR", console: { error: () => {} },
    getApiAuthHeaders: async () => ({}),
    profileLoadErrorMessage: () => "load failed",
    loadLocalCareerProfile: () => null, loadLocalCareerProgress: () => [],
    buildCareerGrowthView: () => null,
    useRef: (initial) => { const i = cursor++; return slots[i] ||= { current: initial }; },
    useCallback: (fn, deps) => {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect: (fn, deps) => { effect = fn; pendingEffect = deps; },
  };
  for (const key of ["CareerProfile", "ProfileStatus", "ProfileError", "CareerGrowth"]) shared[`set${key}`] = (v) => { state[key] = v; };
  return {
    calls, state,
    render(user) {
      cursor = 0;
      api = runInNewContext(`(() => { ${code}; return { retryCareerProfileLoad }; })()`, {
        ...shared, user,
        fetchCareerProfileStatus: () => request("profile", user?.id),
        fetchCareerProgress: (_base, _headers, _lang, account) => request("progress", account.id),
      });
      if (!same(lastDeps, pendingEffect)) {
        cleanup?.();
        lastDeps = pendingEffect;
        cleanup = effect();
      }
    },
    retry: () => api.retryCareerProfileLoad(),
    unmount: () => cleanup?.(),
  };
}
async function finish(h, profileIndex, id) {
  h.calls.profile[profileIndex].resolve({ exists: true, profile: { id } });
  await tick();
  h.calls.progress.at(-1).resolve({ growth: { id } });
  await tick();
  assert.equal(h.state.CareerProfile.id, id);
  assert.equal(h.state.CareerGrowth.id, id);
}
const h = harness();
h.render({ id: "a" });
await finish(h, 0, "a");
for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"]) h.render({ id: "a", event });
assert.equal(h.calls.profile.length, 1);
assert.equal(h.calls.progress.length, 1);
h.render({ id: "b" });
await finish(h, 1, "b");
h.render(null);
assert.equal(h.state.CareerProfile, null);
h.render({ id: "b" });
await finish(h, 2, "b-login");
void h.retry();
await finish(h, 3, "b-refresh");
// Delayed profile responses cannot start progress or overwrite a newer account.
const stale = harness();
stale.render({ id: "a" });
stale.render({ id: "b" });
await finish(stale, 1, "b");
stale.calls.profile[0].resolve({ exists: true, profile: { id: "old-a" } });
await tick();
assert.equal(stale.state.CareerProfile.id, "b");
assert.equal(stale.calls.progress.length, 1);
// Account changes, logout and unmount invalidate progress already in flight.
for (const boundary of ["account", "logout", "unmount"]) {
  const s = harness();
  s.render({ id: "a" });
  s.calls.profile[0].resolve({ exists: true, profile: { id: "a" } });
  await tick();
  if (boundary === "account") { s.render({ id: "b" }); await finish(s, 1, "b"); }
  else if (boundary === "logout") s.render(null);
  else s.unmount();
  const before = JSON.stringify(s.state);
  s.calls.progress[0].resolve({ growth: { id: "stale" } });
  await tick();
  assert.equal(JSON.stringify(s.state), before);
}
// A newer explicit refresh wins, including when the older request rejects.
for (const reject of [false, true]) {
  const s = harness();
  s.render({ id: "a" });
  void s.retry();
  await finish(s, 1, "newer");
  if (reject) s.calls.profile[0].reject(new Error("synthetic stale failure"));
  else s.calls.profile[0].resolve({ exists: true, profile: { id: "older" } });
  await tick();
  assert.equal(s.state.CareerProfile.id, "newer");
  assert.equal(s.state.ProfileStatus, "profile_ready");
}
process.stdout.write("Career profile refetch: stable identity, initial load, account switch, logout/login, token-like updates, retry and stale responses passed.\n");
