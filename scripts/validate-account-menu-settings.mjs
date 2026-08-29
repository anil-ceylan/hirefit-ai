import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildActivationNavItems,
  resolveCareerProfilePath,
  ACTIVATION_STATES,
} from "../src/utils/activationFlow.js";

const app = fs.readFileSync("src/App.jsx", "utf8");
const main = fs.readFileSync("src/main.jsx", "utf8");
const ambientCss = fs.readFileSync("src/landing-ambient.css", "utf8");
const events = fs.readFileSync("src/utils/activationEvents.js", "utf8");

function testProfileRouting() {
  assert.equal(
    resolveCareerProfilePath({ careerProfile: { onboarding_completed: true }, profileStatus: "profile_ready" }),
    "/career-dna?snapshot=1",
    "Completed users should route to the saved Career Profile/Snapshot."
  );
  assert.equal(
    resolveCareerProfilePath({ careerProfile: { onboarding_completed: false }, profileStatus: "profile_ready" }),
    "/career-dna",
    "Incomplete users should route to Career DNA."
  );
  assert.equal(
    resolveCareerProfilePath({ careerProfile: null, profileStatus: "profile_loading" }),
    "/dashboard",
    "Loading profile state must not be treated as incomplete."
  );

  const completedNav = buildActivationNavItems({
    lang: "TR",
    activationState: ACTIVATION_STATES.ACTIVATED,
    careerProfile: { onboarding_completed: true },
    profileStatus: "profile_ready",
  });
  assert.equal(completedNav.find((item) => item.label === "Profil")?.path, "/career-dna?snapshot=1");

  const loadingNav = buildActivationNavItems({
    lang: "TR",
    activationState: ACTIVATION_STATES.CAREER_PROFILE_IN_PROGRESS,
    careerProfile: null,
    profileStatus: "profile_loading",
  });
  assert.equal(loadingNav.find((item) => item.label === "Profil")?.path, "/dashboard");
}

function testMenuAndSettingsSource() {
  assert.match(app, /t\.myProfile/, "Profile menu item missing.");
  assert.match(app, /t\.accountSettings/, "Settings menu item missing.");
  assert.match(app, /t\.sendFeedback/, "Feedback menu item missing.");
  assert.match(app, /navigate\(profilePath\)/, "Profile menu/chip should use shared profile route resolver.");
  assert.match(app, /navigate\("\/settings"\)/, "Settings menu should route to /settings.");
  assert.match(main, /path="settings" element={<AccountSettingsPage \/>}/, "Protected settings route missing.");
  assert.match(app, /export function AccountSettingsPage/, "AccountSettingsPage export missing.");
  assert.match(app, /resetPasswordForEmail/, "Password reset should use Supabase auth reset flow.");
  assert.doesNotMatch(app, /localStorage\.setItem\([^)]*password/i, "Settings must not store passwords locally.");
  assert.match(app, /Hesap Verileri/, "Account data section missing.");
  assert.match(app, /disabled>\s*\{tr \? "Hesabı Sil"/, "Unsafe delete account control should remain disabled.");
}

function testFeedbackSafety() {
  assert.match(app, /function BetaFeedbackModal/, "Feedback modal missing.");
  assert.match(app, /mailto:\$\{FEEDBACK_CONTACT_EMAIL\}/, "Feedback should use beta-safe mailto fallback.");
  assert.match(app, /Mesajın yerel olarak kaydedilmez/, "Feedback persistence limitation must be explicit.");
  assert.doesNotMatch(app, /fetch\([^)]*feedback/i, "Feedback must not fake an unsupported persistence API.");
  assert.match(events, /"feedback_opened"/, "Feedback opened event missing.");
  assert.match(events, /"feedback_mailto_started"/, "Feedback mailto event missing.");
}

function testAccessibilityAndMobile() {
  assert.match(app, /aria-haspopup="menu"/, "Profile menu trigger should expose menu semantics.");
  assert.match(app, /role="dialog" aria-modal="true"/, "Feedback modal should expose dialog semantics.");
  assert.match(app, /event\.key === "Escape"/, "Escape close behavior should exist.");
  assert.match(ambientCss, /\.hf-nav-profile-menu\s*\{[^}]*min-width: 252px/s, "Expanded profile menu styling missing.");
  assert.match(ambientCss, /position: fixed;[\s\S]*\.hf-nav-profile-menu/s, "Mobile profile menu should avoid clipping.");
  assert.match(ambientCss, /focus-visible/, "Visible focus states missing.");
}

function testStateIntegrity() {
  assert.doesNotMatch(app, /career_gps\s*=\s*/i, "Settings/menu sprint should not overwrite career_gps.");
  assert.doesNotMatch(app, /decision_loop\s*=\s*/i, "Settings/menu sprint should not overwrite decision_loop.");
  assert.doesNotMatch(app, /setCareerProfile\(null\)[\s\S]{0,300}AccountSettingsPage/, "Settings should not clear Career Profile state.");
}

testProfileRouting();
testMenuAndSettingsSource();
testFeedbackSafety();
testAccessibilityAndMobile();
testStateIntegrity();

process.stdout.write("Account menu and settings validation passed.\n");
