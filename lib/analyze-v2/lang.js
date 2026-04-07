/**
 * UI may send "TR", "tr", "turkish"; normalize for engines.
 * @param {unknown} lang
 * @returns {"en" | "tr"}
 */
export function normalizeAnalyzeLang(lang) {
  const s = String(lang ?? "")
    .trim()
    .toLowerCase();
  if (s === "tr" || s === "tur" || s === "turkish") return "tr";
  return "en";
}

/** Appended to system prompts when lang is Turkish. */
export const TR_JSON_OUTPUT_RULE =
  "Respond in Turkish (tr). All output must be in Turkish. Every natural-language string value in your JSON (reasoning, issues, explanations, keywords, strengths, weaknesses, red_flags, biggest_gap, what_to_fix_first, role labels if natural language, etc.) must be written in Turkish. Keep JSON keys exactly as specified in English.";

/**
 * @param {string} baseSystem
 * @param {"en" | "tr"} langNorm
 */
export function systemPromptWithLang(baseSystem, langNorm) {
  if (langNorm !== "tr") return baseSystem;
  return `${baseSystem}\n\n${TR_JSON_OUTPUT_RULE}`;
}

export function fallbackNoReasoning(langNorm) {
  return langNorm === "tr" ? "Gerekçe dönmedi." : "No reasoning returned.";
}

export function fallbackBiggestGap(langNorm) {
  return langNorm === "tr"
    ? "Tek bir boşluk izole edilemedi."
    : "Unable to isolate a single gap.";
}

/** Appended to user prompts as a second reminder for models that skim system text. */
export function userPromptLangFooter(langNorm) {
  if (langNorm !== "tr") return "";
  return "\n\nIMPORTANT: All natural-language strings in your JSON response must be Turkish.";
}
