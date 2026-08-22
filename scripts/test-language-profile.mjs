/**
 * Manual checks for language profile helpers.
 * Run: node scripts/test-language-profile.mjs
 */

import {
  buildLanguagesProfile,
  getDefaultLanguagesProfile,
  parseLanguagesProfile,
  validateLanguageUiState,
} from "../lib/careerOnboarding/languageProfile.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const defaults = getDefaultLanguagesProfile("TR");
assert(defaults[0]?.name === "Türkçe", "default native should be Türkçe");
assert(defaults[0]?.type === "native", "default type native");
assert(defaults.length === 1, "default should only include native");

const withEnglish = buildLanguagesProfile(
  { nativeLanguage: "Türkçe", englishLevel: "C1", additional: [] },
  "TR"
);
assert(withEnglish.length === 2, "native + english");
assert(withEnglish[1]?.level === "C1", "english C1");

const withExtra = buildLanguagesProfile(
  {
    nativeLanguage: "Türkçe",
    englishLevel: "C1",
    additional: [{ name: "Almanca", level: "B1" }],
  },
  "TR"
);
assert(withExtra.length === 3, "native + english + additional");
assert(withExtra[2]?.name === "Almanca", "additional name");

const dup = validateLanguageUiState(
  {
    nativeLanguage: "Türkçe",
    englishLevel: "",
    additional: [
      { name: "Almanca", level: "B1" },
      { name: "Almanca", level: "A2" },
    ],
  },
  "TR"
);
assert(!dup.ok, "duplicate language blocked");

const nativeDup = validateLanguageUiState(
  {
    nativeLanguage: "Türkçe",
    englishLevel: "",
    additional: [{ name: "Türkçe", level: "B2" }],
  },
  "TR"
);
assert(!nativeDup.ok, "native cannot be additional");

const legacy = parseLanguagesProfile(
  [
    { language: "Türkçe", level: "native" },
    { language: "İngilizce", level: "C1" },
  ],
  "TR"
);
assert(legacy.nativeLanguage === "Türkçe", "legacy native parse");
assert(legacy.englishLevel === "C1", "legacy english parse");

const roundTrip = parseLanguagesProfile(withExtra, "TR");
assert(roundTrip.additional[0]?.name === "Almanca", "round trip additional");

console.log("language-profile tests passed");
