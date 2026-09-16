import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

assert.match(
  app,
  /user && profileStatus === "profile_ready" && careerScore\.score != null/,
  "authenticated header score must wait for confirmed profile hydration"
);
assert.match(app, /setProfileStatus\("profile_loading"\)/, "profile loading state must remain explicit");
assert.match(app, /setProfileStatus\("profile_error"\)/, "profile errors must remain explicit");
assert.match(app, /setProfileStatus\("profile_missing"\)/, "confirmed missing profiles must remain distinct");
assert.match(app, /getNavCareerScore\(\{ careerProfile, careerGrowth, scoreHistory \}\)/, "score calculation must remain unchanged");

const render = ({ authenticated, status, score }) =>
  authenticated && status === "profile_ready" && score != null ? String(score) : null;
assert.equal(render({ authenticated: true, status: "profile_loading", score: 63 }), null);
assert.equal(render({ authenticated: true, status: "profile_error", score: 63 }), null);
assert.equal(render({ authenticated: true, status: "profile_ready", score: 84 }), "84");
assert.equal(render({ authenticated: false, status: "idle", score: 63 }), null);
