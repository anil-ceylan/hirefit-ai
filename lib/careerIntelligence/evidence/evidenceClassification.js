import { normalizeEvidenceItem, normalizeEvidenceList } from "./normalizeEvidence.js";
import { DEFAULT_CLASSIFICATION_STRATEGY } from "./evidenceIntelligenceConfig.js";

function textFor(item) {
  return `${item?.type || ""} ${item?.title || ""} ${item?.description || ""} ${(item?.skills || []).join(" ")} ${(item?.domains || []).join(" ")}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function matchesMap(text, map = {}) {
  return Object.entries(map)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([key]) => key);
}

export function classifyEvidence(input, { strategy = DEFAULT_CLASSIFICATION_STRATEGY, context = {} } = {}) {
  const item = normalizeEvidenceItem(input, context);
  const text = textFor(item);
  const inferredCategories = matchesMap(text, strategy.categories);
  const inferredCompetencies = matchesMap(text, strategy.competencies);
  const category = item.category || inferredCategories[0] || item.type || "claim";
  const competencies = unique([
    ...inferredCompetencies,
    ...item.skills.map((skill) => String(skill).toLowerCase().replace(/\s+/g, "_")),
    ...item.domains.map((domain) => String(domain).toLowerCase().replace(/\s+/g, "_")),
  ]);
  return {
    ...item,
    category,
    categories: unique([category, ...inferredCategories]),
    competencies,
    classification: {
      strategy: "default_pattern_strategy",
      matchedCategories: inferredCategories,
      matchedCompetencies: inferredCompetencies,
      confidence: competencies.length ? Math.min(95, 48 + competencies.length * 12 + inferredCategories.length * 8) : 28,
    },
  };
}

export function classifyEvidenceSet(input = [], options = {}) {
  return normalizeEvidenceList(input, options.context).map((item) => classifyEvidence(item, options));
}
