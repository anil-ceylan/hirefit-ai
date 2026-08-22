import assert from "node:assert/strict";
import {
  ACTIVATION_STATES,
  buildActivationNavItems,
  getActivationNavHref,
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
  assert.equal(getActivationNavHref(signedIn.find((item) => item.label === "Bugünkü Hamle")), "/dashboard");
  assert.equal(getActivationNavHref(signedIn.find((item) => item.label === "Analiz")), "/analyze");
  assert.equal(getActivationNavHref(signedIn.find((item) => item.label === "Fiyatlandırma")), "/#pricing");
  assert.equal(getActivationNavHref(signedIn.find((item) => item.label === "Profil")), "/career-dna?snapshot=1");

  const incompleteProfileNav = buildActivationNavItems({
    lang: "TR",
    activationState: ACTIVATION_STATES.CAREER_PROFILE_IN_PROGRESS,
    careerProfile: { onboarding_completed: false },
  });
  assert.equal(getActivationNavHref(incompleteProfileNav.find((item) => item.label === "Profil")), "/career-dna");

  const routesFromProfile = {
    profileToToday: getActivationNavHref(signedIn.find((item) => item.viewKey === "dashboard")),
    profileToAnalyze: getActivationNavHref(signedIn.find((item) => item.viewKey === "analyze")),
    profileToPricing: getActivationNavHref(signedIn.find((item) => item.viewKey === "pricing")),
    analyzeToProfile: getActivationNavHref(signedIn.find((item) => item.viewKey === "snapshot")),
    dashboardToProfile: getActivationNavHref(signedIn.find((item) => item.viewKey === "snapshot")),
    pricingToProfile: getActivationNavHref(signedIn.find((item) => item.viewKey === "snapshot")),
  };
  assert.deepEqual(routesFromProfile, {
    profileToToday: "/dashboard",
    profileToAnalyze: "/analyze",
    profileToPricing: "/#pricing",
    analyzeToProfile: "/career-dna?snapshot=1",
    dashboardToProfile: "/career-dna?snapshot=1",
    pricingToProfile: "/career-dna?snapshot=1",
  });
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
