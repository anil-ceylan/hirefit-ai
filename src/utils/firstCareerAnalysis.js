import {
  buildCareerSnapshot,
  buildCvDnaMatch,
  buildSyntheticJobDescription,
  extractAnalysisTeaser,
} from "../../lib/careerOnboarding/careerSnapshot.js";
import { apiUrl } from "./apiBase.js";
import { estimateCvSignalCount } from "../../lib/careerOnboarding/careerSignalSchema.js";

const MIN_ANALYSIS_MS = 1800;

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Run optional first career analysis after onboarding.
 * CV text is optional — snapshot always returned.
 */
export async function runFirstCareerAnalysis({
  cvText,
  profile,
  lang = "TR",
  getApiAuthHeaders,
}) {
  const snapshot = buildCareerSnapshot(profile, lang);
  const trimmed = String(cvText || "").trim();

  if (!trimmed) {
    return {
      snapshot,
      cvMatch: null,
      teaser: null,
      cvSignalCount: 0,
    };
  }

  const jd = buildSyntheticJobDescription(profile, lang);
  const started = Date.now();
  let v2 = null;

  try {
    const res = await fetch(apiUrl("/api/analyze-v2"), {
      method: "POST",
      headers: await getApiAuthHeaders({ requireSession: false }),
      body: JSON.stringify({
        cvText: trimmed,
        jobDescription: jd,
        lang: lang === "TR" ? "tr" : "en",
        isPro: false,
        careerMemory: profile,
      }),
    });
    v2 = await parseJsonSafe(res);
  } catch {
    v2 = null;
  }

  const elapsed = Date.now() - started;
  if (elapsed < MIN_ANALYSIS_MS) {
    await new Promise((r) => window.setTimeout(r, MIN_ANALYSIS_MS - elapsed));
  }

  const teaser = v2 ? extractAnalysisTeaser(v2, profile, lang) : null;
  const cvMatch = buildCvDnaMatch(profile, trimmed, lang, v2);

  return { snapshot, cvMatch, teaser, cvSignalCount: estimateCvSignalCount(trimmed) };
}

export function mergeFirstAnalysisIntoProfile(profile, { snapshot, cvMatch, teaser, cvSignalCount = 0 }) {
  if (!profile) return profile;
  const firstAnalysis = {
    cvMatch,
    teaser,
    cvSignalCount,
    completedAt: new Date().toISOString(),
  };
  const analysisSources = [
    ...(profile.analysis_sources || profile.basic_profile?.analysisSources || snapshot?.analysisSources || []),
    ...(cvMatch ? ["cv"] : []),
  ].filter((source, index, all) => all.indexOf(source) === index);
  return {
    ...profile,
    analysis_sources: analysisSources,
    basic_profile: {
      ...(profile.basic_profile || {}),
      cvUploaded: Boolean(cvMatch || profile.basic_profile?.cvUploaded),
      cvSignalCount: Math.max(Number(profile.basic_profile?.cvSignalCount || 0), Number(cvSignalCount || 0)),
      analysisSources,
    },
    career_snapshot: { ...snapshot, analysisSources },
    career_gps: {
      ...(profile.career_gps || {}),
      snapshot: { ...snapshot, analysisSources },
      weighted_fit_foundation: snapshot?.weightedFitFoundation || profile.career_gps?.weighted_fit_foundation,
      first_analysis: firstAnalysis,
    },
    first_analysis: firstAnalysis,
    career_readiness: {
      ...(profile.career_readiness || {}),
      hasCv: Boolean(teaser || cvMatch),
    },
  };
}

export async function persistFirstAnalysisRemote(getApiAuthHeaders, mergedProfile) {
  try {
    const res = await fetch(apiUrl("/api/career-onboarding/first-analysis"), {
      method: "PATCH",
      headers: await getApiAuthHeaders({ requireSession: true }),
      body: JSON.stringify({
        snapshot: mergedProfile.career_snapshot,
        firstAnalysis: mergedProfile.first_analysis,
        basicProfile: mergedProfile.basic_profile,
        analysisSources: mergedProfile.analysis_sources,
      }),
    });
    const body = await res.json().catch(() => ({}));
    return body?.profile || null;
  } catch {
    return null;
  }
}

