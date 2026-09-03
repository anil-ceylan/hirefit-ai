import { createClient } from "@supabase/supabase-js";
import { profileRowToMemory } from "../careerMemory/index.js";

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
import { generateProfileSummary } from "./generateSummary.js";
import { buildDnaResult } from "./dnaResult.js";
import { buildCareerIntelligence } from "../careerIntelligence/buildIntelligence.js";
import { buildIdentityEngineV3 } from "../careerIntelligence/identityEngineV3.js";
import { buildCareerSnapshot, detectRoleFamiliesFromProfile } from "./careerSnapshot.js";
import { createInMemoryShadowLogStore, observeDecisionRun } from "../careerIntelligence/observatory/index.js";
import { normalizeCvProfile, cvExistsFromLegacy } from "./cvOptions.js";
import { normalizeCareerGoals, buildCareerGpsInputs } from "./industries.js";
import {
  normalizePortfolioLinks,
  buildAnalysisSources,
} from "./careerSignalSchema.js";
import {
  mergeOnboardingDraft,
  mergeProfileSectionPreservingExisting,
  resolveExperienceSignalsForPersistence,
  resolveLeadershipSignalsForPersistence,
} from "./stateIntegrity.js";
import {
  buildProfileChangeEvents,
  mergeProfileProgressIntoCareerGps,
} from "./profileProgress.js";

const careerProfileShadowLogStore = createInMemoryShadowLogStore();

function observeCareerProfileDecision({ row, careerSnapshot }) {
  try {
    const result = observeDecisionRun({
      profile: row,
      productionSnapshot: careerSnapshot,
      logStore: careerProfileShadowLogStore,
    });
    if (result?.warnings?.length && process.env.NODE_ENV !== "production") {
      console.error("[decision-observatory:shadow]", result.warnings.map((item) => item.code || item).join(", "));
    }
  } catch (error) {
    console.error("[decision-observatory:failed-closed]", error?.message || error);
  }
}

function clearFieldsForSection(clearFields = {}, section) {
  if (Array.isArray(clearFields)) return clearFields;
  return clearFields?.[section] || [];
}

export function rowToFullProfile(row) {
  if (!row) return null;
  const memory = profileRowToMemory(row) || {};
  const basicProfile = row.basic_profile || {};
  return {
    ...memory,
    user_id: row.user_id || null,
    onboarding_completed: Boolean(row.onboarding_completed),
    onboarding_draft: row.onboarding_draft || {},
    basic_profile: basicProfile,
    cvExists: Boolean(basicProfile.cvExists),
    cvStatus: basicProfile.cvStatus || "",
    cvFileUrl: basicProfile.cvFileUrl || "",
    cvLastUpdated: basicProfile.cvLastUpdated || basicProfile.cvLastUpdatedRange || "",
    cvLastUpdatedRange: basicProfile.cvLastUpdatedRange || basicProfile.cvLastUpdated || "",
    updated_at: row.updated_at || "",
    created_at: row.created_at || "",
    cvFileName: basicProfile.cvFileName || "",
    cvUploaded: Boolean(basicProfile.cvUploaded || basicProfile.cvFileName),
    cvSignalCount: Number(basicProfile.cvSignalCount || 0),
    analysis_sources: basicProfile.analysisSources || (row.career_gps || {}).snapshot?.analysisSources || [],
    career_goals: row.career_goals || {},
    career_dna: row.career_dna || {},
    best_fit_roles: row.best_fit_roles || row.target_roles || [],
    recommended_next_move: row.recommended_next_move || "",
    growth_plan_30d: row.growth_plan_30d || "",
    career_gps: row.career_gps || {},
    university_intelligence: row.university_intelligence || {},
    city_intelligence: row.city_intelligence || {},
    career_readiness: row.career_readiness || {},
    career_snapshot: (row.career_gps || {}).snapshot || {},
    first_analysis: (row.career_gps || {}).first_analysis || {},
    primary_industry: row.primary_industry || "",
    target_countries: row.target_countries || [],
  };
}

export async function loadFullCareerProfile(userId) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.from("career_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[career-profile:load]", error?.message || error);
    return null;
  }
  return data ? rowToFullProfile(data) : null;
}

export async function upsertOnboardingDraft(userId, { step, draft, lang: _lang, clearFields = {} }) {
  const supabase = getServiceClient();
  if (!supabase || !userId) {
    return { profile: null, storageUnavailable: true };
  }
  const existing = await loadFullCareerProfile(userId);
  const mergedDraft = mergeOnboardingDraft(existing?.onboarding_draft || {}, draft || {}, { step, clearFields });
  const row = {
    user_id: userId,
    onboarding_draft: mergedDraft,
    updated_at: new Date().toISOString(),
  };
  if (!existing) {
    row.onboarding_completed = false;
    row.career_identity = "";
    row.career_level = "";
  }
  const { data, error } = await supabase.from("career_profiles").upsert(row, { onConflict: "user_id" }).select().single();
  if (error) {
    console.error("[career-onboarding:draft-upsert]", error?.message || error);
    return { profile: null, storageUnavailable: true };
  }
  return { profile: rowToFullProfile(data), storageUnavailable: false };
}

export async function completeOnboarding(userId, {
  basic,
  goals,
  dnaAnswers,
  readinessAnswers,
  cv,
  hasCv,
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
  clearFields = {},
  lang = "TR",
}) {
  const supabase = getServiceClient();
  if (!supabase || !userId) {
    return { profile: null, mode: "local", storageUnavailable: true };
  }
  const nowIso = new Date().toISOString();
  const existing = await loadFullCareerProfile(userId);
  const hadProfile = Boolean(
    existing?.onboarding_completed ||
      existing?.career_identity ||
      (existing?.basic_profile && Object.keys(existing.basic_profile).length > 2)
  );
  const mode = hadProfile ? "updated" : "created";

  const existingBasic = existing?.basic_profile || {};
  const safeIncomingBasic = mergeProfileSectionPreservingExisting(existingBasic, basic || {}, {
    clearFields: clearFieldsForSection(clearFields, "basic"),
  });
  const cvFields = normalizeCvProfile({
    ...existingBasic,
    ...(cv || {}),
    ...safeIncomingBasic,
    cvStatus: cv?.cvStatus || safeIncomingBasic?.cvStatus || existingBasic.cvStatus,
    cvUploaded: cvUploaded ?? cv?.cvUploaded ?? safeIncomingBasic?.cvUploaded ?? existingBasic.cvUploaded,
    cvSignalCount: Math.max(
      Number(existingBasic.cvSignalCount || 0),
      Number(cv?.cvSignalCount || 0),
      Number(safeIncomingBasic?.cvSignalCount || 0),
      Number(cvSignalCount || 0)
    ),
  });
  const normalizedExperienceSignals = resolveExperienceSignalsForPersistence({
    incoming: experienceSignals,
    basicValue: safeIncomingBasic?.experienceSignals,
    existing: existingBasic.experienceSignals,
    benchmark: readinessAnswers?.experience || existing?.career_readiness?.benchmarks?.experience,
  });
  const normalizedLeadershipSignals = resolveLeadershipSignalsForPersistence({
    incoming: leadershipSignals,
    basicValue: safeIncomingBasic?.leadershipSignals,
    existing: existingBasic.leadershipSignals,
    benchmark: readinessAnswers?.leadership || existing?.career_readiness?.benchmarks?.leadership,
  });
  const portfolioLinks = normalizePortfolioLinks({
    ...safeIncomingBasic,
    linkedin,
    github,
    portfolio,
    website,
    behance,
    dribbble,
  });
  const normalizedAnalysisSources = Array.isArray(analysisSources) && analysisSources.length
    ? [...new Set(analysisSources)]
    : buildAnalysisSources({
        dnaAnswers,
        goals,
        experienceSignals: normalizedExperienceSignals,
        leadershipSignals: normalizedLeadershipSignals,
        readinessAnswers,
        cvUploaded: cvFields.cvUploaded,
        links: portfolioLinks,
      });
  const basicWithCv = {
    ...safeIncomingBasic,
    ...cvFields,
    ...portfolioLinks,
    experienceSignals: normalizedExperienceSignals,
    leadershipSignals: normalizedLeadershipSignals,
    analysisSources: normalizedAnalysisSources,
  };
  const cvExists = cvFields.cvExists || cvExistsFromLegacy(hasCv, cvFields.cvStatus);
  const safeIncomingGoals = mergeProfileSectionPreservingExisting(existing?.career_goals || {}, goals || {}, {
    clearFields: clearFieldsForSection(clearFields, "goals"),
  });
  const normalizedGoals = normalizeCareerGoals(safeIncomingGoals || {});
  const careerGpsInputs = buildCareerGpsInputs(normalizedGoals);
  const educationLocation = basicWithCv.educationLocation || basicWithCv.education_location || {
    country: basicWithCv.universityCountryCode || basicWithCv.universityCountry || "",
    countryCode: basicWithCv.universityCountryCode || basicWithCv.universityCountry || "",
    city: basicWithCv.universityCity || basicWithCv.educationCity || "",
    cities: basicWithCv.universityCities || basicWithCv.educationCities || [],
    educationCities: basicWithCv.educationCities || basicWithCv.universityCities || [],
    university: basicWithCv.university || "",
    universitySource: basicWithCv.universitySource || basicWithCv.university_source || "",
    department: basicWithCv.department || basicWithCv.degree || "",
    graduationYear: basicWithCv.graduationYear || basicWithCv.expectedGraduationYear || "",
    expectedGraduationYear: basicWithCv.expectedGraduationYear || "",
    educationStatus: basicWithCv.educationStatus || "",
  };
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
    strengths: dnaResult.strengths,
    weaknesses: dnaResult.weaknesses,
    recommendedPaths: dnaResult.recommendedPaths,
    strengthTraits: dnaResult.strengthTraits,
    weaknessTraits: dnaResult.weaknessTraits,
    summary: dnaResult.summary,
    result: dnaResult,
    answers: dnaAnswers,
  };
  const summary = generateProfileSummary({ basic: basicWithCv, goals: normalizedGoals, dna, lang });
  const intelligence = buildCareerIntelligence(
    { basic_profile: basicWithCv, career_goals: normalizedGoals, career_dna: dna, ...summary },
    { hasCv: cvExists, readinessAnswers, lang }
  );
  const profileForSnapshot = {
    basic_profile: basicWithCv,
    career_goals: normalizedGoals,
    career_dna: dna,
    career_readiness: intelligence.career_readiness,
    best_fit_roles: summary.best_fit_roles,
    primary_industry: normalizedGoals?.industries?.[0] || normalizedGoals?.primaryIndustry || "",
    updated_at: nowIso,
  };
  const roleFamily = detectRoleFamiliesFromProfile(profileForSnapshot, normalizedGoals);
  const identityV3 = buildIdentityEngineV3({
    profile: profileForSnapshot,
    roleFamily,
    dnaAnswers,
    readinessAnswers,
    lang,
  });
  dna.identity_v3 = identityV3;
  dna.evidence = identityV3.evidence;
  dna.strengthProfile = identityV3.strengthProfile;
  dna.identityDebug = identityV3.debugReport;
  profileForSnapshot.career_dna = dna;
  const careerSnapshot = buildCareerSnapshot(profileForSnapshot, lang);
  careerSnapshot.analysisSources = normalizedAnalysisSources;
  const row = {
    user_id: userId,
    onboarding_completed: true,
    onboarding_draft: {},
    basic_profile: basicWithCv,
    career_goals: {
      ...normalizedGoals,
      ...careerGpsInputs,
      primaryRole: normalizedGoals.primaryRole || summary.primary_role || "",
      secondaryRole: normalizedGoals.secondaryRole || summary.secondary_role || "",
      tertiaryRole: normalizedGoals.tertiaryRole || summary.tertiary_role || "",
      careerArchetype: summary.career_archetype || "",
    },
    primary_industry: normalizedGoals?.industries?.[0] || normalizedGoals?.primaryIndustry || "",
    target_countries: normalizedGoals?.targetCountries || safeIncomingBasic?.targetCountries || [],
    career_dna: dna,
    career_identity: summary.career_identity,
    career_level: summary.career_level,
    target_roles: summary.target_roles,
    best_fit_roles: summary.best_fit_roles,
    industries: summary.industries,
    strong_signals: summary.strong_signals,
    weak_signals: summary.weak_signals,
    strengths: summary.strengths,
    weaknesses: summary.weaknesses,
    recommended_next_move: summary.recommended_next_move,
    growth_plan_30d: summary.growth_plan_30d,
    career_gps: {
      ...(existing?.career_gps || {}),
      ...(intelligence.career_gps || {}),
      inputs: {
        ...(existing?.career_gps?.inputs || {}),
        ...careerGpsInputs,
        educationLocation,
        localCareerIntelligence: basicWithCv.localCareerIntelligence || {
          education: educationLocation,
        },
      },
      snapshot: careerSnapshot,
      weighted_fit_foundation: careerSnapshot.weightedFitFoundation,
      identity_v3: identityV3,
      evidence: identityV3.evidence,
      decision_loop: existing?.career_gps?.decision_loop || intelligence.career_gps?.decision_loop || {},
    },
    university_intelligence: intelligence.university_intelligence,
    city_intelligence: intelligence.city_intelligence,
    career_readiness: intelligence.career_readiness,
    updated_at: nowIso,
  };
  if (existing?.created_at) row.created_at = existing.created_at;
  else row.created_at = nowIso;

  const profileChanges = buildProfileChangeEvents(existing, rowToFullProfile(row), {
    now: nowIso,
    source: mode === "created" ? "career_dna_complete" : "profile_edit",
  });
  row.career_gps = mergeProfileProgressIntoCareerGps(existing?.career_gps || {}, row.career_gps || {}, profileChanges, {
    userId,
    now: nowIso,
  });

  const { data, error } = await supabase.from("career_profiles").upsert(row, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  observeCareerProfileDecision({ row, careerSnapshot });
  return { profile: rowToFullProfile(data), mode, storageUnavailable: false };
}

export async function saveFirstAnalysis(userId, { snapshot, firstAnalysis, basicProfile, analysisSources }) {
  const supabase = getServiceClient();
  if (!supabase || !userId) {
    return { profile: null, storageUnavailable: true };
  }
  const existing = await loadFullCareerProfile(userId);
  if (!existing) return { profile: null, storageUnavailable: true };

  const career_gps = {
    ...(existing.career_gps || {}),
    snapshot: snapshot || existing.career_gps?.snapshot || {},
    first_analysis: firstAnalysis || {},
  };

  const { data, error } = await supabase
    .from("career_profiles")
    .update({
      career_gps,
      basic_profile: {
        ...(existing.basic_profile || {}),
        ...(basicProfile || {}),
        analysisSources:
          analysisSources ||
          basicProfile?.analysisSources ||
          existing.basic_profile?.analysisSources ||
          [],
      },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[career-onboarding:first-analysis]", error?.message || error);
    return { profile: null, storageUnavailable: true };
  }
  return { profile: rowToFullProfile(data), storageUnavailable: false };
}
