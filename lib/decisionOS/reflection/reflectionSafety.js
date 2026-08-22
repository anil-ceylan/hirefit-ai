import { OPTIONAL_INSIGHT_PACK_NOTICE, asArray } from "./reflectionTypes.js";

const ABSOLUTE_LANGUAGE = /\b(definitely|guaranteed|certain|perfect fit|will succeed|diagnose|disorder|clinical|predicts the future|fated)\b/i;
const RECOMMENDATION_LANGUAGE = /\b(you should|must choose|must apply|the right decision is|we recommend choosing)\b/i;

function scanObject(value, path = "$", findings = []) {
  if (typeof value === "string") {
    if (ABSOLUTE_LANGUAGE.test(value)) findings.push({ path, code: "ABSOLUTE_OR_DIAGNOSTIC_LANGUAGE" });
    if (RECOMMENDATION_LANGUAGE.test(value)) findings.push({ path, code: "RECOMMENDATION_OVERRIDE_LANGUAGE" });
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanObject(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nested]) => scanObject(nested, `${path}.${key}`, findings));
  }
  return findings;
}

export function validateReflectionSafety(reflection = {}) {
  const errors = [];
  const warnings = [];
  if (reflection.influencesRecommendations !== false) {
    errors.push({ path: "influencesRecommendations", code: "REFLECTION_MUST_NOT_INFLUENCE_RECOMMENDATIONS" });
  }
  if (reflection.recommendationOverride != null) {
    errors.push({ path: "recommendationOverride", code: "REFLECTION_MUST_NOT_OVERRIDE_RECOMMENDATIONS" });
  }
  asArray(reflection.optionalInsightPacks).forEach((pack, index) => {
    if (pack.notice !== OPTIONAL_INSIGHT_PACK_NOTICE) {
      errors.push({ path: `optionalInsightPacks[${index}].notice`, code: "MISSING_OPTIONAL_PACK_NOTICE" });
    }
    if (pack.influencesRecommendations !== false) {
      errors.push({ path: `optionalInsightPacks[${index}].influencesRecommendations`, code: "OPTIONAL_PACK_MUST_NOT_INFLUENCE_RECOMMENDATIONS" });
    }
  });
  const unsafeLanguage = scanObject(reflection);
  unsafeLanguage.forEach((finding) => warnings.push(finding));
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
