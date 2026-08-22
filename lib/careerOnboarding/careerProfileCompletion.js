/**
 * Config-driven Career Profile Completion — reusable on onboarding + dashboard.
 * Weights are tunable; completion is computed from real profile data only.
 */

import { normalizeLookingFor } from "./industries.js";
import {
  EXPERIENCE_SIGNAL_OPTIONS,
  LEADERSHIP_SIGNAL_OPTIONS,
  normalizePortfolioLinks,
  normalizeSignalSelection,
} from "./careerSignalSchema.js";
import { normalizeReadinessAnswers } from "./readinessBenchmarks.js";

/** @typedef {{ id: string, weight: number, labelTr: string, labelEn: string, checkKey: string, listGroup: "core"|"evidence"|"future" }} CompletionItemConfig */

/** @type {CompletionItemConfig[]} */
export const CAREER_PROFILE_COMPLETION_CONFIG = [
  { id: "career_dna", weight: 12, labelTr: "Career DNA", labelEn: "Career DNA", checkKey: "careerDna", listGroup: "core" },
  { id: "education", weight: 12, labelTr: "Eğitim", labelEn: "Education", checkKey: "education", listGroup: "core" },
  { id: "experience", weight: 10, labelTr: "Deneyim", labelEn: "Experience", checkKey: "experience", listGroup: "core" },
  { id: "career_goals", weight: 12, labelTr: "Kariyer Hedefleri", labelEn: "Career Goals", checkKey: "careerGoals", listGroup: "core" },
  { id: "leadership", weight: 8, labelTr: "Liderlik", labelEn: "Leadership", checkKey: "leadership", listGroup: "core" },
  { id: "english", weight: 6, labelTr: "İngilizce", labelEn: "English", checkKey: "english", listGroup: "core" },
  { id: "network", weight: 6, labelTr: "Profesyonel Ağ", labelEn: "Network", checkKey: "network", listGroup: "core" },
  { id: "cv", weight: 14, labelTr: "CV", labelEn: "CV", checkKey: "cv", listGroup: "evidence" },
  { id: "linkedin", weight: 8, labelTr: "LinkedIn", labelEn: "LinkedIn", checkKey: "linkedin", listGroup: "evidence" },
  { id: "github", weight: 6, labelTr: "GitHub", labelEn: "GitHub", checkKey: "github", listGroup: "evidence" },
  { id: "portfolio", weight: 6, labelTr: "Portföy", labelEn: "Portfolio", checkKey: "portfolio", listGroup: "evidence" },
  { id: "case_study", weight: 5, labelTr: "Vaka Çalışması", labelEn: "Case Study", checkKey: "caseStudy", listGroup: "evidence" },
  { id: "certifications", weight: 5, labelTr: "Sertifikalar", labelEn: "Certifications", checkKey: "certifications", listGroup: "evidence" },
  { id: "english_proof", weight: 5, labelTr: "İngilizce Kanıtı", labelEn: "English Proof", checkKey: "englishProof", listGroup: "evidence" },
  { id: "recruiter_analysis", weight: 0, labelTr: "Recruiter Analizi", labelEn: "Recruiter Analysis", checkKey: "recruiterAnalysis", listGroup: "future" },
  { id: "ats_analysis", weight: 0, labelTr: "ATS Analizi", labelEn: "ATS Analysis", checkKey: "atsAnalysis", listGroup: "future" },
];

function normalizeUniversityCities(basic = {}) {
  const raw = basic.universityCities || basic.educationCities;
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((city) => String(city || "").trim()).filter(Boolean))];
  }
  const single = String(basic.universityCity || basic.educationCity || "").trim();
  return single ? [single] : [];
}

function isDnaComplete(dnaAnswers = {}) {
  const count = Object.keys(dnaAnswers).filter((key) => {
    const value = Number(dnaAnswers[key]);
    return Number.isFinite(value) && value >= 1 && value <= 5;
  }).length;
  return count >= 10;
}

function hasEnglishLanguageProof(basic = {}) {
  const languages = Array.isArray(basic.languages) ? basic.languages : [];
  const english = languages.find((row) => /english|ingilizce/i.test(String(row?.language || row?.id || "")));
  if (!english?.level) return false;
  const level = String(english.level || english.proficiency || "").toUpperCase();
  return ["B2", "C1", "C2", "NATIVE"].includes(level) || level === "native";
}

/**
 * Build completion check map from profile-shaped input.
 */
export function buildCareerProfileCompletionContext(input = {}) {
  const basic = input.basic || input.basic_profile || {};
  const goals = input.goals || input.career_goals || {};
  const dnaAnswers = input.dnaAnswers || input.career_dna?.answers || {};
  const readinessAnswers =
    input.readinessAnswers ||
    input.career_readiness?.benchmarks ||
    input.career_readiness?.readinessAnswers ||
    input.career_readiness ||
    {};
  const cv = input.cv || {};
  const firstAnalysis = input.firstAnalysis || input.first_analysis || {};
  const links = normalizePortfolioLinks(basic);
  const { benchmarks } = normalizeReadinessAnswers(readinessAnswers);
  const experienceSignals = normalizeSignalSelection(basic.experienceSignals, EXPERIENCE_SIGNAL_OPTIONS);
  const leadershipSignals = normalizeSignalSelection(basic.leadershipSignals, LEADERSHIP_SIGNAL_OPTIONS);
  const universityCities = normalizeUniversityCities(basic);
  const certifications = Array.isArray(basic.certifications)
    ? basic.certifications.filter(Boolean)
    : basic.certificationLink
      ? [basic.certificationLink]
      : [];

  const hasExperience =
    (experienceSignals.length > 0 && !experienceSignals.includes("none")) ||
    (benchmarks.experience && benchmarks.experience !== "none");
  const hasLeadership =
    (leadershipSignals.length > 0 && !leadershipSignals.includes("none")) ||
    (benchmarks.leadership && benchmarks.leadership !== "none");

  return {
    careerDna: isDnaComplete(dnaAnswers),
    education: Boolean(
      basic.university?.trim() &&
        (basic.degree || basic.department)?.trim() &&
        basic.educationStatus &&
        universityCities.length
    ),
    experience: hasExperience,
    careerGoals: Boolean(
      goals.primaryRole &&
        (goals.industries?.length || goals.primaryIndustry) &&
        normalizeLookingFor(goals.lookingFor).length
    ),
    leadership: hasLeadership,
    english: Boolean(benchmarks.english && benchmarks.english !== "basic" && benchmarks.english !== "none"),
    network: Boolean(benchmarks.network && benchmarks.network !== "no_professional_network"),
    cv: Boolean(
      cv.cvExists ||
        cv.cvUploaded ||
        basic.cvUploaded ||
        basic.cvFileName ||
        (basic.cvStatus && basic.cvStatus !== "none")
    ),
    linkedin: Boolean(links.linkedin),
    github: Boolean(links.github),
    portfolio: Boolean(links.portfolio || links.website),
    caseStudy: Boolean(basic.caseStudyUrl || basic.caseStudyLink),
    certifications: certifications.length > 0,
    englishProof: Boolean(
      basic.englishProofUrl ||
        basic.englishTestScore ||
        basic.englishCertificateUrl ||
        hasEnglishLanguageProof(basic)
    ),
    recruiterAnalysis: Boolean(
      (basic.cvSignalCount > 0 || firstAnalysis.cvSignalCount > 0) &&
        (firstAnalysis.recruiterView ||
          input.careerSnapshot?.recruiterView ||
          input.career_snapshot?.recruiterView)
    ),
    atsAnalysis: Boolean(
      firstAnalysis.atsScore != null ||
        firstAnalysis.compatibilityScore != null ||
        firstAnalysis.teaser?.atsScore != null
    ),
  };
}

/**
 * @param {object} input — profile or { basic, goals, dnaAnswers, readinessAnswers, cv, ... }
 * @param {string} lang
 */
export function buildCareerProfileCompletion(input = {}, lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  const checks = buildCareerProfileCompletionContext(input);

  const items = CAREER_PROFILE_COMPLETION_CONFIG.map((row) => {
    const complete = Boolean(checks[row.checkKey]);
    return {
      id: row.id,
      weight: row.weight,
      listGroup: row.listGroup,
      label: tr ? row.labelTr : row.labelEn,
      complete,
    };
  });

  const scored = items.filter((item) => item.weight > 0);
  const earned = scored.filter((item) => item.complete).reduce((sum, item) => sum + item.weight, 0);
  const total = scored.reduce((sum, item) => sum + item.weight, 0);
  const percent = total ? Math.round((earned / total) * 100) : 0;

  return {
    percent,
    earnedWeight: earned,
    totalWeight: total,
    completed: items.filter((item) => item.complete),
    incomplete: items.filter((item) => !item.complete && item.weight > 0),
    items,
  };
}

export function normalizeUniversityCitiesForProfile(basic = {}) {
  const cities = normalizeUniversityCities(basic);
  return {
    universityCities: cities,
    educationCities: cities,
    universityCity: cities[0] || "",
    educationCity: cities[0] || "",
  };
}
