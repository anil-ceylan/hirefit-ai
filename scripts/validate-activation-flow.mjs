import assert from "node:assert/strict";
import {
  ACTIVATION_STATES,
  buildActivationNavItems,
  getAuthIntentFromNext,
  getCareerDiscoveryLoadingCopy,
  getContextualAuthCta,
  resolveActivationState,
} from "../src/utils/activationFlow.js";

function testActivationStates() {
  assert.equal(resolveActivationState({ user: null }), ACTIVATION_STATES.UNAUTHENTICATED);
  assert.equal(resolveActivationState({ user: { id: "u1" }, careerProfile: null }), ACTIVATION_STATES.AUTHENTICATED_UNACTIVATED);
  assert.equal(
    resolveActivationState({ user: { id: "u1" }, careerProfile: { onboarding_draft: { lastStep: 2 } } }),
    ACTIVATION_STATES.CAREER_PROFILE_IN_PROGRESS
  );
  assert.equal(
    resolveActivationState({ user: { id: "u1" }, careerProfile: { onboarding_completed: true } }),
    ACTIVATION_STATES.SNAPSHOT_READY
  );
  assert.equal(
    resolveActivationState({ user: { id: "u1" }, careerProfile: { onboarding_completed: true, career_snapshot: {} } }),
    ACTIVATION_STATES.ACTIVATED
  );
}

function testNavigation() {
  const signedOut = buildActivationNavItems({ lang: "TR", activationState: ACTIVATION_STATES.UNAUTHENTICATED });
  assert.deepEqual(signedOut.map((item) => item.label), ["Analiz", "Fiyatlandırma"]);
  assert.equal(signedOut.some((item) => item.label === "Dashboard" || item.label === "Profil"), false);

  const signedIn = buildActivationNavItems({
    lang: "TR",
    activationState: ACTIVATION_STATES.ACTIVATED,
    careerProfile: { onboarding_completed: true },
  });
  assert.deepEqual(signedIn.map((item) => item.label), ["Bugünkü Hamle", "Analiz", "Fiyatlandırma", "Profil"]);
  assert.equal(signedIn.find((item) => item.label === "Profil").path, "/career-dna?snapshot=1");
}

function testAuthCtas() {
  assert.equal(getAuthIntentFromNext("/career-dna"), "career_discovery");
  assert.equal(getAuthIntentFromNext("/app"), "application_validation");
  assert.equal(
    getContextualAuthCta({ lang: "TR", mode: "signup", nextPath: "/career-dna" }),
    "Kariyer Profilini Oluştur"
  );
  assert.equal(
    getContextualAuthCta({ lang: "TR", mode: "login", nextPath: "/career-dna" }),
    "Kariyer Keşfine Devam Et"
  );
  assert.equal(
    getContextualAuthCta({ lang: "TR", mode: "signup", nextPath: "/app" }),
    "Başvuru Analizine Devam Et"
  );
  assert.equal(getContextualAuthCta({ lang: "EN", mode: "login", nextPath: "/app" }), "Continue to Application Analysis");
}

function testLoadingCopy() {
  assert.equal(
    getCareerDiscoveryLoadingCopy({ lang: "TR", hasLocalDraft: false }).title,
    "Kariyer keşfi hazırlanıyor..."
  );
  assert.equal(
    getCareerDiscoveryLoadingCopy({ lang: "TR", hasLocalDraft: true }).title,
    "Kariyer profilin hazırlanıyor..."
  );
}

testActivationStates();
testNavigation();
testAuthCtas();
testLoadingCopy();

process.stdout.write("Activation flow regression checks passed.\n");
