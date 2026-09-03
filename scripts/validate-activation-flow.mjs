import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACTIVATION_STATES,
  DASHBOARD_ROUTE_STATES,
  buildActivationNavItems,
  getActivationNavHref,
  getAuthIntentFromNext,
  getCareerDiscoveryLoadingCopy,
  getContextualAuthCta,
  resolveActivationState,
  resolveDashboardRouteState,
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

function testDashboardRouteGuard() {
  const completedUser = { id: "u1", email_confirmed_at: "2026-01-01T00:00:00.000Z" };
  const completedProfile = { onboarding_completed: true, career_snapshot: { summary: "ready" } };

  assert.deepEqual(
    resolveDashboardRouteState({
      authStatus: "authenticated",
      user: completedUser,
      isUserEmailVerified: true,
      profileStatus: "profile_loading",
      careerProfile: null,
    }),
    { state: DASHBOARD_ROUTE_STATES.LOADING },
    "Dashboard must not redirect completed users while profile completion is unresolved"
  );

  assert.deepEqual(
    resolveDashboardRouteState({
      authStatus: "authenticated",
      user: completedUser,
      isUserEmailVerified: true,
      profileStatus: "profile_ready",
      careerProfile: completedProfile,
    }),
    { state: DASHBOARD_ROUTE_STATES.READY },
    "Completed Career DNA users must remain on /dashboard after hydration"
  );

  assert.deepEqual(
    resolveDashboardRouteState({
      authStatus: "authenticated",
      user: completedUser,
      isUserEmailVerified: true,
      profileStatus: "profile_missing",
      careerProfile: null,
    }),
    { state: DASHBOARD_ROUTE_STATES.REDIRECT_PROFILE, path: "/career-dna" },
    "Only an authoritative missing profile should redirect to Career DNA"
  );

  assert.deepEqual(
    resolveDashboardRouteState({
      authStatus: "authenticated",
      user: completedUser,
      isUserEmailVerified: true,
      profileStatus: "profile_ready",
      careerProfile: { onboarding_completed: false },
    }),
    { state: DASHBOARD_ROUTE_STATES.REDIRECT_PROFILE, path: "/career-dna" },
    "Existing incomplete drafts should still be protected from Dashboard"
  );

  assert.deepEqual(
    resolveDashboardRouteState({
      authStatus: "unauthenticated",
      user: null,
      isUserEmailVerified: false,
      profileStatus: "idle",
      careerProfile: null,
    }),
    { state: DASHBOARD_ROUTE_STATES.REDIRECT_LOGIN, path: "/login?next=%2Fdashboard" },
    "Unauthenticated Dashboard access should preserve the existing login guard"
  );
}

function testProfileFetchSafetySource() {
  const memoryClient = readFileSync("src/utils/careerMemoryClient.js", "utf8");
  assert.match(
    memoryClient,
    /data\?\.authenticated === false[\s\S]*exists: null/,
    "Unauthenticated career-profile responses must not be interpreted as authoritative missing profiles."
  );
}

testActivationStates();
testNavigation();
testAuthCtas();
testLoadingCopy();
testDashboardRouteGuard();
testProfileFetchSafetySource();

process.stdout.write("Activation flow regression checks passed.\n");
