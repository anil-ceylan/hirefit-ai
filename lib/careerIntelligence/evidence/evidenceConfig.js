import { SOURCE_TYPES } from "./evidenceTypes.js";

export const EVIDENCE_FACTOR_WEIGHTS = Object.freeze({
  strength: 0.14,
  relevance: 0.14,
  recency: 0.08,
  specificity: 0.13,
  credibility: 0.13,
  ownership: 0.1,
  measurable_outcome: 0.12,
  role_alignment: 0.1,
  source_quality: 0.06,
});

export const EVIDENCE_WEIGHT_MATRIX = Object.freeze({
  strength: {
    weak_signal: 25,
    moderate_signal: 50,
    strong_signal: 74,
    verified_outcome: 92,
  },
  relevance: {
    generic: 28,
    role_adjacent: 52,
    directly_role_relevant: 76,
    target_role_specific: 92,
  },
  recency: {
    old: 34,
    still_relevant: 58,
    recent: 78,
    current: 90,
    unknown: 54,
  },
  specificity: {
    vague_claim: 22,
    contextual_claim: 48,
    concrete_example: 72,
    quantified_result: 92,
  },
  credibility: {
    self_asserted: 34,
    internally_consistent: 56,
    supported_by_context: 76,
    externally_verifiable: 92,
  },
  ownership: {
    assisted: 30,
    contributor: 52,
    primary_owner: 76,
    end_to_end_owner: 92,
    unknown: 44,
  },
  measurable_outcome: {
    no_result: 20,
    qualitative_result: 50,
    measurable_result: 78,
    business_or_user_impact: 92,
  },
  role_alignment: {
    unrelated: 22,
    adjacent: 50,
    relevant: 74,
    specific: 90,
  },
  source_quality: {
    [SOURCE_TYPES.UNKNOWN]: 28,
    [SOURCE_TYPES.USER_STATEMENT]: 38,
    [SOURCE_TYPES.CAREER_DNA]: 45,
    [SOURCE_TYPES.CAREER_SNAPSHOT]: 56,
    [SOURCE_TYPES.IMPORTED]: 58,
    [SOURCE_TYPES.CV]: 68,
    [SOURCE_TYPES.LINKEDIN]: 70,
    [SOURCE_TYPES.PORTFOLIO]: 78,
    [SOURCE_TYPES.GITHUB]: 82,
  },
});

export const REQUIRED_EVIDENCE_FIELDS = Object.freeze([
  "title",
  "description",
  "source_type",
  "role_context",
  "occurred_at",
]);

export const CONTRADICTION_RULES = Object.freeze([
  {
    id: "high_ownership_without_outcome",
    when: ({ factors }) => factors.ownership >= 76 && factors.measurable_outcome <= 30,
  },
  {
    id: "verified_source_with_vague_claim",
    when: ({ factors }) => factors.source_quality >= 76 && factors.specificity <= 30,
  },
  {
    id: "target_role_claim_without_role_context",
    when: ({ item, factors }) => /target|hedef|role|rol/i.test(`${item.type} ${item.title}`) && factors.role_alignment <= 35,
  },
]);

export const DEFAULT_ROLE_EVIDENCE_WEIGHTS = Object.freeze({
  default: {},
  PRODUCT: { relevance: 1.14, role_alignment: 1.14, ownership: 1.1, measurable_outcome: 1.08 },
  OPERATIONS: { strength: 1.08, ownership: 1.1, measurable_outcome: 1.12, specificity: 1.08 },
  BUSINESS: { relevance: 1.08, specificity: 1.08, credibility: 1.08, measurable_outcome: 1.08 },
  DATA: { specificity: 1.12, measurable_outcome: 1.12, source_quality: 1.08, credibility: 1.08 },
  SOFTWARE: { source_quality: 1.16, specificity: 1.08, strength: 1.08, measurable_outcome: 1.08 },
  MARKETING: { measurable_outcome: 1.14, relevance: 1.08, specificity: 1.08 },
  HR: { credibility: 1.12, ownership: 1.08, relevance: 1.08 },
  FINANCE: { credibility: 1.14, specificity: 1.12, measurable_outcome: 1.12 },
});
