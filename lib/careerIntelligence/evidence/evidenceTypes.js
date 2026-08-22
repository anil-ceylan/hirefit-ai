export const EVIDENCE_DIMENSIONS = Object.freeze([
  "strength",
  "relevance",
  "recency",
  "specificity",
  "credibility",
  "ownership",
  "measurable_outcome",
  "role_alignment",
  "source_quality",
]);

export const EVIDENCE_BANDS = Object.freeze({
  WEAK: "weak",
  MODERATE: "moderate",
  STRONG: "strong",
  VERIFIED_OUTCOME: "verified_outcome",
});

export const SOURCE_TYPES = Object.freeze({
  CV: "cv",
  LINKEDIN: "linkedin",
  PORTFOLIO: "portfolio",
  GITHUB: "github",
  CAREER_DNA: "career_dna",
  CAREER_SNAPSHOT: "career_snapshot",
  USER_STATEMENT: "user_statement",
  IMPORTED: "imported",
  UNKNOWN: "unknown",
});

export const DEFAULT_EVIDENCE_ITEM = Object.freeze({
  id: "",
  type: "generic",
  title: "",
  description: "",
  source: "",
  source_type: SOURCE_TYPES.UNKNOWN,
  created_at: "",
  occurred_at: "",
  role_context: "",
  skills: [],
  domains: [],
  metrics: [],
  ownership_level: "",
  confidence: null,
  raw_weight: null,
  normalized_weight: null,
  quality_breakdown: {},
  contradictions: [],
  missing_fields: [],
});

export function clampScore(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

export function scoreBand(score) {
  const value = clampScore(score);
  if (value >= 82) return EVIDENCE_BANDS.VERIFIED_OUTCOME;
  if (value >= 66) return EVIDENCE_BANDS.STRONG;
  if (value >= 42) return EVIDENCE_BANDS.MODERATE;
  return EVIDENCE_BANDS.WEAK;
}
