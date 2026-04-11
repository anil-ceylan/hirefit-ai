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

/** UI Turkish: prepend to prompts so every model output is Turkish (incl. skill labels). */
export const MANDATORY_TURKISH_AI_OUTPUT = `Sen Türkçe konuşuyorsun.
Tüm çıktılar Türkçe olmalı.
Hiçbir cümle İngilizce olamaz.
Skill isimleri dahil her şey Türkçe.`;

/**
 * Single output language (UI language). Use in every Claude/Groq system + user prompt.
 * @param {"en" | "tr"} langNorm
 */
export function criticalOutputLanguageInstruction(langNorm) {
  if (langNorm === "tr") {
    return `CRITICAL: Respond ONLY in Turkish.
If language is Turkish: Her cümle Türkçe olmalı.
No mixing. No switching mid-sentence.`;
  }
  return `CRITICAL: Respond ONLY in English.
No mixing. No switching mid-sentence.`;
}

/** Appended to system prompts when lang is Turkish. */
export const TR_JSON_OUTPUT_RULE =
  "Respond in Turkish (tr). All output must be in Turkish. Every natural-language string value in your JSON (reasoning, issues, explanations, matched_skills, missing_keywords, top_keywords, parsing_issues, strengths, weaknesses, red_flags, biggest_gap, what_to_fix_first, role labels if natural language, etc.) must be written in Turkish — use Turkish skill phrases (e.g. veri analizi, proje yönetimi); only universal tokens like SQL, AWS, API may stay as symbols. Keep JSON keys exactly as specified in English.";
export const EN_JSON_OUTPUT_RULE =
  "Respond in English (en). All output must be in English. Keep JSON keys exactly as specified in English.";

/**
 * @param {string} baseSystem
 * @param {"en" | "tr"} langNorm
 */
export function systemPromptWithLang(baseSystem, langNorm) {
  const trLead = langNorm === "tr" ? `${MANDATORY_TURKISH_AI_OUTPUT}\n\n` : "";
  const critical = criticalOutputLanguageInstruction(langNorm);
  const mustRule =
    langNorm === "tr"
      ? "You MUST respond entirely in Turkish language. Every single word must be in Turkish."
      : "You MUST respond entirely in English language. Every single word must be in English.";
  const languageRule = langNorm === "tr" ? TR_JSON_OUTPUT_RULE : EN_JSON_OUTPUT_RULE;
  return `${trLead}${critical}\n\n${mustRule}\n${baseSystem}\n\n${languageRule}`;
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
  const responseLanguage = langNorm === "tr" ? "Turkish" : "English";
  const trLead = langNorm === "tr" ? `${MANDATORY_TURKISH_AI_OUTPUT}\n\n` : "";
  const critical = criticalOutputLanguageInstruction(langNorm);
  return `\n\n${trLead}${critical}\n\nIMPORTANT: Regardless of the language of the CV or job description, you MUST respond in ${responseLanguage}. Translate all findings to the response language.`;
}
