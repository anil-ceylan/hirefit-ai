export { INDUSTRIES, ROLES_BY_INDUSTRY, FALLBACK_ROLES, getIndustryLabel, getRolesForIndustry, getRolesForIndustries, filterRolesForIndustry, filterRolesForIndustries, flattenAllRoles, getIndustryContext, getCompanyTypesForSelection, groupCompanyTypesForDisplay, normalizeLookingFor, includesLookingFor, primaryLookingFor, normalizeCareerGoals, buildCareerGpsInputs, getRoleLabel, normalizeRoleValue, normalizeRoleList, localizeRoles, getTopRolesForIndustries, getRemainingRolesForIndustries, getPrioritizedRoles } from "./industries.js";
export { COMPANY_TYPE_RULES } from "./companyTypeMap.js";
export {
  normalizeExperienceLevel,
  normalizeExperienceLevels,
  primaryExperienceLevel,
  normalizeCompanySizes,
  getExperienceLabel,
  getCompanySizeLabel,
  EXPERIENCE_LEVEL_ALIASES,
} from "./onboardingOptions.js";
export { ROLES } from "./roleCatalog.js";
export {
  ROLE_DISPLAY,
  getRoleDisplay,
  formatRoleTitle,
  formatRoleSecondary,
  resolveRoleDisplayId,
} from "./roleDisplay.js";
export {
  READINESS_PILLAR_KEYS,
  READINESS_BENCHMARKS,
  normalizeReadinessAnswers,
  isReadinessComplete,
  emptyReadinessAnswers,
  getReadinessPillarLabel,
  getReadinessOptionLabel,
} from "./readinessBenchmarks.js";
export {
  CV_STATUS,
  CV_STATUS_OPTIONS,
  CV_FRESHNESS_OPTIONS,
  needsCvUpload,
  normalizeCvProfile,
  emptyCvProfile,
} from "./cvOptions.js";
export {
  LOOKING_FOR_OPTIONS,
  EXPERIENCE_LEVELS,
  COMPANY_SIZE_OPTIONS,
  LIVING_SITUATION_OPTIONS,
  WORK_MODE_OPTIONS,
  INTERNATIONAL_INTENT_OPTIONS,
  INTERNATIONAL_COUNTRY_GROUPS,
  LANGUAGE_PROFICIENCY_OPTIONS,
  EDUCATION_STATUS_OPTIONS,
  COMPANY_STAGE_OPTIONS,
  COMPANY_INDUSTRY_OPTIONS,
  getLanguageLevelLabel,
} from "./onboardingOptions.js";
export { getMbtiQuestions, resolveMbtiType, MBTI_QUESTIONS } from "./mbti.js";
export { TRAIT_DIMENSIONS, ARCHETYPE_TYPES } from "./traitConstants.js";
export {
  MAX_TARGET_ROLES,
  EXPERIENCE_SIGNAL_OPTIONS,
  LEADERSHIP_SIGNAL_OPTIONS,
  normalizeSignalSelection,
  toggleSignalSelection,
  strongestSignalBenchmark,
  normalizePortfolioLinks,
  buildAnalysisSources,
  getAnalysisSourceLabel,
  classifyAnalysisSources,
  estimateCvSignalCount,
} from "./careerSignalSchema.js";
export {
  buildCareerProfileCompletion,
  buildCareerProfileCompletionContext,
  normalizeUniversityCitiesForProfile,
  CAREER_PROFILE_COMPLETION_CONFIG,
} from "./careerProfileCompletion.js";

/** @deprecated use industry → role flow */
export const TARGET_ROLES = [];

export const EDUCATION_LEVELS = [
  { id: "university_student", labelEn: "University Student", labelTr: "Üniversite Öğrencisi" },
  { id: "new_graduate", labelEn: "New Graduate", labelTr: "Yeni Mezun" },
  { id: "working_professional", labelEn: "Working Professional", labelTr: "Çalışan Profesyonel" },
  { id: "career_switcher", labelEn: "Career Switcher", labelTr: "Kariyer Değiştiren" },
];

export const EDUCATION_LANGUAGES = [
  { id: "turkish", labelEn: "Turkish", labelTr: "Türkçe" },
  { id: "english", labelEn: "English", labelTr: "İngilizce" },
  { id: "mixed_30", labelEn: "30% English", labelTr: "%30 İngilizce" },
  { id: "full_english", labelEn: "100% English", labelTr: "%100 İngilizce" },
];

export const CLASS_YEARS = [
  { id: "english_prep", labelEn: "English Prep", labelTr: "Hazırlık" },
  { id: "1", labelEn: "1", labelTr: "1" },
  { id: "2", labelEn: "2", labelTr: "2" },
  { id: "3", labelEn: "3", labelTr: "3" },
  { id: "4", labelEn: "4", labelTr: "4" },
  { id: "5_plus", labelEn: "5+", labelTr: "5+" },
  { id: "graduate", labelEn: "Graduate", labelTr: "Mezun" },
];

export {
  getCareerDnaQuestions,
  scoreCareerDnaAnswers,
  resolveCareerArchetype,
  resolveCareerDnaType,
  traitLabels,
} from "./careerDna.js";
