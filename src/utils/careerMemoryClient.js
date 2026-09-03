import {
  extractCareerProfileSnapshot,
  mergeCareerProfiles,
  compareCareerMemory,
} from "../../lib/careerMemory/index.js";
import { apiUrl } from "./apiBase.js";
import { parseLocalStorageJson } from "./safeJson.js";

const LOCAL_KEY = "hirefit-career-profile-v1";

export function loadLocalCareerProfile() {
  return parseLocalStorageJson(localStorage.getItem(LOCAL_KEY), null, { label: "career-profile-local" });
}

export function saveLocalCareerProfile(profile) {
  if (!profile) {
    localStorage.removeItem(LOCAL_KEY);
    return;
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
}

export async function fetchCareerProfileStatus(apiBase, getHeaders, { allowLocalFallback = true, lang = "TR" } = {}) {
  const localProfile = allowLocalFallback ? loadLocalCareerProfile() : null;
  try {
    const res = await fetch(apiUrl("/api/career-profile"), {
      headers: await getHeaders({ requireSession: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        exists: null,
        profile: localProfile,
        onboarding_completed: Boolean(localProfile?.onboarding_completed),
        authenticated: false,
        offline: false,
        error: data?.error || (lang === "TR" ? "Profil yüklenemedi." : "Could not load profile."),
      };
    }
    if (data?.profileFetchFailed || data?.exists == null) {
      return {
        exists: null,
        profile: localProfile,
        onboarding_completed: Boolean(localProfile?.onboarding_completed),
        authenticated: Boolean(data?.authenticated),
        offline: false,
        error: lang === "TR"
          ? "Kariyer profilin şu anda yüklenemedi. Lütfen tekrar deneyin."
          : "Your career profile could not be loaded right now. Please try again.",
      };
    }
    if (data?.authenticated === false) {
      return {
        exists: null,
        profile: localProfile,
        onboarding_completed: Boolean(localProfile?.onboarding_completed),
        authenticated: false,
        offline: false,
        error: lang === "TR"
          ? "Oturum doğrulanırken kariyer profilin bekletiliyor."
          : "Your career profile is waiting while your session is verified.",
      };
    }
    if (data?.profile) {
      saveLocalCareerProfile(data.profile);
      return {
        exists: true,
        profile: data.profile,
        onboarding_completed: Boolean(data?.onboarding_completed ?? data.profile?.onboarding_completed),
        authenticated: Boolean(data?.authenticated),
        offline: false,
      };
    }
    if (data?.exists === false) {
      return {
        exists: false,
        profile: null,
        onboarding_completed: false,
        authenticated: Boolean(data?.authenticated),
        offline: false,
      };
    }
    return {
      exists: null,
      profile: localProfile,
      onboarding_completed: Boolean(localProfile?.onboarding_completed),
      authenticated: Boolean(data?.authenticated),
      offline: false,
    };
  } catch {
    return {
      exists: null,
      profile: localProfile,
      onboarding_completed: Boolean(localProfile?.onboarding_completed),
      authenticated: false,
      offline: true,
      error: lang === "TR"
        ? "Kariyer profilin şu anda yüklenemedi. Lütfen tekrar deneyin."
        : "Your career profile could not be loaded right now. Please try again.",
    };
  }
}

export async function fetchCareerProfile(apiBase, getHeaders) {
  const status = await fetchCareerProfileStatus(apiBase, getHeaders, { allowLocalFallback: true });
  return status.profile;
}

export async function syncCareerMemoryAfterAnalyze({
  apiBase,
  getHeaders,
  user,
  cvText,
  engineV2,
  score,
  roleSuggestions = [],
  lang,
}) {
  const roleList = (roleSuggestions || []).map((r) => (typeof r === "string" ? r : r?.role)).filter(Boolean);
  const snapshot = extractCareerProfileSnapshot({
    cvText,
    engineV2,
    atsIntelligence: engineV2?.ATS
      ? { displayMissingCritical: engineV2.ATS.missing_keywords }
      : null,
    roleSuggestions: roleList,
    score,
    lang,
  });

  if (user?.id) {
    try {
      const res = await fetch(`${apiBase}/api/career-memory/sync`, {
        method: "POST",
        headers: await getHeaders({ requireSession: false }),
        body: JSON.stringify({
          cvText,
          engineV2,
          score,
          roleSuggestions: roleList,
          lang,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) saveLocalCareerProfile(data.profile);
        return { profile: data.profile, comparison: data.comparison };
      }
    } catch {
      // Fall through to local profile memory below.
    }
  }

  const previous = loadLocalCareerProfile();
  const merged = mergeCareerProfiles(previous, snapshot);
  const comparison = compareCareerMemory(previous, snapshot, lang);
  saveLocalCareerProfile(merged);
  return { profile: merged, comparison };
}

