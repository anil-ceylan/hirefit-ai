import {
  EXPERIENCE_SIGNAL_OPTIONS,
  LEADERSHIP_SIGNAL_OPTIONS,
  normalizeSignalSelection,
} from "./careerSignalSchema.js";

const OBJECT_DRAFT_KEYS = ["basic", "goals", "readinessAnswers", "dnaAnswers", "cv", "mbtiAnswers", "ui"];
const NON_EMPTY_ARRAY_KEYS = new Set([
  "experienceSignals",
  "leadershipSignals",
  "targetRoles",
  "experienceLevels",
  "industries",
  "lookingFor",
  "targetCountries",
  "targetCities",
  "universityCities",
  "educationCities",
  "languages",
]);

const PRESERVE_EMPTY_STRING_KEYS = new Set([
  "fullName",
  "firstName",
  "lastName",
  "age",
  "ageRange",
  "country",
  "countryCode",
  "city",
  "residenceCountry",
  "residenceCountryCode",
  "residenceCity",
  "university",
  "degree",
  "department",
  "educationLevel",
  "educationStatus",
  "educationLanguage",
  "classYear",
  "graduationYear",
  "expectedGraduationYear",
  "gpa",
  "universityCountryCode",
  "universityCountry",
  "universityCity",
  "livingSituation",
  "linkedin",
  "github",
  "portfolio",
  "website",
  "behance",
  "dribbble",
  "primaryIndustry",
  "primaryRole",
  "secondaryRole",
  "tertiaryRole",
  "experienceLevel",
  "seniority",
  "internationalInterest",
]);

export function hasUsableArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalizeClearFields(clearFields) {
  if (Array.isArray(clearFields)) return new Set(clearFields.filter(Boolean).map(String));
  return new Set();
}

function mergeObjectPreservingSelections(previous = {}, incoming = {}, { clearFields = [] } = {}) {
  const merged = { ...(previous || {}) };
  const explicitlyCleared = normalizeClearFields(clearFields);
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (explicitlyCleared.has(key)) {
      merged[key] = value;
      return;
    }
    if (NON_EMPTY_ARRAY_KEYS.has(key) && Array.isArray(value) && value.length === 0 && hasUsableArray(previous?.[key])) {
      return;
    }
    if (PRESERVE_EMPTY_STRING_KEYS.has(key) && value === "" && previous?.[key]) {
      return;
    }
    merged[key] = value;
  });
  return merged;
}

export function mergeProfileSectionPreservingExisting(previous = {}, incoming = {}, options = {}) {
  return mergeObjectPreservingSelections(previous || {}, incoming || {}, options);
}

function clearFieldsForSection(clearFields = {}, section) {
  if (Array.isArray(clearFields)) return clearFields;
  return clearFields?.[section] || [];
}

export function mergeOnboardingDraft(previous = {}, incoming = {}, { step, clearFields = {} } = {}) {
  const merged = { ...(previous || {}), ...(incoming || {}) };
  OBJECT_DRAFT_KEYS.forEach((key) => {
    if (previous?.[key] || incoming?.[key]) {
      merged[key] = mergeObjectPreservingSelections(previous?.[key], incoming?.[key], {
        clearFields: clearFieldsForSection(clearFields, key),
      });
    }
  });
  return {
    ...merged,
    lastStep: step ?? incoming?.lastStep ?? previous?.lastStep ?? 1,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveSignalSelectionForPersistence({
  incoming,
  basicValue,
  existing,
  options,
  benchmark,
}) {
  const direct = normalizeSignalSelection(incoming, options, benchmark);
  if (direct.length) return direct;

  const fromBasic = normalizeSignalSelection(basicValue, options, benchmark);
  if (fromBasic.length) return fromBasic;

  const fromExisting = normalizeSignalSelection(existing, options, "");
  if (fromExisting.length) return fromExisting;

  return normalizeSignalSelection([], options, benchmark);
}

export function resolveExperienceSignalsForPersistence(args = {}) {
  return resolveSignalSelectionForPersistence({ ...args, options: EXPERIENCE_SIGNAL_OPTIONS });
}

export function resolveLeadershipSignalsForPersistence(args = {}) {
  return resolveSignalSelectionForPersistence({ ...args, options: LEADERSHIP_SIGNAL_OPTIONS });
}
