import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildActivationNavItems,
  resolveCareerProfilePath,
  ACTIVATION_STATES,
} from "../src/utils/activationFlow.js";
import {
  getAccountAvatarUrl,
  getAccountDisplayName,
  getAccountInitials,
} from "../src/utils/accountAvatarModel.js";
import {
  MAX_ACCOUNT_AVATAR_BYTES,
  isSupportedAccountAvatarFile,
} from "../src/utils/accountAvatarClient.js";
import {
  PROFILE_AVATAR_UPLOAD_FLAG,
  isProfileAvatarUploadEnabled,
} from "../src/utils/accountAvatarFeatureFlag.js";

const envExample = fs.readFileSync(".env.example", "utf8");
const app = fs.readFileSync("src/App.jsx", "utf8");
const main = fs.readFileSync("src/main.jsx", "utf8");
const ambientCss = fs.readFileSync("src/landing-ambient.css", "utf8");
const events = fs.readFileSync("src/utils/activationEvents.js", "utf8");
const accountAvatar = fs.readFileSync("src/components/account/AccountAvatar.jsx", "utf8");
const avatarClient = fs.readFileSync("src/utils/accountAvatarClient.js", "utf8");
const avatarFlag = fs.readFileSync("src/utils/accountAvatarFeatureFlag.js", "utf8");
const avatarModel = fs.readFileSync("src/utils/accountAvatarModel.js", "utf8");
const avatarStorage = fs.readFileSync("lib/account/avatarStorage.js", "utf8");
const accountRoutes = fs.readFileSync("lib/account/accountRoutes.js", "utf8");
const vercelRouter = fs.readFileSync("lib/vercelApi/careerApiRouter.js", "utf8");
const server = fs.readFileSync("server/server.js", "utf8");

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
  assert.match(app, /<AccountAvatar[\s\S]*className="hf-nav-avatar"/, "Header trigger should use shared account avatar.");
  assert.doesNotMatch(app, /avatarLetter/, "Header must not use email-first avatar letter fallback.");
  assert.match(app, /navigate\(profilePath\)/, "Profile menu/chip should use shared profile route resolver.");
  assert.match(app, /navigate\("\/settings"\)/, "Settings menu should route to /settings.");
  assert.match(main, /path="settings" element={<AccountSettingsPage \/>}/, "Protected settings route missing.");
  assert.match(app, /export function AccountSettingsPage/, "AccountSettingsPage export missing.");
  assert.match(app, /<ProfilePhotoControl[\s\S]*apiBase=\{HF_API_BASE\}/, "Settings should expose profile photo control.");
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
  assert.match(accountAvatar, /role="dialog" aria-modal="true"/, "Profile photo modal should expose dialog semantics.");
  assert.match(accountAvatar, /accept="image\/jpeg,image\/png,image\/webp"/, "Profile photo upload should restrict visible file types.");
  assert.match(app, /event\.key === "Escape"/, "Escape close behavior should exist.");
  assert.match(accountAvatar, /event\.key === "Escape"/, "Profile photo modal should close with Escape.");
  assert.match(ambientCss, /\.hf-nav-profile-menu\s*\{[^}]*min-width: 252px/s, "Expanded profile menu styling missing.");
  assert.match(ambientCss, /position: fixed;[\s\S]*\.hf-nav-profile-menu/s, "Mobile profile menu should avoid clipping.");
  assert.match(ambientCss, /\.hf-profile-photo-modal__actions[\s\S]*width: 100%/s, "Profile photo modal should adapt on mobile.");
  assert.match(ambientCss, /focus-visible/, "Visible focus states missing.");
}

function testStateIntegrity() {
  assert.doesNotMatch(app, /career_gps\s*=\s*/i, "Settings/menu sprint should not overwrite career_gps.");
  assert.doesNotMatch(app, /decision_loop\s*=\s*/i, "Settings/menu sprint should not overwrite decision_loop.");
  assert.doesNotMatch(app, /setCareerProfile\(null\)[\s\S]{0,300}AccountSettingsPage/, "Settings should not clear Career Profile state.");
}

function testAvatarFallbackAndUploadContracts() {
  const emailUser = { email: "write_188@hotmail.com", user_metadata: {} };
  const namedProfile = { basic_profile: { fullName: "Muhammet" } };
  const twoNameProfile = { basic_profile: { fullName: "Muhammet Anıl Ceylan" } };
  const avatarProfile = { basic_profile: { fullName: "Muhammet", avatar_url: "https://cdn.example/avatar.png?v=1" } };

  assert.equal(getAccountDisplayName(emailUser, namedProfile), "Muhammet", "Profile name should be the display-name source.");
  assert.equal(getAccountInitials(emailUser, namedProfile), "M", "Single profile name should beat email initial.");
  assert.equal(getAccountInitials(emailUser, twoNameProfile), "MA", "Multi-part profile names should use sensible initials.");
  assert.equal(getAccountInitials(emailUser, null), "W", "Email initial should remain last-resort fallback.");
  assert.equal(getAccountAvatarUrl(emailUser, avatarProfile), "https://cdn.example/avatar.png?v=1", "Persisted avatar URL should win over initials.");

  assert.equal(isSupportedAccountAvatarFile({ type: "image/jpeg", name: "avatar.jpg", size: 20 }), true);
  assert.equal(isSupportedAccountAvatarFile({ type: "image/png", name: "avatar.png", size: 20 }), true);
  assert.equal(isSupportedAccountAvatarFile({ type: "image/webp", name: "avatar.webp", size: 20 }), true);
  assert.equal(isSupportedAccountAvatarFile({ type: "text/plain", name: "avatar.txt", size: 20 }), false);
  assert.equal(MAX_ACCOUNT_AVATAR_BYTES, 5 * 1024 * 1024, "Avatar client must cap uploads at 5 MB.");

  assert.match(avatarModel, /basic\.fullName[\s\S]*user\?\.email/s, "Avatar fallback priority should evaluate profile name before email.");
  assert.match(avatarClient, /FormData/, "Avatar upload should use multipart FormData.");
  assert.match(avatarClient, /delete next\["Content-Type"\]/, "Multipart upload must not force JSON content-type.");
}

function testAvatarUploadFeatureGate() {
  assert.equal(PROFILE_AVATAR_UPLOAD_FLAG, "VITE_PROFILE_AVATAR_UPLOAD_ENABLED");
  assert.equal(isProfileAvatarUploadEnabled({}), false, "Avatar upload should default disabled when flag is absent.");
  assert.equal(
    isProfileAvatarUploadEnabled({ VITE_PROFILE_AVATAR_UPLOAD_ENABLED: "false" }),
    false,
    "Avatar upload should stay disabled unless explicitly true."
  );
  assert.equal(
    isProfileAvatarUploadEnabled({ VITE_PROFILE_AVATAR_UPLOAD_ENABLED: "true" }),
    true,
    "Avatar upload should be explicitly enableable for local testing."
  );
  assert.match(envExample, /VITE_PROFILE_AVATAR_UPLOAD_ENABLED=false/, "Avatar upload flag should be documented disabled in env example.");
  assert.match(avatarFlag, /toLowerCase\(\) === "true"/, "Avatar flag should only enable on explicit true.");
  assert.match(accountAvatar, /export function ProfilePhotoControl\(props\)[\s\S]*if \(!isProfileAvatarUploadEnabled\(\)\) return null;/, "Profile photo control must be hidden while disabled.");
  assert.match(accountAvatar, /function ProfilePhotoControlInner/, "Upload code should remain preserved behind the feature gate.");
}

function testAvatarBackendSafety() {
  assert.match(avatarStorage, /AVATAR_BUCKET = "profile-avatars"/, "Avatar storage bucket should be dedicated.");
  assert.match(avatarStorage, /MAX_AVATAR_BYTES = 5 \* 1024 \* 1024/, "Avatar storage must enforce 5 MB limit.");
  assert.match(avatarStorage, /SUPABASE_SERVICE_ROLE_KEY/, "Avatar writes should remain server-side.");
  assert.match(avatarStorage, /`\$\{userId\}\/avatar-\$\{version\}/, "Avatar object path must be keyed by user.id.");
  assert.doesNotMatch(avatarStorage, /email/i, "Avatar storage paths must not use email identifiers.");
  assert.match(avatarStorage, /avatarUrl[\s\S]*avatar_path/s, "Avatar metadata should persist in existing profile basic_profile.");
  assert.match(accountRoutes, /requireAuthExpress/, "Local avatar routes must require server-side auth.");
  assert.match(accountRoutes, /app\.post\("\/api\/account\/avatar"/, "Local avatar upload route missing.");
  assert.match(accountRoutes, /app\.delete\("\/api\/account\/avatar"/, "Local avatar delete route missing.");
  assert.match(vercelRouter, /handleAccountAvatarUpload/, "Vercel catch-all upload handler missing.");
  assert.match(vercelRouter, /handleAccountAvatarDelete/, "Vercel catch-all delete handler missing.");
  assert.match(vercelRouter, /Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS"/, "Vercel CORS should allow DELETE.");
  assert.match(server, /registerAccountRoutes\(app\)/, "Express server should register account routes.");
  assert.match(server, /GET,POST,PATCH,DELETE,OPTIONS/, "Express CORS should allow DELETE.");
}

testProfileRouting();
testMenuAndSettingsSource();
testFeedbackSafety();
testAccessibilityAndMobile();
testStateIntegrity();
testAvatarFallbackAndUploadContracts();
testAvatarUploadFeatureGate();
testAvatarBackendSafety();

process.stdout.write("Account menu and settings validation passed.\n");
