export const ACTIVATION_STATES = Object.freeze({
  UNAUTHENTICATED: "unauthenticated",
  AUTHENTICATED_UNACTIVATED: "authenticated_unactivated",
  CAREER_PROFILE_IN_PROGRESS: "career_profile_in_progress",
  SNAPSHOT_READY: "snapshot_ready",
  ACTIVATED: "activated",
});

export function resolveActivationState({ user, careerProfile } = {}) {
  if (!user) return ACTIVATION_STATES.UNAUTHENTICATED;
  const profile = careerProfile && typeof careerProfile === "object" ? careerProfile : {};
  const completed = Boolean(profile.onboarding_completed);
  const hasSnapshot = Boolean(profile.career_snapshot || profile.snapshot || profile.first_analysis?.careerSnapshot);
  const hasDraft = Boolean(
    profile.onboarding_draft ||
      profile.basic_profile ||
      profile.target_roles?.length ||
      profile.goals?.targetRoles?.length
  );

  if (completed && hasSnapshot) return ACTIVATION_STATES.ACTIVATED;
  if (completed) return ACTIVATION_STATES.SNAPSHOT_READY;
  if (hasDraft) return ACTIVATION_STATES.CAREER_PROFILE_IN_PROGRESS;
  return ACTIVATION_STATES.AUTHENTICATED_UNACTIVATED;
}

export function buildActivationNavItems({ lang = "TR", activationState, careerProfile } = {}) {
  const tr = lang === "TR";
  const profileComplete = Boolean(careerProfile?.onboarding_completed);
  if (activationState === ACTIVATION_STATES.UNAUTHENTICATED) {
    return [
      { label: tr ? "Analiz" : "Analyze", path: "/analyze", viewKey: "analyze" },
      { label: tr ? "Fiyatlandırma" : "Pricing", path: "/", hash: "#pricing", sectionId: "pricing", viewKey: "pricing" },
    ];
  }

  return [
    { label: tr ? "Bugünkü Hamle" : "Today's Move", path: "/dashboard", viewKey: "dashboard" },
    { label: tr ? "Analiz" : "Analyze", path: "/analyze", viewKey: "analyze" },
    { label: tr ? "Fiyatlandırma" : "Pricing", path: "/", hash: "#pricing", sectionId: "pricing", viewKey: "pricing" },
    {
      label: tr ? "Profil" : "Profile",
      path: profileComplete ? "/career-dna?snapshot=1" : "/career-dna",
      viewKey: profileComplete ? "snapshot" : "careerDna",
    },
  ];
}

export function getActivationNavHref(item = {}) {
  const path = item.path || "/";
  if (item.hash) return `${path}${item.hash}`;
  if (item.sectionId && path === "/") return `${path}#${item.sectionId}`;
  return path;
}

export function getAuthIntentFromNext(nextPath = "") {
  const path = String(nextPath || "").split("?")[0];
  if (path === "/career-dna" || path === "/onboarding") return "career_discovery";
  if (path === "/app") return "application_validation";
  return "generic";
}

export function getContextualAuthCta({ lang = "TR", mode = "login", nextPath = "", loading = false } = {}) {
  const tr = lang === "TR";
  if (loading) return tr ? "Kayıt oluşturuluyor..." : "Creating account...";
  const intent = getAuthIntentFromNext(nextPath);

  if (intent === "career_discovery") {
    if (mode === "signup") return tr ? "Kariyer Profilini Oluştur" : "Build Career Profile";
    return tr ? "Kariyer Keşfine Devam Et" : "Continue to Career Discovery";
  }

  if (intent === "application_validation") {
    return tr ? "Başvuru Analizine Devam Et" : "Continue to Application Analysis";
  }

  if (mode === "signup") return tr ? "Kayıt Ol" : "Sign Up";
  return tr ? "Devam Et" : "Continue";
}

export function getCareerDiscoveryLoadingCopy({
  lang = "TR",
  hasLocalDraft = false,
  editMode = false,
  snapshotMode = false,
} = {}) {
  const tr = lang === "TR";
  const isResumeState = Boolean(hasLocalDraft || editMode || snapshotMode);
  if (isResumeState) {
    return {
      title: tr ? "Kariyer profilin hazırlanıyor..." : "Preparing your career profile...",
      support: tr
        ? "Var olan bilgilerini kontrol ediyoruz ve analizi kaldığın yerden hazırlıyoruz."
        : "We're checking your existing information and preparing the flow from where you left off.",
    };
  }
  return {
    title: tr ? "Kariyer keşfi hazırlanıyor..." : "Preparing career discovery...",
    support: tr
      ? "İlk sorularını ve analiz akışını hazırlıyoruz."
      : "We're preparing your first questions and analysis flow.",
  };
}
