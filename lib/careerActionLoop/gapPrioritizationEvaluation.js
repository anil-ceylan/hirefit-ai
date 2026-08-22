import { ALIGNMENT_CLASSES, FAILURE_CODES } from "./promotionReadiness.js";
import {
  REAL_USER_COHORT_STATES,
  VALIDATION_SOURCE_KINDS,
} from "./realUserShadowValidation.js";
import { stableHash } from "../careerIntelligence/observatory/utils.js";

export const GAP_PRIORITIZATION_EVALUATION_VERSION = "gap-prioritization-evaluation.v1";

export const GAP_RELATIONSHIP_CLASSES = Object.freeze({
  SAME_GAP: "SAME_GAP",
  SEMANTICALLY_SIMILAR: "SEMANTICALLY_SIMILAR",
  SHADOW_REFINEMENT: "SHADOW_REFINEMENT",
  MEANINGFUL_DIFFERENCE: "MEANINGFUL_DIFFERENCE",
  CONFLICTING_DIRECTION: "CONFLICTING_DIRECTION",
  INSUFFICIENT_SIGNAL: "INSUFFICIENT_SIGNAL",
});

export const SHADOW_GAP_CHANGE_REASONS = Object.freeze({
  NEW_EVIDENCE_FILLED_PREVIOUS_GAP: "NEW_EVIDENCE_FILLED_PREVIOUS_GAP",
  NEW_EVIDENCE_EXPOSED_NEXT_GAP: "NEW_EVIDENCE_EXPOSED_NEXT_GAP",
  CONTRADICTION_FOUND: "CONTRADICTION_FOUND",
  EVIDENCE_QUALITY_CHANGED: "EVIDENCE_QUALITY_CHANGED",
  MARKET_RESPONSE_CHANGED_PRIORITY: "MARKET_RESPONSE_CHANGED_PRIORITY",
  REDUNDANT_EVIDENCE_IGNORED: "REDUNDANT_EVIDENCE_IGNORED",
  LOW_CONFIDENCE_SHIFT: "LOW_CONFIDENCE_SHIFT",
  UNKNOWN: "UNKNOWN",
});

export const GAP_OUTCOME_SIGNALS = Object.freeze({
  SUPPORTS_SHADOW: "SUPPORTS_SHADOW",
  SUPPORTS_PRODUCTION: "SUPPORTS_PRODUCTION",
  SUPPORTS_BOTH: "SUPPORTS_BOTH",
  SUPPORTS_NEITHER: "SUPPORTS_NEITHER",
  INCONCLUSIVE: "INCONCLUSIVE",
  NO_FOLLOWUP_YET: "NO_FOLLOWUP_YET",
});

export const GAP_REVIEW_JUDGMENTS = Object.freeze({
  SHADOW_BETTER: "SHADOW_BETTER",
  PRODUCTION_BETTER: "PRODUCTION_BETTER",
  BOTH_REASONABLE: "BOTH_REASONABLE",
  NEITHER_RELIABLE: "NEITHER_RELIABLE",
  INSUFFICIENT_CONTEXT: "INSUFFICIENT_CONTEXT",
});

export const GAP_WINNER_CLASSIFICATIONS = Object.freeze({
  SHADOW_DIRECTIONALLY_BETTER: "SHADOW_DIRECTIONALLY_BETTER",
  PRODUCTION_DIRECTIONALLY_BETTER: "PRODUCTION_DIRECTIONALLY_BETTER",
  EQUIVALENT: "EQUIVALENT",
  UNRESOLVED: "UNRESOLVED",
  UNSAFE_TO_COMPARE: "UNSAFE_TO_COMPARE",
});

export const GAP_DATA_SUFFICIENCY = Object.freeze({
  NOT_ENOUGH_RUNS: "NOT_ENOUGH_RUNS",
  NOT_ENOUGH_DIVERGENCE: "NOT_ENOUGH_DIVERGENCE",
  NOT_ENOUGH_REVIEW: "NOT_ENOUGH_REVIEW",
  NOT_ENOUGH_FOLLOWUP_OUTCOMES: "NOT_ENOUGH_FOLLOWUP_OUTCOMES",
  NOT_ENOUGH_SAFETY_DATA: "NOT_ENOUGH_SAFETY_DATA",
  SUFFICIENT_FOR_LIMITED_EXPERIMENT: "SUFFICIENT_FOR_LIMITED_EXPERIMENT",
});

export const GAP_PROMOTION_STATES = Object.freeze({
  OBSERVE_MORE: "OBSERVE_MORE",
  LIMITED_EXPERIMENT_CANDIDATE: "LIMITED_EXPERIMENT_CANDIDATE",
  LIMITED_EXPERIMENT_READY: "LIMITED_EXPERIMENT_READY",
});

export const DEFAULT_GAP_EVALUATION_CONFIG = Object.freeze({
  minimumCompleteRealCycles: 30,
  minimumDivergentGapCases: "TBD_AFTER_REAL_COHORT",
  minimumHumanReviewCoverage: "TBD_AFTER_REAL_COHORT",
  minimumFollowupCoverage: "TBD_AFTER_REAL_COHORT",
  maximumUnsafeComparisonRate: "TBD_AFTER_REAL_COHORT",
  minimumShadowBetterRate: "TBD_AFTER_REAL_COHORT",
  weakEvidenceTrust: 45,
  weakEvidenceStrength: 45,
});

const GAP_TAXONOMY = Object.freeze([
  {
    id: "stakeholder_influence",
    keywords: ["stakeholder", "paydas", "cross_functional", "crossfunctional", "influence", "scope", "team_impact"],
    refinements: ["stakeholder_impact", "cross_functional_influence", "stakeholder_scope"],
  },
  {
    id: "measurable_impact",
    keywords: ["metric", "metrics", "measurable", "quantified", "impact", "outcome", "result", "sonuc", "business_impact"],
    refinements: ["product_metrics", "quantified_outcomes", "measured_business_impact"],
  },
  {
    id: "portfolio_proof",
    keywords: ["portfolio", "artifact", "proof", "kanit", "github", "case_study", "work_sample"],
    refinements: ["product_case_study", "quantified_product_case_study", "visible_artifact"],
  },
  {
    id: "business_case",
    keywords: ["business_case", "case", "strategy_case", "decision_case"],
    refinements: ["quantified_product_case_study", "decision_case_with_metrics"],
  },
  {
    id: "leadership_scope",
    keywords: ["leadership", "owner", "ownership", "led", "managed", "scope"],
    refinements: ["leadership_scope", "ownership_scope", "team_leadership"],
  },
  {
    id: "technical_sql",
    keywords: ["sql", "database", "technical", "analytics", "data"],
    refinements: ["sql_proof", "analytics_project", "data_portfolio"],
  },
  {
    id: "role_clarity",
    keywords: ["role", "clarity", "positioning", "identity", "direction"],
    refinements: ["positioning_clarity", "target_role_clarity"],
  },
  {
    id: "networking",
    keywords: ["network", "networking", "connection", "informational", "mentor"],
    refinements: ["target_role_networking", "recruiter_networking"],
  },
  {
    id: "recency",
    keywords: ["recent", "fresh", "recency", "current", "timeline"],
    refinements: ["recent_evidence", "current_activity"],
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function compact(value, max = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function taxonomyEntryFor(value) {
  const id = normalizeText(value);
  if (!id) return null;
  return GAP_TAXONOMY.find((entry) => entry.id === id || entry.refinements.some((refinement) => id.includes(refinement))) ||
    GAP_TAXONOMY.find((entry) => entry.keywords.some((keyword) => id.includes(keyword))) ||
    null;
}

export function normalizeGap(value) {
  const raw = compact(value, 120);
  const id = normalizeText(raw);
  if (!id) {
    return {
      raw: null,
      canonical_id: null,
      dimension: null,
      specificity: "unknown",
      confidence: 0,
    };
  }
  const entry = taxonomyEntryFor(id);
  if (!entry) {
    return {
      raw,
      canonical_id: id,
      dimension: "unknown",
      specificity: "unknown",
      confidence: 20,
    };
  }
  const refinement = entry.refinements.find((item) => id.includes(item)) || null;
  return {
    raw,
    canonical_id: refinement || entry.id,
    dimension: entry.id,
    specificity: refinement ? "specific" : "category",
    confidence: refinement ? 80 : 70,
  };
}

function isRefinement(generalGap, specificGap) {
  if (!generalGap?.dimension || !specificGap?.dimension) return false;
  return generalGap.dimension === specificGap.dimension &&
    generalGap.specificity === "category" &&
    specificGap.specificity === "specific";
}

export function classifyGapRelationship({ productionGap, shadowGap, baselineShadowGap } = {}) {
  const production = normalizeGap(productionGap);
  const shadow = normalizeGap(shadowGap);
  const baseline = normalizeGap(baselineShadowGap);
  if (!production.canonical_id || !shadow.canonical_id) {
    return {
      classification: GAP_RELATIONSHIP_CLASSES.INSUFFICIENT_SIGNAL,
      production,
      shadow,
      baseline,
      reason: "At least one gap is missing.",
    };
  }
  if (production.canonical_id === shadow.canonical_id) {
    return {
      classification: GAP_RELATIONSHIP_CLASSES.SAME_GAP,
      production,
      shadow,
      baseline,
      reason: "Production and shadow normalize to the same canonical gap.",
    };
  }
  if (isRefinement(production, shadow) || isRefinement(baseline, shadow)) {
    return {
      classification: GAP_RELATIONSHIP_CLASSES.SHADOW_REFINEMENT,
      production,
      shadow,
      baseline,
      reason: "Shadow narrows a broader gap into a more specific bottleneck.",
    };
  }
  if (production.dimension !== "unknown" && production.dimension === shadow.dimension) {
    return {
      classification: GAP_RELATIONSHIP_CLASSES.SEMANTICALLY_SIMILAR,
      production,
      shadow,
      baseline,
      reason: "Production and shadow gaps are in the same evidence dimension.",
    };
  }
  if (production.dimension === "unknown" || shadow.dimension === "unknown") {
    return {
      classification: GAP_RELATIONSHIP_CLASSES.INSUFFICIENT_SIGNAL,
      production,
      shadow,
      baseline,
      reason: "Gap wording is not safely mapped to a known dimension.",
    };
  }
  if (production.dimension === "role_clarity" && shadow.dimension !== "role_clarity") {
    return {
      classification: GAP_RELATIONSHIP_CLASSES.CONFLICTING_DIRECTION,
      production,
      shadow,
      baseline,
      reason: "Production asks for positioning clarity while shadow prioritizes a different proof dimension.",
    };
  }
  return {
    classification: GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE,
    production,
    shadow,
    baseline,
    reason: "Production and shadow prioritize different evidence dimensions.",
  };
}

export function classifyShadowGapChangeReason({ evaluation = {}, comparison = {}, relationship = {} } = {}) {
  const gapChanged = Boolean(comparison.reasoning_change?.gap_changed);
  const conflictChanged = Boolean(comparison.reasoning_change?.conflict_changed) || evaluation.status === "evaluated_conflicted";
  const marketResponse = evaluation.candidate_type === "market_response";
  const weakEvidence = Number(evaluation.trust || 0) < DEFAULT_GAP_EVALUATION_CONFIG.weakEvidenceTrust ||
    Number(evaluation.strength || 0) < DEFAULT_GAP_EVALUATION_CONFIG.weakEvidenceStrength;
  const baselineGap = normalizeGap(comparison.baseline?.strongest_gap);
  const augmentedGap = normalizeGap(comparison.augmented?.strongest_gap);
  if (!gapChanged) return SHADOW_GAP_CHANGE_REASONS.UNKNOWN;
  if (conflictChanged) return SHADOW_GAP_CHANGE_REASONS.CONTRADICTION_FOUND;
  if (marketResponse) return SHADOW_GAP_CHANGE_REASONS.MARKET_RESPONSE_CHANGED_PRIORITY;
  if (weakEvidence) return SHADOW_GAP_CHANGE_REASONS.LOW_CONFIDENCE_SHIFT;
  if (relationship.classification === GAP_RELATIONSHIP_CLASSES.SHADOW_REFINEMENT) {
    return SHADOW_GAP_CHANGE_REASONS.NEW_EVIDENCE_EXPOSED_NEXT_GAP;
  }
  if (baselineGap.dimension && augmentedGap.dimension && baselineGap.dimension !== augmentedGap.dimension) {
    return SHADOW_GAP_CHANGE_REASONS.NEW_EVIDENCE_FILLED_PREVIOUS_GAP;
  }
  if (comparison.evidence_change?.quality_changed || comparison.evidence_change?.coverage_changed) {
    return SHADOW_GAP_CHANGE_REASONS.EVIDENCE_QUALITY_CHANGED;
  }
  return SHADOW_GAP_CHANGE_REASONS.UNKNOWN;
}

function targetDimensionFrom(value) {
  return normalizeGap(value).dimension;
}

function outcomeIsMarketOnly(outcome = {}) {
  return ["INTERVIEW", "OFFER", "REJECTION", "EXTERNAL_RESPONSE"].includes(outcome.outcome_type);
}

export function classifyGapOutcomeSignal({
  gapEvaluation = {},
  followupAction = {},
  followupOutcome = {},
  followupEvaluation = {},
} = {}) {
  if (!followupAction?.action_id && !followupOutcome?.outcome_id && !followupEvaluation?.evaluation_id) {
    return GAP_OUTCOME_SIGNALS.NO_FOLLOWUP_YET;
  }
  if (outcomeIsMarketOnly(followupOutcome) && !followupEvaluation?.usable_for_shadow) {
    return GAP_OUTCOME_SIGNALS.INCONCLUSIVE;
  }
  const actionDimension = targetDimensionFrom(followupAction.target_dimension || followupAction.blocker || followupAction.title);
  const productionDimension = gapEvaluation.production_gap?.dimension;
  const shadowDimension = gapEvaluation.augmented_shadow_gap?.dimension;
  const supportsProduction = Boolean(actionDimension && productionDimension && actionDimension === productionDimension);
  const supportsShadow = Boolean(actionDimension && shadowDimension && actionDimension === shadowDimension);
  if (supportsProduction && supportsShadow) return GAP_OUTCOME_SIGNALS.SUPPORTS_BOTH;
  if (supportsShadow) return GAP_OUTCOME_SIGNALS.SUPPORTS_SHADOW;
  if (supportsProduction) return GAP_OUTCOME_SIGNALS.SUPPORTS_PRODUCTION;
  if (followupEvaluation?.usable_for_shadow) return GAP_OUTCOME_SIGNALS.SUPPORTS_NEITHER;
  return GAP_OUTCOME_SIGNALS.INCONCLUSIVE;
}

export function classifyGapWinner({ gapEvaluation = {}, review = null } = {}) {
  if (gapEvaluation.relationship_class === GAP_RELATIONSHIP_CLASSES.INSUFFICIENT_SIGNAL ||
    gapEvaluation.relationship_class === GAP_RELATIONSHIP_CLASSES.CONFLICTING_DIRECTION ||
    asArray(gapEvaluation.safety_flags).includes(FAILURE_CODES.UNSAFE_DIVERGENCE)) {
    return GAP_WINNER_CLASSIFICATIONS.UNSAFE_TO_COMPARE;
  }
  const judgment = review?.judgment || gapEvaluation.human_judgment || null;
  if (judgment === GAP_REVIEW_JUDGMENTS.SHADOW_BETTER) return GAP_WINNER_CLASSIFICATIONS.SHADOW_DIRECTIONALLY_BETTER;
  if (judgment === GAP_REVIEW_JUDGMENTS.PRODUCTION_BETTER) return GAP_WINNER_CLASSIFICATIONS.PRODUCTION_DIRECTIONALLY_BETTER;
  if (judgment === GAP_REVIEW_JUDGMENTS.BOTH_REASONABLE) return GAP_WINNER_CLASSIFICATIONS.EQUIVALENT;
  if ([GAP_OUTCOME_SIGNALS.SUPPORTS_SHADOW, GAP_OUTCOME_SIGNALS.SUPPORTS_PRODUCTION, GAP_OUTCOME_SIGNALS.SUPPORTS_BOTH].includes(gapEvaluation.outcome_signal)) {
    if (gapEvaluation.outcome_signal === GAP_OUTCOME_SIGNALS.SUPPORTS_SHADOW) return GAP_WINNER_CLASSIFICATIONS.SHADOW_DIRECTIONALLY_BETTER;
    if (gapEvaluation.outcome_signal === GAP_OUTCOME_SIGNALS.SUPPORTS_PRODUCTION) return GAP_WINNER_CLASSIFICATIONS.PRODUCTION_DIRECTIONALLY_BETTER;
    return GAP_WINNER_CLASSIFICATIONS.EQUIVALENT;
  }
  if ([
    GAP_RELATIONSHIP_CLASSES.SAME_GAP,
    GAP_RELATIONSHIP_CLASSES.SEMANTICALLY_SIMILAR,
  ].includes(gapEvaluation.relationship_class)) {
    return GAP_WINNER_CLASSIFICATIONS.EQUIVALENT;
  }
  return GAP_WINNER_CLASSIFICATIONS.UNRESOLVED;
}

export function buildGapEvaluation({
  validationRun = {},
  evaluation = {},
  comparison = {},
  productionSnapshot = {},
  subsequentAction = {},
  subsequentOutcome = {},
  subsequentEvaluation = {},
  humanJudgment = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const productionGap = validationRun.gap_comparison?.production_gap_id ||
    productionSnapshot.gapDetails?.title ||
    productionSnapshot.biggestGap?.title ||
    productionSnapshot.biggestGap ||
    "";
  const baselineGap = validationRun.gap_comparison?.baseline_gap_id || comparison.baseline?.strongest_gap || "";
  const augmentedGap = validationRun.gap_comparison?.augmented_gap_id || comparison.augmented?.strongest_gap || "";
  const relationship = classifyGapRelationship({
    productionGap,
    baselineShadowGap: baselineGap,
    shadowGap: augmentedGap,
  });
  const changeReason = classifyShadowGapChangeReason({ evaluation, comparison, relationship });
  const draft = {
    gap_evaluation_id: `gap_eval_${stableHash({
      validation_id: validationRun.validation_id,
      subsequent_action_id: subsequentAction.action_id,
      subsequent_outcome_id: subsequentOutcome.outcome_id,
      version: GAP_PRIORITIZATION_EVALUATION_VERSION,
    })}`,
    validation_id: validationRun.validation_id || null,
    user_id: validationRun.user_id || evaluation.user_id || null,
    source_kind: validationRun.source_kind || VALIDATION_SOURCE_KINDS.DEVELOPMENT_FIXTURE,
    is_real_user: validationRun.source_kind === VALIDATION_SOURCE_KINDS.REAL_BETA_USER && Boolean(validationRun.is_real_user),
    production_gap: relationship.production,
    baseline_shadow_gap: relationship.baseline,
    augmented_shadow_gap: relationship.shadow,
    relationship_class: relationship.classification,
    alignment_class: validationRun.alignment_class || ALIGNMENT_CLASSES.INSUFFICIENT_SIGNAL,
    evidence_candidate_id: validationRun.candidate_id || evaluation.candidate_id || null,
    evidence_evaluation_id: validationRun.evaluation_id || evaluation.evaluation_id || null,
    subsequent_action_id: subsequentAction.action_id || null,
    subsequent_outcome_id: subsequentOutcome.outcome_id || null,
    shadow_change_reason: changeReason,
    human_judgment: humanJudgment,
    outcome_signal: GAP_OUTCOME_SIGNALS.NO_FOLLOWUP_YET,
    winner_classification: GAP_WINNER_CLASSIFICATIONS.UNRESOLVED,
    confidence: relationship.production.confidence && relationship.shadow.confidence
      ? Math.min(relationship.production.confidence, relationship.shadow.confidence)
      : 0,
    safety_flags: asArray(validationRun.failure_flags),
    explanation: compact(relationship.reason, 180),
    created_at: createdAt,
    resolved_at: null,
    versions: {
      gap_evaluation: GAP_PRIORITIZATION_EVALUATION_VERSION,
      validation: validationRun.versions?.validation || null,
      readiness: validationRun.versions?.readiness || null,
    },
  };
  const outcomeSignal = classifyGapOutcomeSignal({
    gapEvaluation: draft,
    followupAction: subsequentAction,
    followupOutcome: subsequentOutcome,
    followupEvaluation: subsequentEvaluation,
  });
  return {
    ...draft,
    outcome_signal: outcomeSignal,
    winner_classification: classifyGapWinner({ gapEvaluation: { ...draft, outcome_signal: outcomeSignal } }),
    resolved_at: outcomeSignal === GAP_OUTCOME_SIGNALS.NO_FOLLOWUP_YET ? null : createdAt,
  };
}

export function linkFollowupOutcomeToGapEvaluation(gapEvaluation = {}, {
  action = {},
  outcome = {},
  evaluation = {},
  linkedAt = new Date().toISOString(),
} = {}) {
  const updated = {
    ...gapEvaluation,
    subsequent_action_id: action.action_id || gapEvaluation.subsequent_action_id || null,
    subsequent_outcome_id: outcome.outcome_id || gapEvaluation.subsequent_outcome_id || null,
  };
  const signal = classifyGapOutcomeSignal({
    gapEvaluation: updated,
    followupAction: action,
    followupOutcome: outcome,
    followupEvaluation: evaluation,
  });
  return {
    ...updated,
    outcome_signal: signal,
    winner_classification: classifyGapWinner({ gapEvaluation: { ...updated, outcome_signal: signal } }),
    resolved_at: signal === GAP_OUTCOME_SIGNALS.NO_FOLLOWUP_YET ? gapEvaluation.resolved_at || null : linkedAt,
  };
}

export function buildGapHumanReview({
  gapEvaluationId,
  judgment,
  reviewer = "founder_internal",
  reviewedAt = new Date().toISOString(),
  notes = "",
} = {}) {
  if (!gapEvaluationId) throw new Error("gap_evaluation_id is required");
  if (!Object.values(GAP_REVIEW_JUDGMENTS).includes(judgment)) throw new Error("Invalid gap review judgment");
  return {
    gap_review_id: `gap_review_${stableHash({ gapEvaluationId, reviewer })}`,
    gap_evaluation_id: gapEvaluationId,
    judgment,
    status: "reviewed",
    reviewed_at: reviewedAt,
    reviewer_role: String(reviewer || "founder_internal").slice(0, 80),
    notes: compact(notes, 180),
    version: GAP_PRIORITIZATION_EVALUATION_VERSION,
  };
}

function upsertById(items, incoming, idKey) {
  if (!incoming?.[idKey]) return asArray(items);
  const next = asArray(items).slice();
  const index = next.findIndex((item) => item?.[idKey] === incoming[idKey]);
  if (index >= 0) next[index] = { ...next[index], ...incoming };
  else next.unshift(incoming);
  return next.slice(0, 30);
}

export function upsertGapEvaluation(gapEvaluations = [], gapEvaluation = null) {
  return upsertById(gapEvaluations, gapEvaluation, "gap_evaluation_id");
}

export function upsertGapHumanReview(shadowLearning = {}, reviewInput = {}) {
  const review = buildGapHumanReview(reviewInput);
  const gapReviews = upsertById(shadowLearning.gap_human_reviews, review, "gap_review_id");
  const gapEvaluations = asArray(shadowLearning.gap_evaluations).map((evaluation) => {
    if (evaluation.gap_evaluation_id !== review.gap_evaluation_id) return evaluation;
    const reviewed = {
      ...evaluation,
      human_judgment: review.judgment,
      review_status: "reviewed",
      resolved_at: review.reviewed_at,
    };
    return {
      ...reviewed,
      winner_classification: classifyGapWinner({ gapEvaluation: reviewed, review }),
    };
  });
  return {
    ...shadowLearning,
    gap_evaluations: gapEvaluations,
    gap_human_reviews: gapReviews,
    gap_prioritization_summary: calculateGapPrioritizationMetrics({
      ...shadowLearning,
      gap_evaluations: gapEvaluations,
      gap_human_reviews: gapReviews,
    }),
  };
}

function realGapEvaluations(shadowLearning = {}) {
  return asArray(shadowLearning.gap_evaluations)
    .filter((evaluation) => evaluation.source_kind === VALIDATION_SOURCE_KINDS.REAL_BETA_USER && evaluation.is_real_user);
}

function hasReview(gapEvaluation, reviews) {
  return asArray(reviews).some((review) => review.gap_evaluation_id === gapEvaluation.gap_evaluation_id);
}

function hasDivergence(evaluation) {
  return [
    GAP_RELATIONSHIP_CLASSES.SHADOW_REFINEMENT,
    GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE,
    GAP_RELATIONSHIP_CLASSES.CONFLICTING_DIRECTION,
  ].includes(evaluation.relationship_class);
}

export function evaluateGapDataSufficiency(shadowLearning = {}, config = {}) {
  const cfg = { ...DEFAULT_GAP_EVALUATION_CONFIG, ...config };
  const evaluations = realGapEvaluations(shadowLearning);
  const reviews = asArray(shadowLearning.gap_human_reviews);
  const divergent = evaluations.filter(hasDivergence);
  const reviewedDivergent = divergent.filter((evaluation) => hasReview(evaluation, reviews) || evaluation.human_judgment);
  const followup = evaluations.filter((evaluation) => evaluation.outcome_signal && evaluation.outcome_signal !== GAP_OUTCOME_SIGNALS.NO_FOLLOWUP_YET);
  const unsafe = evaluations.filter((evaluation) => evaluation.winner_classification === GAP_WINNER_CLASSIFICATIONS.UNSAFE_TO_COMPARE);
  if (evaluations.length < cfg.minimumCompleteRealCycles) return GAP_DATA_SUFFICIENCY.NOT_ENOUGH_RUNS;
  if (!divergent.length) return GAP_DATA_SUFFICIENCY.NOT_ENOUGH_DIVERGENCE;
  if (!reviewedDivergent.length) return GAP_DATA_SUFFICIENCY.NOT_ENOUGH_REVIEW;
  if (!followup.length) return GAP_DATA_SUFFICIENCY.NOT_ENOUGH_FOLLOWUP_OUTCOMES;
  if (!evaluations.length || unsafe.length / evaluations.length > 0) return GAP_DATA_SUFFICIENCY.NOT_ENOUGH_SAFETY_DATA;
  const unresolved = [
    cfg.minimumDivergentGapCases,
    cfg.minimumHumanReviewCoverage,
    cfg.minimumFollowupCoverage,
    cfg.maximumUnsafeComparisonRate,
    cfg.minimumShadowBetterRate,
  ].some((value) => String(value || "").includes("TBD_AFTER_REAL_COHORT"));
  return unresolved
    ? GAP_DATA_SUFFICIENCY.NOT_ENOUGH_SAFETY_DATA
    : GAP_DATA_SUFFICIENCY.SUFFICIENT_FOR_LIMITED_EXPERIMENT;
}

export function classifyGapPromotionState(shadowLearning = {}, config = {}) {
  const sufficiency = evaluateGapDataSufficiency(shadowLearning, config);
  if (sufficiency === GAP_DATA_SUFFICIENCY.SUFFICIENT_FOR_LIMITED_EXPERIMENT) {
    return GAP_PROMOTION_STATES.LIMITED_EXPERIMENT_CANDIDATE;
  }
  return GAP_PROMOTION_STATES.OBSERVE_MORE;
}

export function calculateGapPrioritizationMetrics(shadowLearning = {}, config = {}) {
  const evaluations = realGapEvaluations(shadowLearning);
  const reviews = asArray(shadowLearning.gap_human_reviews);
  const divergent = evaluations.filter(hasDivergence);
  const reviewed = evaluations.filter((evaluation) => hasReview(evaluation, reviews) || evaluation.human_judgment);
  const followup = evaluations.filter((evaluation) => evaluation.outcome_signal && evaluation.outcome_signal !== GAP_OUTCOME_SIGNALS.NO_FOLLOWUP_YET);
  const unsafe = evaluations.filter((evaluation) => evaluation.winner_classification === GAP_WINNER_CLASSIFICATIONS.UNSAFE_TO_COMPARE);
  return {
    real_user_count: new Set(evaluations.map((evaluation) => evaluation.user_id).filter(Boolean)).size,
    gap_evaluation_count: evaluations.length,
    production_shadow_same_gap_rate: rate(evaluations.filter((item) => item.relationship_class === GAP_RELATIONSHIP_CLASSES.SAME_GAP).length, evaluations.length),
    semantic_similarity_rate: rate(evaluations.filter((item) => item.relationship_class === GAP_RELATIONSHIP_CLASSES.SEMANTICALLY_SIMILAR).length, evaluations.length),
    shadow_refinement_rate: rate(evaluations.filter((item) => item.relationship_class === GAP_RELATIONSHIP_CLASSES.SHADOW_REFINEMENT).length, evaluations.length),
    meaningful_gap_divergence_rate: rate(evaluations.filter((item) => item.relationship_class === GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE).length, evaluations.length),
    shadow_directionally_better_rate: rate(evaluations.filter((item) => item.winner_classification === GAP_WINNER_CLASSIFICATIONS.SHADOW_DIRECTIONALLY_BETTER).length, evaluations.length),
    production_directionally_better_rate: rate(evaluations.filter((item) => item.winner_classification === GAP_WINNER_CLASSIFICATIONS.PRODUCTION_DIRECTIONALLY_BETTER).length, evaluations.length),
    equivalent_rate: rate(evaluations.filter((item) => item.winner_classification === GAP_WINNER_CLASSIFICATIONS.EQUIVALENT).length, evaluations.length),
    unresolved_rate: rate(evaluations.filter((item) => item.winner_classification === GAP_WINNER_CLASSIFICATIONS.UNRESOLVED).length, evaluations.length),
    unsafe_comparison_rate: rate(unsafe.length, evaluations.length),
    followup_outcome_coverage_rate: rate(followup.length, evaluations.length),
    human_review_coverage_rate: rate(reviewed.length, divergent.length),
    gap_adaptation_rate: rate(evaluations.filter((item) => item.shadow_change_reason === SHADOW_GAP_CHANGE_REASONS.NEW_EVIDENCE_EXPOSED_NEXT_GAP).length, evaluations.length),
    data_sufficiency: evaluateGapDataSufficiency(shadowLearning, config),
    promotion_state: classifyGapPromotionState(shadowLearning, config),
    real_user_only: true,
    synthetic_excluded: true,
    version: GAP_PRIORITIZATION_EVALUATION_VERSION,
    cohort_state: evaluations.length ? REAL_USER_COHORT_STATES.VALIDATION_IN_PROGRESS : REAL_USER_COHORT_STATES.INSUFFICIENT_REAL_DATA,
  };
}
