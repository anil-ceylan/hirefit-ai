import { ALIGNMENT_CLASSES, FAILURE_CODES } from "./promotionReadiness.js";
import { stableHash } from "../careerIntelligence/observatory/utils.js";

export const REAL_SHADOW_VALIDATION_VERSION = "real-shadow-validation.v1";

export const VALIDATION_SOURCE_KINDS = Object.freeze({
  REAL_BETA_USER: "real_beta_user",
  DEVELOPMENT_FIXTURE: "development_fixture",
  SYNTHETIC: "synthetic",
});

export const REVIEW_CLASSIFICATIONS = Object.freeze({
  AUTO_CLEAR: "AUTO_CLEAR",
  REVIEW_RECOMMENDED: "REVIEW_RECOMMENDED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
});

export const REVIEW_JUDGMENTS = Object.freeze({
  SHADOW_DIRECTIONALLY_CORRECT: "SHADOW_DIRECTIONALLY_CORRECT",
  PRODUCTION_DIRECTIONALLY_CORRECT: "PRODUCTION_DIRECTIONALLY_CORRECT",
  BOTH_REASONABLE: "BOTH_REASONABLE",
  INSUFFICIENT_CONTEXT: "INSUFFICIENT_CONTEXT",
  SHADOW_UNSTABLE: "SHADOW_UNSTABLE",
  EVIDENCE_TOO_WEAK: "EVIDENCE_TOO_WEAK",
  MODEL_ERROR: "MODEL_ERROR",
});

export const REAL_USER_COHORT_STATES = Object.freeze({
  INSUFFICIENT_REAL_DATA: "INSUFFICIENT_REAL_DATA",
  EARLY_SIGNAL: "EARLY_SIGNAL",
  VALIDATION_IN_PROGRESS: "VALIDATION_IN_PROGRESS",
  EXPERIMENT_CANDIDATE: "EXPERIMENT_CANDIDATE",
});

export const GAP_COMPARISON_CLASSES = Object.freeze({
  SAME: "same",
  SEMANTICALLY_SIMILAR: "semantically_similar",
  CHANGED_DUE_TO_USABLE_EVIDENCE: "changed_due_to_usable_evidence",
  CHANGED_UNEXPECTEDLY: "changed_unexpectedly",
  INSUFFICIENT_SIGNAL: "insufficient_signal",
});

export const DEFAULT_REAL_USER_VALIDATION_CONFIG = Object.freeze({
  minimumCompleteRealCycles: 30,
  minimumReviewedDivergentRuns: "TBD_AFTER_BETA_DATA",
  maximumUnsafeDivergenceRate: "TBD_AFTER_BETA_DATA",
  minimumShadowReviewAgreementRate: "TBD_AFTER_BETA_DATA",
  largeConfidenceDrop: 10,
  weakEvidenceTrust: 45,
  weakEvidenceStrength: 45,
});

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function uniqueCount(values) {
  return new Set(asArray(values).filter(Boolean)).size;
}

function sourceKind(value) {
  return Object.values(VALIDATION_SOURCE_KINDS).includes(value)
    ? value
    : VALIDATION_SOURCE_KINDS.DEVELOPMENT_FIXTURE;
}

function isRealUserSource(kind) {
  return kind === VALIDATION_SOURCE_KINDS.REAL_BETA_USER;
}

function gapCategory(value) {
  const id = normalizeId(value);
  if (!id) return "";
  if (/stakeholder|paydas/.test(id)) return "stakeholder";
  if (/metric|measurable|quantified|impact|business|outcome|sonuc/.test(id)) return "measurable_impact";
  if (/portfolio|case|artifact|proof|kanit/.test(id)) return "proof";
  if (/role|skill|competency/.test(id)) return "role_skill";
  if (/recent|fresh|recency/.test(id)) return "recency";
  return id;
}

function productionGapId(productionSnapshot = {}) {
  return normalizeId(
    productionSnapshot.gapDetails?.title ||
      productionSnapshot.biggestGap?.title ||
      productionSnapshot.biggestGap ||
      productionSnapshot.primaryGap ||
      productionSnapshot.gap ||
      ""
  );
}

export function classifyGapPrioritization({
  productionSnapshot = {},
  comparison = {},
  evaluation = {},
} = {}) {
  const productionGap = productionGapId(productionSnapshot);
  const baselineGap = normalizeId(comparison.baseline?.strongest_gap);
  const augmentedGap = normalizeId(comparison.augmented?.strongest_gap);
  const usable = Boolean(evaluation.usable_for_shadow);
  const material = Boolean(comparison.material_change);
  const gapChanged = Boolean(comparison.reasoning_change?.gap_changed);
  const weakEvidence = Number(evaluation.trust || 0) < DEFAULT_REAL_USER_VALIDATION_CONFIG.weakEvidenceTrust ||
    Number(evaluation.strength || 0) < DEFAULT_REAL_USER_VALIDATION_CONFIG.weakEvidenceStrength;

  if (!productionGap && !baselineGap && !augmentedGap) {
    return {
      classification: GAP_COMPARISON_CLASSES.INSUFFICIENT_SIGNAL,
      production_gap_id: null,
      baseline_gap_id: null,
      augmented_gap_id: null,
      reason: "No comparable gap signal exists.",
    };
  }

  if (productionGap && augmentedGap && productionGap === augmentedGap) {
    return {
      classification: GAP_COMPARISON_CLASSES.SAME,
      production_gap_id: productionGap,
      baseline_gap_id: baselineGap || null,
      augmented_gap_id: augmentedGap,
      reason: "Production and augmented shadow select the same gap.",
    };
  }

  if (productionGap && augmentedGap && gapCategory(productionGap) === gapCategory(augmentedGap)) {
    return {
      classification: GAP_COMPARISON_CLASSES.SEMANTICALLY_SIMILAR,
      production_gap_id: productionGap,
      baseline_gap_id: baselineGap || null,
      augmented_gap_id: augmentedGap,
      reason: "Production and augmented shadow select related gap categories.",
    };
  }

  if (gapChanged && material && usable && !weakEvidence) {
    return {
      classification: GAP_COMPARISON_CLASSES.CHANGED_DUE_TO_USABLE_EVIDENCE,
      production_gap_id: productionGap || null,
      baseline_gap_id: baselineGap || null,
      augmented_gap_id: augmentedGap || null,
      reason: "Usable evaluated evidence changed the shadow gap priority.",
    };
  }

  if (gapChanged || (productionGap && augmentedGap && productionGap !== augmentedGap)) {
    return {
      classification: GAP_COMPARISON_CLASSES.CHANGED_UNEXPECTEDLY,
      production_gap_id: productionGap || null,
      baseline_gap_id: baselineGap || null,
      augmented_gap_id: augmentedGap || null,
      reason: weakEvidence
        ? "Gap changed while evaluated evidence was weak."
        : "Gap changed without enough comparable context.",
    };
  }

  return {
    classification: GAP_COMPARISON_CLASSES.INSUFFICIENT_SIGNAL,
    production_gap_id: productionGap || null,
    baseline_gap_id: baselineGap || null,
    augmented_gap_id: augmentedGap || null,
    reason: "Gap comparison is not strong enough for validation.",
  };
}

function validationLineage({
  userId,
  action = {},
  outcome = {},
  candidate = {},
  evaluation = {},
  comparison = {},
  readinessRun = {},
} = {}) {
  const missing = [];
  if (!userId) missing.push("user_id");
  if (!action.action_id) missing.push("action_id");
  if (action.status !== "completed") missing.push("completed_action");
  if (!outcome.outcome_id) missing.push("outcome_id");
  if (!candidate.candidate_id) missing.push("candidate_id");
  if (!evaluation.evaluation_id) missing.push("evaluation_id");
  if (!comparison.baseline_run_id) missing.push("baseline_shadow_run_id");
  if (!comparison.augmented_run_id) missing.push("augmented_shadow_run_id");
  if (!readinessRun.run_id) missing.push("readiness_run_id");
  const brokenLinks = [];
  if (action.action_id && outcome.action_id && action.action_id !== outcome.action_id) brokenLinks.push("action_outcome");
  if (action.action_id && candidate.action_id && action.action_id !== candidate.action_id) brokenLinks.push("action_candidate");
  if (outcome.outcome_id && candidate.outcome_id && outcome.outcome_id !== candidate.outcome_id) brokenLinks.push("outcome_candidate");
  if (candidate.candidate_id && evaluation.candidate_id && candidate.candidate_id !== evaluation.candidate_id) brokenLinks.push("candidate_evaluation");
  if (evaluation.evaluation_id && comparison.evaluation_id && evaluation.evaluation_id !== comparison.evaluation_id) brokenLinks.push("evaluation_comparison");
  if (comparison.comparison_id && readinessRun.comparison_id && comparison.comparison_id !== readinessRun.comparison_id) brokenLinks.push("comparison_readiness");
  return { missing, brokenLinks, complete: missing.length === 0 && brokenLinks.length === 0 };
}

export function classifyReviewPriority({
  evaluation = {},
  comparison = {},
  readinessRun = {},
  validationHistory = [],
  config = {},
} = {}) {
  const cfg = { ...DEFAULT_REAL_USER_VALIDATION_CONFIG, ...config };
  const reasons = [];
  let classification = REVIEW_CLASSIFICATIONS.AUTO_CLEAR;
  let priority = 10;
  const failureFlags = asArray(readinessRun.failure_flags);
  const materialChange = Boolean(comparison.material_change);
  const largeConfidenceDrop = comparison.evidence_change?.confidence_direction === "decreased";
  const weakEvidence = Number(evaluation.trust || 0) < cfg.weakEvidenceTrust ||
    Number(evaluation.strength || 0) < cfg.weakEvidenceStrength;
  const marketResponse = evaluation.candidate_type === "market_response";
  const repeatedInstability = asArray(validationHistory).filter((run) =>
    run.review_classification === REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED ||
    run.alignment_class === ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE
  ).length >= 2;

  if (readinessRun.production_shadow_alignment === ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE ||
    failureFlags.includes(FAILURE_CODES.UNSAFE_DIVERGENCE)) {
    classification = REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED;
    priority = 100;
    reasons.push("unsafe_divergence");
  }
  if (failureFlags.includes(FAILURE_CODES.UNEXPLAINED_RECOMMENDATION_SWING)) {
    classification = REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED;
    priority = Math.max(priority, 95);
    reasons.push("unexplained_recommendation_swing");
  }
  if (materialChange && weakEvidence) {
    classification = REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED;
    priority = Math.max(priority, 90);
    reasons.push("weak_evidence_caused_material_change");
  }
  if (marketResponse && materialChange) {
    classification = REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED;
    priority = Math.max(priority, 88);
    reasons.push("market_signal_interpreted_as_capability_evidence");
  }
  if (comparison.reasoning_change?.conflict_changed || evaluation.status === "evaluated_conflicted") {
    if (classification === REVIEW_CLASSIFICATIONS.AUTO_CLEAR) classification = REVIEW_CLASSIFICATIONS.REVIEW_RECOMMENDED;
    priority = Math.max(priority, 70);
    reasons.push("contradiction_or_conflict_emerged");
  }
  if (largeConfidenceDrop) {
    if (classification === REVIEW_CLASSIFICATIONS.AUTO_CLEAR) classification = REVIEW_CLASSIFICATIONS.REVIEW_RECOMMENDED;
    priority = Math.max(priority, 65);
    reasons.push("large_confidence_drop");
  }
  if (repeatedInstability) {
    classification = REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED;
    priority = Math.max(priority, 92);
    reasons.push("repeated_user_level_instability");
  }
  if (readinessRun.production_shadow_alignment === ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE &&
    classification === REVIEW_CLASSIFICATIONS.AUTO_CLEAR) {
    classification = REVIEW_CLASSIFICATIONS.REVIEW_RECOMMENDED;
    priority = Math.max(priority, 55);
    reasons.push("meaningful_divergence");
  }
  if (!reasons.length) reasons.push("low_risk_aligned_run");

  return {
    review_classification: classification,
    review_priority: priority,
    review_reasons: [...new Set(reasons)].slice(0, 8),
  };
}

export function buildRealUserValidationRun({
  userId = null,
  action = {},
  outcome = {},
  candidate = {},
  evaluation = {},
  comparison = {},
  readinessRun = {},
  productionSnapshot = {},
  source = VALIDATION_SOURCE_KINDS.DEVELOPMENT_FIXTURE,
  validationHistory = [],
  createdAt = new Date().toISOString(),
  config = {},
} = {}) {
  const kind = sourceKind(source);
  const lineage = validationLineage({ userId, action, outcome, candidate, evaluation, comparison, readinessRun });
  const realAuthenticatedUser = isRealUserSource(kind) && Boolean(userId);
  const completeLearningCycle = realAuthenticatedUser && lineage.complete && !asArray(readinessRun.failure_flags).includes(FAILURE_CODES.PRIVACY_GUARD_FAILURE);
  const gapComparison = classifyGapPrioritization({ productionSnapshot, comparison, evaluation });
  const review = classifyReviewPriority({ evaluation, comparison, readinessRun, validationHistory, config });
  const reviewStatus = review.review_classification === REVIEW_CLASSIFICATIONS.AUTO_CLEAR ? "auto_clear" : "pending";
  const validationId = `real_shadow_validation_${stableHash({
    userId,
    action_id: action.action_id,
    outcome_id: outcome.outcome_id,
    candidate_id: candidate.candidate_id || evaluation.candidate_id,
    evaluation_id: evaluation.evaluation_id,
    readiness_run_id: readinessRun.run_id,
    version: REAL_SHADOW_VALIDATION_VERSION,
  })}`;

  return {
    validation_id: validationId,
    user_id: userId || candidate.user_id || evaluation.user_id || null,
    source_kind: kind,
    is_real_user: realAuthenticatedUser,
    complete_learning_cycle: completeLearningCycle,
    validation_status: completeLearningCycle ? "complete" : "partial",
    incomplete_reasons: realAuthenticatedUser ? [...lineage.missing, ...lineage.brokenLinks] : ["not_real_user", ...lineage.missing, ...lineage.brokenLinks],
    action_id: action.action_id || candidate.action_id || null,
    outcome_id: outcome.outcome_id || candidate.outcome_id || null,
    candidate_id: candidate.candidate_id || evaluation.candidate_id || null,
    evaluation_id: evaluation.evaluation_id || null,
    baseline_shadow_run_id: comparison.baseline_run_id || null,
    augmented_shadow_run_id: comparison.augmented_run_id || null,
    readiness_run_id: readinessRun.run_id || null,
    evidence_usable: Boolean(evaluation.usable_for_shadow),
    material_change: Boolean(comparison.material_change),
    alignment_class: readinessRun.production_shadow_alignment || ALIGNMENT_CLASSES.INSUFFICIENT_SIGNAL,
    divergence_reason: asArray(readinessRun.explanation)[0] || asArray(readinessRun.failure_flags)[0] || "none",
    candidate_type: evaluation.candidate_type || candidate.candidate_type || null,
    recommendation_changed: Boolean(comparison.reasoning_change?.recommendation_changed),
    gap_changed: Boolean(comparison.reasoning_change?.gap_changed),
    conflict_changed: Boolean(comparison.reasoning_change?.conflict_changed),
    confidence_direction: comparison.evidence_change?.confidence_direction || "unknown",
    failure_flags: asArray(readinessRun.failure_flags),
    safety_flags: asArray(readinessRun.safety_flags),
    gap_comparison: gapComparison,
    review_classification: review.review_classification,
    review_priority: review.review_priority,
    review_reasons: review.review_reasons,
    review_status: reviewStatus,
    created_at: createdAt,
    reviewed_at: null,
    future_outcome_validation: {
      can_attach_followup_outcome: completeLearningCycle,
      validation_target: readinessRun.validation_hooks?.validation_target || "gap_direction",
      followup_outcome_ids: [],
    },
    versions: {
      validation: REAL_SHADOW_VALIDATION_VERSION,
      evaluator: evaluation.evaluator_version || null,
      readiness: readinessRun.evaluator_version || null,
      comparison: comparison.comparison_version || null,
    },
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

export function upsertValidationRun(validationRuns = [], validationRun = null) {
  return upsertById(validationRuns, validationRun, "validation_id");
}

export function buildHumanReview({
  validationId,
  judgment,
  reviewer = "founder_internal",
  tags = [],
  notes = "",
  reviewedAt = new Date().toISOString(),
} = {}) {
  if (!validationId) throw new Error("validation_id is required");
  if (!Object.values(REVIEW_JUDGMENTS).includes(judgment)) throw new Error("Invalid review judgment");
  return {
    review_id: `shadow_review_${stableHash({ validationId, reviewer })}`,
    validation_id: validationId,
    judgment,
    status: "reviewed",
    reviewed_at: reviewedAt,
    reviewer_role: String(reviewer || "founder_internal").slice(0, 80),
    tags: asArray(tags).map((tag) => String(tag).slice(0, 80)).slice(0, 8),
    notes: String(notes || "").replace(/\s+/g, " ").trim().slice(0, 180),
    version: REAL_SHADOW_VALIDATION_VERSION,
  };
}

export function upsertHumanReview(shadowLearning = {}, reviewInput = {}) {
  const source = shadowLearning && typeof shadowLearning === "object" ? shadowLearning : {};
  const review = buildHumanReview(reviewInput);
  const humanReviews = upsertById(source.human_reviews, review, "review_id");
  const validationRuns = asArray(source.validation_runs).map((run) =>
    run.validation_id === review.validation_id
      ? {
          ...run,
          review_status: "reviewed",
          reviewed_at: review.reviewed_at,
          review_judgment: review.judgment,
        }
      : run
  );
  return {
    ...source,
    validation_runs: validationRuns,
    human_reviews: humanReviews,
    real_user_validation_summary: calculateRealUserValidationAggregate({
      ...source,
      validation_runs: validationRuns,
      human_reviews: humanReviews,
    }),
  };
}

function reviewedDivergentRuns(validationRuns, reviews) {
  const divergentIds = new Set(asArray(validationRuns)
    .filter((run) => [
      ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE,
      ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE,
    ].includes(run.alignment_class))
    .map((run) => run.validation_id));
  return asArray(reviews).filter((review) => divergentIds.has(review.validation_id));
}

function classifyCohortState({ completeRuns, reviews, unsafeRate, privacyRate, config }) {
  const cfg = { ...DEFAULT_REAL_USER_VALIDATION_CONFIG, ...config };
  if (completeRuns.length < cfg.minimumCompleteRealCycles) return REAL_USER_COHORT_STATES.INSUFFICIENT_REAL_DATA;
  const reviewedDivergent = reviewedDivergentRuns(completeRuns, reviews);
  if (!reviewedDivergent.length) return REAL_USER_COHORT_STATES.EARLY_SIGNAL;
  if (unsafeRate && unsafeRate > 0) return REAL_USER_COHORT_STATES.VALIDATION_IN_PROGRESS;
  if (privacyRate && privacyRate > 0) return REAL_USER_COHORT_STATES.VALIDATION_IN_PROGRESS;
  const unresolvedThresholds = [
    cfg.minimumReviewedDivergentRuns,
    cfg.maximumUnsafeDivergenceRate,
    cfg.minimumShadowReviewAgreementRate,
  ].some((value) => String(value || "").includes("TBD_AFTER_BETA_DATA"));
  return unresolvedThresholds
    ? REAL_USER_COHORT_STATES.VALIDATION_IN_PROGRESS
    : REAL_USER_COHORT_STATES.EXPERIMENT_CANDIDATE;
}

export function calculateRealUserValidationAggregate(shadowLearning = {}, config = {}) {
  const runs = asArray(shadowLearning.validation_runs);
  const reviews = asArray(shadowLearning.human_reviews);
  const realRuns = runs.filter((run) => run.source_kind === VALIDATION_SOURCE_KINDS.REAL_BETA_USER && run.is_real_user);
  const evaluatedRuns = realRuns.filter((run) => run.evaluation_id);
  const completeRuns = realRuns.filter((run) => run.complete_learning_cycle);
  const usableRuns = completeRuns.filter((run) => run.evidence_usable);
  const materialRuns = usableRuns.filter((run) => run.material_change);
  const alignedRuns = completeRuns.filter((run) => [
    ALIGNMENT_CLASSES.ALIGNED,
    ALIGNMENT_CLASSES.PARTIALLY_ALIGNED,
  ].includes(run.alignment_class));
  const meaningfulRuns = completeRuns.filter((run) => run.alignment_class === ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE);
  const unsafeRuns = completeRuns.filter((run) => run.alignment_class === ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE);
  const failedRuns = realRuns.filter((run) => run.validation_status === "shadow_failed" || asArray(run.failure_flags).length);
  const privacyRuns = completeRuns.filter((run) => asArray(run.failure_flags).includes(FAILURE_CODES.PRIVACY_GUARD_FAILURE));
  const reviewedDivergent = reviewedDivergentRuns(completeRuns, reviews);
  const shadowCorrectReviews = reviewedDivergent.filter((review) => review.judgment === REVIEW_JUDGMENTS.SHADOW_DIRECTIONALLY_CORRECT);
  const unsafeRate = rate(unsafeRuns.length, completeRuns.length);
  const privacyRate = rate(privacyRuns.length, completeRuns.length);
  return {
    real_user_count: uniqueCount(completeRuns.map((run) => run.user_id)),
    complete_learning_cycles: completeRuns.length,
    evaluated_real_user_candidates: evaluatedRuns.length,
    evidence_usability_rate: rate(usableRuns.length, evaluatedRuns.length),
    material_change_rate: rate(materialRuns.length, usableRuns.length),
    production_shadow_alignment_rate: rate(alignedRuns.length, completeRuns.length),
    meaningful_divergence_rate: rate(meaningfulRuns.length, completeRuns.length),
    unsafe_divergence_rate: unsafeRate,
    review_agreement_rate: rate(shadowCorrectReviews.length, reviewedDivergent.length),
    shadow_failure_rate: rate(failedRuns.length, realRuns.length),
    privacy_safety_failure_rate: privacyRate,
    reviewed_divergent_run_count: reviewedDivergent.length,
    review_required_count: completeRuns.filter((run) => run.review_classification === REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED).length,
    gap_prioritization: {
      same: completeRuns.filter((run) => run.gap_comparison?.classification === GAP_COMPARISON_CLASSES.SAME).length,
      semantically_similar: completeRuns.filter((run) => run.gap_comparison?.classification === GAP_COMPARISON_CLASSES.SEMANTICALLY_SIMILAR).length,
      changed_due_to_usable_evidence: completeRuns.filter((run) => run.gap_comparison?.classification === GAP_COMPARISON_CLASSES.CHANGED_DUE_TO_USABLE_EVIDENCE).length,
      changed_unexpectedly: completeRuns.filter((run) => run.gap_comparison?.classification === GAP_COMPARISON_CLASSES.CHANGED_UNEXPECTEDLY).length,
      insufficient_signal: completeRuns.filter((run) => run.gap_comparison?.classification === GAP_COMPARISON_CLASSES.INSUFFICIENT_SIGNAL).length,
    },
    cohort_state: classifyCohortState({ completeRuns, reviews, unsafeRate, privacyRate, config }),
    minimum_complete_real_cycles: DEFAULT_REAL_USER_VALIDATION_CONFIG.minimumCompleteRealCycles,
    excludes_synthetic: true,
    version: REAL_SHADOW_VALIDATION_VERSION,
  };
}

export function buildInternalReviewQueue(shadowLearning = {}) {
  return asArray(shadowLearning.validation_runs)
    .filter((run) => run.review_status === "pending")
    .sort((a, b) => Number(b.review_priority || 0) - Number(a.review_priority || 0))
    .map((run) => ({
      validation_id: run.validation_id,
      safe_user_id: run.user_id ? `user_${stableHash(run.user_id)}` : null,
      candidate_id: run.candidate_id,
      candidate_type: run.candidate_type || "unknown",
      evidence_usable: run.evidence_usable,
      material_change: run.material_change,
      alignment_class: run.alignment_class,
      divergence_reason: run.divergence_reason,
      review_classification: run.review_classification,
      review_priority: run.review_priority,
      review_reasons: run.review_reasons,
      production: run.gap_comparison?.production_gap_id || null,
      baseline_shadow: run.gap_comparison?.baseline_gap_id || null,
      augmented_shadow: run.gap_comparison?.augmented_gap_id || null,
      explanation: run.divergence_reason,
      safety_flags: asArray(run.failure_flags),
    }));
}
