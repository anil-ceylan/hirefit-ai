import { getCareerDnaQuestions } from "../../lib/careerOnboarding/careerDna.js";
import { buildCareerIntelligence } from "../../lib/careerIntelligence/buildIntelligence.js";
import { buildDnaResult } from "../../lib/careerOnboarding/dnaResult.js";
import { generateProfileSummary } from "../../lib/careerOnboarding/generateSummary.js";
import { buildCareerSnapshot } from "../../lib/careerOnboarding/careerSnapshot.js";
import { friendlyApiMessage, isNetworkError, apiUrl } from "./apiBase.js";
import { loadLocalCareerProfile } from "./careerMemoryClient.js";
import {
  EXPERIENCE_SIGNAL_OPTIONS,
  LEADERSHIP_SIGNAL_OPTIONS,
  normalizeSignalSelection,
  normalizePortfolioLinks,
  buildAnalysisSources,
} from "../../lib/careerOnboarding/careerSignalSchema.js";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchCareerOnboarding(apiBase, getHeaders, lang) {
  const langParam = lang === "TR" ? "tr" : "en";
  const url = apiUrl(`/api/career-onboarding?lang=${langParam}`);
  const localProfile = loadLocalCareerProfile();
  try {
    const res = await fetch(url, {
      headers: await getHeaders({ requireSession: true }),
    });
    const body = await parseJsonSafe(res);
    if (!res.ok) {
      return {
        profile: localProfile,
        questions: getCareerDnaQuestions(lang),
        onboarding_completed: Boolean(localProfile?.onboarding_completed),
        exists: null,
        offline: true,
        error: friendlyApiMessage(res.status, body?.error, lang),
      };
    }
    if (body?.profileFetchFailed || body?.exists == null) {
      return {
        profile: localProfile,
        questions: body.questions || getCareerDnaQuestions(lang),
        onboarding_completed: Boolean(localProfile?.onboarding_completed),
        exists: null,
        offline: true,
        error: lang === "TR"
          ? "Kariyer profilin şu anda yüklenemedi. Lütfen tekrar deneyin."
          : "Your career profile could not be loaded right now. Please try again.",
      };
    }
    return {
      profile: body.profile ?? null,
      questions: body.questions || getCareerDnaQuestions(lang),
      onboarding_completed: Boolean(body.onboarding_completed),
      exists: Boolean(body.exists),
      offline: false,
    };
  } catch (e) {
    if (isNetworkError(e)) {
      return {
        profile: localProfile,
        questions: getCareerDnaQuestions(lang),
        onboarding_completed: Boolean(localProfile?.onboarding_completed),
        exists: null,
        offline: true,
      };
    }
    return {
      profile: localProfile,
      questions: getCareerDnaQuestions(lang),
      onboarding_completed: Boolean(localProfile?.onboarding_completed),
      exists: null,
      offline: true,
      error: friendlyApiMessage(0, e, lang),
    };
  }
}

export async function saveOnboardingDraft(apiBase, getHeaders, { step, draft, lang }) {
  try {
    const res = await fetch(apiUrl("/api/career-onboarding/draft"), {
      method: "PATCH",
      headers: await getHeaders({ requireSession: true }),
      body: JSON.stringify({ step, draft, lang }),
    });
    const body = await parseJsonSafe(res);
    if (!res.ok) return { ok: false, offline: false };
    return {
      ok: true,
      profile: body.profile,
      offline: false,
      storageUnavailable: Boolean(body.storageUnavailable),
    };
  } catch (e) {
    if (isNetworkError(e)) return { ok: false, offline: true };
    return { ok: false, offline: false };
  }
}

/**
 * Upload CV — never throws; returns { success, fileName, fileUrl, error }.
 */
export async function uploadOnboardingCv(_apiBase, getHeaders, file) {
  const fd = new FormData();
  fd.append("cvFile", file);
  const headers = { ...(await getHeaders({ requireSession: true })) };
  delete headers["Content-Type"];
  try {
    const res = await fetch(apiUrl("/api/career-onboarding/upload-cv"), {
      method: "POST",
      headers,
      body: fd,
    });
    const body = await parseJsonSafe(res);
    if (!res.ok) {
      return {
        success: false,
        fileName: file?.name || null,
        fileUrl: null,
        error: friendlyApiMessage(res.status, body?.error, "TR"),
      };
    }
    return {
      success: Boolean(body.success),
      fileName: body.fileName || file?.name,
      fileUrl: body.fileUrl ?? null,
      mimeType: body.mimeType,
      size: body.size,
      mock: Boolean(body.mock),
    };
  } catch (e) {
    return {
      success: false,
      fileName: file?.name || null,
      fileUrl: null,
      error: friendlyApiMessage(0, e, "TR"),
    };
  }
}

export async function completeCareerOnboarding(apiBase, getHeaders, payload) {
  try {
    const res = await fetch(apiUrl("/api/career-onboarding/complete"), {
      method: "POST",
      headers: await getHeaders({ requireSession: true }),
      body: JSON.stringify(payload),
    });
    const body = await parseJsonSafe(res);
    if (!res.ok) {
      const localProfile = buildLocalOnboardingProfile(payload);
      return {
        success: true,
        mode: "local",
        profile: localProfile,
        offline: true,
        error: friendlyApiMessage(res.status, body?.error, payload?.lang || "TR"),
      };
    }
    if (body?.storageUnavailable) {
      const localProfile = buildLocalOnboardingProfile(payload);
      return {
        success: true,
        mode: "local",
        profile: localProfile,
        offline: true,
        error: friendlyApiMessage(500, "storage unavailable", payload?.lang || "TR"),
      };
    }
    return {
      success: Boolean(body.success ?? true),
      mode: body.mode || "created",
      profile: body.profile,
      offline: false,
    };
  } catch (e) {
    const localProfile = buildLocalOnboardingProfile(payload);
    return {
      success: true,
      mode: "local",
      profile: localProfile,
      offline: true,
      error: friendlyApiMessage(0, e, payload?.lang || "TR"),
    };
  }
}

/** Offline fallback when API complete is unavailable */
export function buildLocalOnboardingProfile({
  basic,
  goals,
  dnaAnswers,
  readinessAnswers,
  cv,
  experienceSignals,
  leadershipSignals,
  linkedin,
  github,
  portfolio,
  website,
  behance,
  dribbble,
  cvUploaded,
  cvSignalCount,
  analysisSources,
  lang = "TR",
}) {
  const tr = lang === "TR";
  const existing = loadLocalCareerProfile();
  const name = basic?.fullName?.trim() || [basic?.firstName, basic?.lastName].filter(Boolean).join(" ");
  const cvFields = cv || {};
  const normalizedGoals = goals || {};
  const normalizedExperienceSignals = normalizeSignalSelection(
    experienceSignals || basic?.experienceSignals,
    EXPERIENCE_SIGNAL_OPTIONS,
    readinessAnswers?.experience
  );
  const normalizedLeadershipSignals = normalizeSignalSelection(
    leadershipSignals || basic?.leadershipSignals,
    LEADERSHIP_SIGNAL_OPTIONS,
    readinessAnswers?.leadership
  );
  const portfolioLinks = normalizePortfolioLinks({
    ...(basic || {}),
    linkedin,
    github,
    portfolio,
    website,
    behance,
    dribbble,
  });
  const normalizedCvUploaded = Boolean(cvUploaded || cvFields.cvUploaded || cvFields.cvFileName);
  const normalizedAnalysisSources = Array.isArray(analysisSources) && analysisSources.length
    ? [...new Set(analysisSources)]
    : buildAnalysisSources({
        dnaAnswers,
        goals: normalizedGoals,
        experienceSignals: normalizedExperienceSignals,
        leadershipSignals: normalizedLeadershipSignals,
        cvUploaded: normalizedCvUploaded,
        links: portfolioLinks,
      });
  const dnaResult = buildDnaResult({
    answers: dnaAnswers,
    lang,
    primaryIndustry: normalizedGoals?.industries?.[0] || normalizedGoals?.primaryIndustry || "",
  });
  const dna = {
    scores: dnaResult.traitScores,
    traitScores: dnaResult.traitScores,
    typeId: dnaResult.typeId,
    typeLabel: dnaResult.typeLabel,
    answers: dnaAnswers || {},
  };
  const summary = generateProfileSummary({
    basic: {
      ...basic,
      ...portfolioLinks,
      experienceSignals: normalizedExperienceSignals,
      leadershipSignals: normalizedLeadershipSignals,
    },
    goals: normalizedGoals,
    dna,
    lang,
  });
  const cvExists = Boolean(cvFields.cvFileName || cvFields.cvExists);
  const intelligence = buildCareerIntelligence(
    {
      basic_profile: {
        ...basic,
        ...cvFields,
        ...portfolioLinks,
        experienceSignals: normalizedExperienceSignals,
        leadershipSignals: normalizedLeadershipSignals,
        cvUploaded: normalizedCvUploaded,
        cvSignalCount: Number(cvSignalCount || cvFields.cvSignalCount || 0),
        analysisSources: normalizedAnalysisSources,
      },
      career_goals: normalizedGoals,
      career_dna: dna,
      ...summary,
    },
    { hasCv: cvExists, readinessAnswers, lang }
  );
  const educationLocation = basic?.educationLocation || basic?.education_location || {
    country: basic?.universityCountryCode || basic?.universityCountry || "",
    countryCode: basic?.universityCountryCode || basic?.universityCountry || "",
    city: basic?.universityCity || basic?.educationCity || "",
    cities: basic?.universityCities || basic?.educationCities || [],
    educationCities: basic?.educationCities || basic?.universityCities || [],
    university: basic?.university || "",
    universitySource: basic?.universitySource || basic?.university_source || "",
    department: basic?.department || basic?.degree || "",
    graduationYear: basic?.graduationYear || basic?.expectedGraduationYear || "",
    expectedGraduationYear: basic?.expectedGraduationYear || "",
    educationStatus: basic?.educationStatus || "",
  };
  const profileCore = {
    ...(existing || {}),
    onboarding_completed: true,
    _localOnly: true,
    career_identity: summary.career_identity || name || (tr ? "Kariyer profili" : "Career profile"),
    basic_profile: {
      ...basic,
      ...portfolioLinks,
      experienceSignals: normalizedExperienceSignals,
      leadershipSignals: normalizedLeadershipSignals,
      cvStatus: cvFields.cvStatus || "none",
      cvFileName: cvFields.cvFileName || null,
      cvFileUrl: cvFields.cvFileUrl || null,
      cvLastUpdatedRange: cvFields.cvLastUpdatedRange || cvFields.cvLastUpdated || null,
      cvUploaded: normalizedCvUploaded,
      cvSignalCount: Number(cvSignalCount || cvFields.cvSignalCount || 0),
      analysisSources: normalizedAnalysisSources,
    },
    career_goals: normalizedGoals,
    career_dna: dna,
    career_readiness: intelligence.career_readiness,
    career_gps: {
      ...(intelligence.career_gps || {}),
      inputs: {
        ...(intelligence.career_gps?.inputs || {}),
        educationLocation,
        localCareerIntelligence: basic?.localCareerIntelligence || {
          education: educationLocation,
        },
      },
    },
    best_fit_roles: summary.best_fit_roles || [],
    primary_industry: normalizedGoals?.industries?.[0] || "",
    updated_at: new Date().toISOString(),
    created_at: existing?.created_at || new Date().toISOString(),
  };
  const careerSnapshot = buildCareerSnapshot(profileCore, lang);
  careerSnapshot.analysisSources = normalizedAnalysisSources;
  return {
    ...profileCore,
    career_snapshot: careerSnapshot,
    analysis_sources: normalizedAnalysisSources,
    career_gps: {
      ...(profileCore.career_gps || {}),
      snapshot: careerSnapshot,
      weighted_fit_foundation: careerSnapshot.weightedFitFoundation,
    },
  };
}

export async function resolvePostLoginPath(apiBase, getHeaders) {
  try {
    const data = await fetchCareerOnboarding(apiBase, getHeaders, "TR");
    if (data.exists === false) return "/onboarding";
    if (data.profile || data.onboarding_completed) return "/dashboard";
    if (data.offline || data.exists == null) return "/dashboard";
    return "/onboarding";
  } catch {
    return "/dashboard";
  }
}

