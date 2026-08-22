/**
 * Career DNA language profile — canonical storage + UI helpers.
 */

import { getLanguageLevelLabel } from "./onboardingOptions.js";

export const COMMON_LANGUAGES = [
  { id: "turkish", labelTr: "Türkçe", labelEn: "Turkish" },
  { id: "english", labelTr: "İngilizce", labelEn: "English" },
  { id: "german", labelTr: "Almanca", labelEn: "German" },
  { id: "french", labelTr: "Fransızca", labelEn: "French" },
  { id: "spanish", labelTr: "İspanyolca", labelEn: "Spanish" },
  { id: "italian", labelTr: "İtalyanca", labelEn: "Italian" },
  { id: "arabic", labelTr: "Arapça", labelEn: "Arabic" },
  { id: "russian", labelTr: "Rusça", labelEn: "Russian" },
  { id: "chinese", labelTr: "Çince", labelEn: "Chinese" },
  { id: "japanese", labelTr: "Japonca", labelEn: "Japanese" },
  { id: "korean", labelTr: "Korece", labelEn: "Korean" },
  { id: "portuguese", labelTr: "Portekizce", labelEn: "Portuguese" },
  { id: "dutch", labelTr: "Felemenkçe", labelEn: "Dutch" },
  { id: "polish", labelTr: "Lehçe", labelEn: "Polish" },
  { id: "greek", labelTr: "Yunanca", labelEn: "Greek" },
  { id: "hindi", labelTr: "Hintçe", labelEn: "Hindi" },
  { id: "persian", labelTr: "Farsça", labelEn: "Persian" },
  { id: "ukrainian", labelTr: "Ukraynaca", labelEn: "Ukrainian" },
  { id: "azerbaijani", labelTr: "Azerbaycanca", labelEn: "Azerbaijani" },
];

export const ENGLISH_LEVEL_OPTIONS = [
  { value: "none", labelTr: "Bilmiyorum", labelEn: "Don't know" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
  { value: "native", labelTr: "Ana Dil", labelEn: "Native" },
];

export const ADDITIONAL_LEVEL_OPTIONS = ENGLISH_LEVEL_OPTIONS.filter((o) => o.value !== "none");

function isTr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getEnglishLevelLabel(value, lang = "TR") {
  const row = ENGLISH_LEVEL_OPTIONS.find((o) => o.value === value);
  if (!row) return getLanguageLevelLabel(value, lang);
  if (row.label) return row.label;
  return isTr(lang) ? row.labelTr : row.labelEn;
}

export function getDefaultNativeLanguage(lang = "TR") {
  return isTr(lang) ? "Türkçe" : "Turkish";
}

export function getDefaultEnglishName(lang = "TR") {
  return isTr(lang) ? "İngilizce" : "English";
}

export function normalizeLevelCode(level) {
  const l = String(level || "").trim();
  if (!l) return "";
  const lower = l.toLowerCase();
  if (lower === "ana dil" || lower === "native") return "native";
  if (lower === "bilmiyorum" || lower === "don't know" || lower === "dont know") return "none";
  return l;
}

export function isEnglishLanguageName(name) {
  const n = norm(name);
  return n === "english" || n === "ingilizce";
}

export function languageNamesEqual(a, b) {
  return norm(a) === norm(b);
}

export function filterCommonLanguages(query, lang = "TR") {
  const q = norm(query);
  return COMMON_LANGUAGES.filter((row) => {
    const label = isTr(lang) ? row.labelTr : row.labelEn;
    if (!q) return true;
    return norm(label).includes(q) || norm(row.labelTr).includes(q) || norm(row.labelEn).includes(q);
  }).map((row) => (isTr(lang) ? row.labelTr : row.labelEn));
}

/** @typedef {{ nativeLanguage: string, englishLevel: string, additional: { name: string, level: string }[] }} LanguageUiState */

/**
 * @param {LanguageUiState} state
 * @param {string} uiLang
 * @returns {object[]}
 */
export function buildLanguagesProfile(state, uiLang = "TR") {
  const rows = [];
  const nativeLanguage = String(state?.nativeLanguage || "").trim();
  const englishLevel = normalizeLevelCode(state?.englishLevel);
  const englishName = getDefaultEnglishName(uiLang);

  if (nativeLanguage) {
    rows.push({
      name: nativeLanguage,
      language: nativeLanguage,
      level: "native",
      levelLabel: getLanguageLevelLabel("native", uiLang),
      type: "native",
    });
  }

  if (englishLevel && englishLevel !== "none") {
    rows.push({
      name: englishName,
      language: englishName,
      level: englishLevel,
      levelLabel: getLanguageLevelLabel(englishLevel, uiLang),
      type: "english",
    });
  }

  for (const row of state?.additional || []) {
    const name = String(row?.name || "").trim();
    const level = normalizeLevelCode(row?.level);
    if (!name || !level || level === "none") continue;
    rows.push({
      name,
      language: name,
      level,
      levelLabel: getLanguageLevelLabel(level, uiLang),
      type: "additional",
    });
  }

  return rows;
}

export function getDefaultLanguagesProfile(lang = "TR") {
  return buildLanguagesProfile(
    {
      nativeLanguage: getDefaultNativeLanguage(lang),
      englishLevel: "",
      additional: [],
    },
    lang
  );
}

/**
 * @param {object[]} languages
 * @param {string} uiLang
 * @returns {LanguageUiState}
 */
export function parseLanguagesProfile(languages = [], uiLang = "TR") {
  const defaultNative = getDefaultNativeLanguage(uiLang);
  const rows = (languages || []).map((row) => ({
    name: String(row?.name || row?.language || "").trim(),
    level: normalizeLevelCode(row?.level),
    type: row?.type || "",
    language: String(row?.language || row?.name || "").trim(),
  }));

  let nativeLanguage = defaultNative;
  let englishLevel = "";
  const additional = [];

  const nativeRow =
    rows.find((r) => r.type === "native") ||
    rows.find((r) => r.level === "native" && !isEnglishLanguageName(r.name));
  if (nativeRow?.name) nativeLanguage = nativeRow.name;

  const englishRow =
    rows.find((r) => r.type === "english") ||
    rows.find((r) => isEnglishLanguageName(r.name) && r !== nativeRow);
  if (englishRow?.level) englishLevel = englishRow.level;

  for (const row of rows) {
    if (row.type === "additional") {
      additional.push({ name: row.name, level: row.level });
      continue;
    }
    if (row === nativeRow || row === englishRow) continue;
    if (row.level === "native" && !isEnglishLanguageName(row.name)) continue;
    if (isEnglishLanguageName(row.name)) continue;
    if (row.name && row.level) additional.push({ name: row.name, level: row.level });
  }

  return { nativeLanguage, englishLevel, additional };
}

/**
 * @param {LanguageUiState} state
 * @param {string} uiLang
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateLanguageUiState(state, uiLang = "TR") {
  const tr = isTr(uiLang);
  const nativeLanguage = String(state?.nativeLanguage || "").trim();
  if (!nativeLanguage) {
    return { ok: false, error: tr ? "Ana dil seç." : "Select your native language." };
  }

  const seen = new Set([norm(nativeLanguage)]);
  const englishName = getDefaultEnglishName(uiLang);
  seen.add(norm(englishName));

  for (const row of state?.additional || []) {
    const name = String(row?.name || "").trim();
    const level = normalizeLevelCode(row?.level);
    if (!name && !level) continue;
    if (!name || !level) {
      return {
        ok: false,
        error: tr ? "Ek dil için hem dil hem seviye seç." : "Select both language and level for additional languages.",
      };
    }
    const key = norm(name);
    if (seen.has(key)) {
      return {
        ok: false,
        error: tr ? "Aynı dil iki kez eklenemez." : "The same language cannot be added twice.",
      };
    }
    if (languageNamesEqual(name, nativeLanguage)) {
      return {
        ok: false,
        error: tr ? "Ana dil ek dil olarak eklenemez." : "Native language cannot be added as an additional language.",
      };
    }
    seen.add(key);
  }

  return { ok: true };
}

export function validateLanguagesArray(languages, uiLang = "TR") {
  return validateLanguageUiState(parseLanguagesProfile(languages, uiLang), uiLang);
}

export function normalizeLanguagesArray(languages, uiLang = "TR") {
  const parsed = parseLanguagesProfile(languages, uiLang);
  return buildLanguagesProfile(parsed, uiLang);
}
