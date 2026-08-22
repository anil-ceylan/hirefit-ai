import { evaluateEvidence } from "../careerIntelligence/evidence/evaluateEvidence.js";
import { SOURCE_TYPES, clampScore } from "../careerIntelligence/evidence/evidenceTypes.js";
import { observeDecisionRun } from "../careerIntelligence/observatory/decisionObservatory.js";
import { stableHash } from "../careerIntelligence/observatory/utils.js";
import { normalizeDecisionLoop } from "./actionModel.js";
import {
  buildPromotionReadinessRun,
  calculatePromotionReadinessAggregate,
} from "./promotionReadiness.js";
import {
  VALIDATION_SOURCE_KINDS,
  buildRealUserValidationRun,
  calculateRealUserValidationAggregate,
  upsertValidationRun,
} from "./realUserShadowValidation.js";
import {
  buildGapEvaluation,
  calculateGapPrioritizationMetrics,
  upsertGapEvaluation,
} from "./gapPrioritizationEvaluation.js";

export const ACTION_EVIDENCE_EVALUATOR_VERSION = "career-action-evidence-evaluator.v1";
export const ACTION_SHADOW_LEARNING_VERSION = "career-action-shadow-learning.v1";

const MARKET_RESPONSE_TYPES = new Set(["INTERVIEW", "OFFER", "REJECTION", "EXTERNAL_RESPONSE"]);
const MATERIAL_DELTA = 8;

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function compact(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function normalizedId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildEvaluationId(candidate = {}) {
  return `eval_${stableHash({
    candidate_id: candidate.candidate_id,
    updated_at: candidate.updated_at,
    claim: candidate.claim,
    measurable_result: candidate.measurable_result,
    proof_reference: candidate.proof_reference,
    evaluation_version: ACTION_EVIDENCE_EVALUATOR_VERSION,
  })}`;
}

function candidateVersion(candidate = {}) {
  return stableHash({
    candidate_id: candidate.candidate_id,
    updated_at: candidate.updated_at,
    claim: candidate.claim,
    measurable_result: candidate.measurable_result,
    proof_reference: candidate.proof_reference,
  });
}

export function candidateToEvidenceItem(candidate = {}, { outcome = {}, action = {} } = {}) {
  const isMarketResponse = MARKET_RESPONSE_TYPES.has(outcome.outcome_type || candidate.provenance?.outcome_type);
  const target = compact(candidate.target_dimension || action.target_dimension || action.blocker || action.title, 140);
  const title = isMarketResponse
    ? compact(`Market response: ${outcome.outcome_type || candidate.provenance?.outcome_type || candidate.candidate_type}`, 120)
    : compact(target || candidate.candidate_type || "Evidence candidate", 120);
  const metric = compact(candidate.measurable_result, 160);
  const description = compact([candidate.claim, metric ? `Measured result: ${metric}` : ""].filter(Boolean).join(" "), 320);
  return {
    id: `ev_${candidate.candidate_id}`,
    type: isMarketResponse ? "market_response_evidence_candidate" : "action_outcome_evidence_candidate",
    title,
    description: description || title,
    source: `evidence_candidate:${candidate.candidate_id}`,
    source_type: candidate.source_type || SOURCE_TYPES.USER_STATEMENT,
    created_at: candidate.created_at || outcome.captured_at || "",
    occurred_at: outcome.occurred_at || outcome.captured_at || candidate.updated_at || "",
    role_context: target,
    skills: isMarketResponse ? ["market_response"] : [],
    domains: isMarketResponse ? ["application_outcome"] : [],
    metrics: metric ? [metric] : [],
    ownership_level: "",
    confidence: null,
    contradictions: asArray(candidate.contradictions),
    missing_fields: asArray(candidate.missing_fields),
    metadata: {
      candidate_id: candidate.candidate_id,
      action_id: candidate.action_id,
      outcome_id: candidate.outcome_id,
      candidate_type: candidate.candidate_type,
      verification_status: "not_verified",
      support_level: candidate.proof_reference || candidate.measurable_result ? "supported" : "structured",
      market_response: isMarketResponse,
    },
  };
}

function trustScore(evaluated = {}) {
  const factors = evaluated.quality_breakdown?.factors || {};
  const credibility = Number(factors.credibility);
  const source = Number(factors.source_quality);
  if (Number.isFinite(credibility) && Number.isFinite(source)) return clampScore((credibility + source) / 2);
  if (Number.isFinite(credibility)) return clampScore(credibility);
  if (Number.isFinite(source)) return clampScore(source);
  return 0;
}

function evaluationStatus({ candidate, evaluated }) {
  if (!candidate || candidate.evaluation_status === "ineligible") return "evaluated_insufficient";
  if (asArray(evaluated.contradictions).length) return "evaluated_conflicted";
  if (evaluated.normalized_weight >= 55 || candidate.preliminary_strength === "supported") return "evaluated_usable";
  if (evaluated.normalized_weight >= 38) return "evaluated_weak";
  return "evaluated_insufficient";
}

export function evaluateEvidenceCandidate({
  candidate,
  action = {},
  outcome = {},
  now = new Date().toISOString(),
} = {}) {
  if (!candidate?.candidate_id) {
    return {
      evaluation: null,
      usableForShadow: false,
      reason: "missing_candidate",
    };
  }
  const evidenceItem = candidateToEvidenceItem(candidate, { action, outcome });
  const evaluated = evaluateEvidence(evidenceItem, {
    roleContext: evidenceItem.role_context,
    now: new Date(now),
  });
  const status = evaluationStatus({ candidate, evaluated });
  const usableForShadow = status === "evaluated_usable" || status === "evaluated_conflicted";
  const evaluation = {
    evaluation_id: buildEvaluationId(candidate),
    candidate_id: candidate.candidate_id,
    candidate_version: candidateVersion(candidate),
    user_id: candidate.user_id,
    action_id: candidate.action_id,
    outcome_id: candidate.outcome_id,
    status,
    evidence_type: evidenceItem.type,
    candidate_type: candidate.candidate_type,
    strength: clampScore(evaluated.normalized_weight),
    trust: trustScore(evaluated),
    confidence: clampScore(evaluated.confidence == null ? evaluated.normalized_weight : evaluated.confidence),
    quality_breakdown: evaluated.quality_breakdown,
    missing_fields: asArray(evaluated.missing_fields),
    contradictions: asArray(evaluated.contradictions),
    usable_for_shadow: usableForShadow,
    verification_status: "not_verified",
    support_level: evidenceItem.metadata.support_level,
    evaluated_at: now,
    evaluator_version: ACTION_EVIDENCE_EVALUATOR_VERSION,
    evidence_model_version: "evidence.v1",
  };
  return {
    evaluation,
    evaluatedEvidenceItem: evaluated,
    shadowEvidenceItem: evidenceItem,
    usableForShadow,
    reason: status,
  };
}

export function buildShadowAugmentedProfile(profile = {}, evaluationResult = {}) {
  const item = evaluationResult.shadowEvidenceItem;
  if (!item || !evaluationResult.evaluation?.usable_for_shadow) return cloneJson(profile);
  const clone = cloneJson(profile);
  clone.shadow_evidence_items = [
    ...asArray(clone.shadow_evidence_items),
    {
      ...item,
      metadata: {
        ...(item.metadata || {}),
        shadow_only: true,
        evaluator_version: ACTION_EVIDENCE_EVALUATOR_VERSION,
      },
    },
  ];
  clone._shadow_augmented_evidence_ids = [
    ...asArray(clone._shadow_augmented_evidence_ids),
    item.id,
  ];
  return clone;
}

function extractMissingGap(reasoning = {}) {
  const missing = reasoning.missingEvidence || {};
  return missing.primaryMissingEvidence?.competency ||
    missing.primaryMissingEvidence?.id ||
    missing.missingCompetencies?.[0]?.competency ||
    missing.missingCompetencies?.[0]?.id ||
    missing.gaps?.[0]?.competency ||
    null;
}

function extractTopHypothesis(reasoning = {}) {
  return asArray(reasoning.hypotheses)
    .slice()
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0] || null;
}

function extractRunSummary(run = {}) {
  const reasoning = run.shadowResult?.reasoning || {};
  const intelligence = reasoning.evidenceIntelligence || {};
  const top = reasoning.topRecommendation || reasoning.recommendations?.[0] || null;
  const topHypothesis = extractTopHypothesis(reasoning);
  return {
    run_id: run.runId || null,
    evidence_count: run.shadowResult?.inputSummary?.evidenceCount ?? intelligence.evidenceObjects?.length ?? null,
    evidence_quality: intelligence.quality?.evidenceQualityScore ?? null,
    coverage_score: intelligence.coverage?.coverageScore ?? null,
    top_recommendation_id: top?.id || normalizedId(top?.label),
    top_recommendation_label: top?.label || null,
    decision_confidence: top?.decisionConfidence ?? null,
    strongest_gap: extractMissingGap(reasoning),
    conflict_count: asArray(reasoning.conflicts?.items || reasoning.conflicts).length,
    top_hypothesis: topHypothesis?.competency || topHypothesis?.id || null,
    top_hypothesis_confidence: topHypothesis?.confidence ?? null,
  };
}

function direction(before, after, threshold = MATERIAL_DELTA) {
  const b = Number(before);
  const a = Number(after);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return "unknown";
  if (a - b >= threshold) return "increased";
  if (b - a >= threshold) return "decreased";
  return "flat";
}

export function classifyShadowLearningChange({
  candidateId,
  evaluation = {},
  baselineRun = {},
  augmentedRun = {},
} = {}) {
  const baseline = extractRunSummary(baselineRun);
  const augmented = extractRunSummary(augmentedRun);
  const recommendationChanged = Boolean(
    baseline.top_recommendation_id &&
    augmented.top_recommendation_id &&
    baseline.top_recommendation_id !== augmented.top_recommendation_id
  );
  const gapChanged = Boolean(
    baseline.strongest_gap &&
    augmented.strongest_gap &&
    baseline.strongest_gap !== augmented.strongest_gap
  );
  const conflictChanged = Number(baseline.conflict_count || 0) !== Number(augmented.conflict_count || 0);
  const hypothesisChanged = Boolean(
    baseline.top_hypothesis &&
    augmented.top_hypothesis &&
    baseline.top_hypothesis !== augmented.top_hypothesis
  );
  const confidenceDirection = direction(baseline.decision_confidence, augmented.decision_confidence);
  const qualityDirection = direction(baseline.evidence_quality, augmented.evidence_quality);
  const coverageDirection = direction(baseline.coverage_score, augmented.coverage_score);
  const meaningfulUncertainty = confidenceDirection === "decreased" || conflictChanged || evaluation.status === "evaluated_conflicted";
  const materialChange =
    recommendationChanged ||
    gapChanged ||
    conflictChanged ||
    hypothesisChanged ||
    meaningfulUncertainty ||
    coverageDirection !== "flat";

  return {
    comparison_id: `shadow_cmp_${stableHash({
      candidateId,
      baselineRunId: baseline.run_id,
      augmentedRunId: augmented.run_id,
      evaluatorVersion: ACTION_SHADOW_LEARNING_VERSION,
    })}`,
    candidate_id: candidateId || evaluation.candidate_id || null,
    evaluation_id: evaluation.evaluation_id || null,
    baseline_run_id: baseline.run_id,
    augmented_run_id: augmented.run_id,
    evidence_change: {
      coverage_changed: coverageDirection !== "flat",
      quality_changed: qualityDirection !== "flat",
      confidence_changed: confidenceDirection !== "flat",
      coverage_direction: coverageDirection,
      quality_direction: qualityDirection,
      confidence_direction: confidenceDirection,
    },
    reasoning_change: {
      gap_changed: gapChanged,
      hypothesis_changed: hypothesisChanged,
      recommendation_changed: recommendationChanged,
      conflict_changed: conflictChanged,
      uncertainty_changed: meaningfulUncertainty,
    },
    material_change: materialChange,
    safety_flags: asArray(augmentedRun.warnings).map((warning) => warning.code || warning).slice(0, 8),
    baseline,
    augmented,
    compared_at: new Date().toISOString(),
    comparison_version: ACTION_SHADOW_LEARNING_VERSION,
  };
}

export function normalizeShadowLearning(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    evaluations: asArray(source.evaluations),
    comparisons: asArray(source.comparisons),
    readiness_runs: asArray(source.readiness_runs),
    validation_runs: asArray(source.validation_runs),
    human_reviews: asArray(source.human_reviews),
    gap_evaluations: asArray(source.gap_evaluations),
    gap_human_reviews: asArray(source.gap_human_reviews),
    failures: asArray(source.failures),
    metrics: source.metrics || {},
    aggregate_summary: source.aggregate_summary || {},
    real_user_validation_summary: source.real_user_validation_summary || {},
    gap_prioritization_summary: source.gap_prioritization_summary || {},
    last_evaluated_at: source.last_evaluated_at || null,
  };
}

export function calculateShadowLearningMetrics(shadowLearning = {}) {
  const learning = normalizeShadowLearning(shadowLearning);
  const activeEvaluations = learning.evaluations.filter((item) => item.status !== "superseded");
  const evaluated = activeEvaluations.filter((item) => /^evaluated_/.test(item.status || ""));
  const usable = evaluated.filter((item) => item.usable_for_shadow);
  const comparisons = learning.comparisons.filter((item) => item.comparison_version === ACTION_SHADOW_LEARNING_VERSION);
  const material = comparisons.filter((item) => item.material_change);
  const recommendationChanged = comparisons.filter((item) => item.reasoning_change?.recommendation_changed);
  const gapChanged = comparisons.filter((item) => item.reasoning_change?.gap_changed);
  const failures = learning.failures.filter((item) => item.version === ACTION_SHADOW_LEARNING_VERSION);
  return {
    evaluated_candidate_count: evaluated.length,
    usable_candidate_count: usable.length,
    evidence_usability_rate: evaluated.length ? usable.length / evaluated.length : null,
    shadow_learning_activation_rate: usable.length ? material.length / usable.length : null,
    recommendation_change_rate: usable.length ? recommendationChanged.length / usable.length : null,
    gap_movement_rate: usable.length ? gapChanged.length / usable.length : null,
    shadow_failure_rate: evaluated.length + failures.length ? failures.length / (evaluated.length + failures.length) : null,
  };
}

function upsertEvaluation(evaluations, evaluation) {
  const next = evaluations.map((item) =>
    item.candidate_id === evaluation.candidate_id && item.evaluation_id !== evaluation.evaluation_id
      ? { ...item, status: "superseded", superseded_at: evaluation.evaluated_at }
      : item
  );
  const index = next.findIndex((item) => item.evaluation_id === evaluation.evaluation_id);
  if (index >= 0) next[index] = evaluation;
  else next.unshift(evaluation);
  return next.slice(0, 30);
}

function upsertComparison(comparisons, comparison) {
  if (!comparison?.comparison_id) return comparisons;
  const index = comparisons.findIndex((item) => item.comparison_id === comparison.comparison_id);
  const next = [...comparisons];
  if (index >= 0) next[index] = comparison;
  else next.unshift(comparison);
  return next.slice(0, 30);
}

function upsertReadinessRun(readinessRuns, readinessRun) {
  if (!readinessRun?.run_id) return readinessRuns;
  const index = readinessRuns.findIndex((item) => item.run_id === readinessRun.run_id);
  const next = [...readinessRuns];
  if (index >= 0) next[index] = readinessRun;
  else next.unshift(readinessRun);
  return next.slice(0, 30);
}

function updateCandidateEvaluationStatus(candidates, evaluation) {
  return candidates.map((candidate) =>
    candidate.candidate_id === evaluation.candidate_id
      ? {
          ...candidate,
          evaluation_status: evaluation.status,
          last_evaluation_id: evaluation.evaluation_id,
          last_evaluated_at: evaluation.evaluated_at,
        }
      : candidate
  );
}

function withShadowLearning(careerGps, { evaluation, comparison = null, readinessRun = null, validationRun = null, gapEvaluation = null, failure = null }) {
  const loop = normalizeDecisionLoop(careerGps);
  const learning = normalizeShadowLearning(loop.shadow_learning);
  const evaluations = evaluation ? upsertEvaluation(learning.evaluations, evaluation) : learning.evaluations;
  const comparisons = comparison ? upsertComparison(learning.comparisons, comparison) : learning.comparisons;
  const readiness_runs = readinessRun ? upsertReadinessRun(learning.readiness_runs, readinessRun) : learning.readiness_runs;
  const validation_runs = validationRun ? upsertValidationRun(learning.validation_runs, validationRun) : learning.validation_runs;
  const human_reviews = learning.human_reviews;
  const gap_evaluations = gapEvaluation ? upsertGapEvaluation(learning.gap_evaluations, gapEvaluation) : learning.gap_evaluations;
  const gap_human_reviews = learning.gap_human_reviews;
  const failures = failure ? [failure, ...learning.failures].slice(0, 30) : learning.failures;
  const shadow_learning = {
    evaluations,
    comparisons,
    readiness_runs,
    validation_runs,
    human_reviews,
    gap_evaluations,
    gap_human_reviews,
    failures,
    metrics: calculateShadowLearningMetrics({ evaluations, comparisons, failures }),
    aggregate_summary: calculatePromotionReadinessAggregate({ readiness_runs, failures }),
    real_user_validation_summary: calculateRealUserValidationAggregate({ validation_runs, human_reviews, failures }),
    gap_prioritization_summary: calculateGapPrioritizationMetrics({ gap_evaluations, gap_human_reviews, failures }),
    last_evaluated_at: evaluation?.evaluated_at || learning.last_evaluated_at,
  };
  return {
    ...(careerGps || {}),
    decision_loop: {
      ...loop,
      evidence_candidates: evaluation ? updateCandidateEvaluationStatus(loop.evidence_candidates, evaluation) : loop.evidence_candidates,
      shadow_learning,
      last_updated_at: evaluation?.evaluated_at || loop.last_updated_at,
    },
  };
}

export function runEvidenceCandidateShadowLearning({
  careerGps = {},
  profile = {},
  candidate = null,
  action = {},
  outcome = {},
  productionSnapshot = null,
  historicalSnapshots = [],
  now = new Date().toISOString(),
  evaluator = evaluateEvidenceCandidate,
  observatoryRunner = observeDecisionRun,
  featureFlags = {},
  config = {},
  realUserRunCount = 0,
  syntheticOnly = false,
  validationSource = VALIDATION_SOURCE_KINDS.DEVELOPMENT_FIXTURE,
  privacyPassed = true,
  stability = {},
} = {}) {
  if (!candidate?.candidate_id) {
    return {
      attempted: false,
      career_gps: careerGps || {},
      evaluation: null,
      comparison: null,
      warnings: [{ code: "NO_CANDIDATE_TO_EVALUATE" }],
    };
  }
  if (action?.user_id && candidate.user_id && action.user_id !== candidate.user_id) {
    return {
      attempted: false,
      ownershipMismatch: true,
      career_gps: careerGps || {},
      evaluation: null,
      comparison: null,
      warnings: [{ code: "CANDIDATE_OWNERSHIP_MISMATCH" }],
    };
  }
  let evaluationResult;
  try {
    evaluationResult = evaluator({ candidate, action, outcome, now });
  } catch (error) {
    const failure = {
      failure_id: `shadow_failure_${stableHash({ candidate_id: candidate.candidate_id, stage: "evaluation", now })}`,
      candidate_id: candidate.candidate_id,
      stage: "evaluation",
      message: "Candidate evaluation failed closed.",
      version: ACTION_SHADOW_LEARNING_VERSION,
      occurred_at: now,
      error_code: error?.code || "EVALUATION_FAILED",
    };
    const validationRun = {
      ...buildRealUserValidationRun({
        userId: candidate.user_id,
        action,
        outcome,
        candidate,
        evaluation: {},
        comparison: {},
        readinessRun: {},
        productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
        source: syntheticOnly ? VALIDATION_SOURCE_KINDS.SYNTHETIC : validationSource,
        validationHistory: normalizeShadowLearning(careerGps?.decision_loop?.shadow_learning).validation_runs,
        createdAt: now,
        config: config.realUserValidation || {},
      }),
      validation_status: "evaluation_failed",
      failure_flags: ["EVIDENCE_EVALUATION_FAILURE"],
      review_classification: "REVIEW_REQUIRED",
      review_priority: 100,
      review_reasons: ["evidence_evaluation_failure"],
    };
    return {
      attempted: true,
      failed: true,
      failureStage: "evaluation",
      failure,
      career_gps: withShadowLearning(careerGps, { validationRun, failure }),
      evaluation: null,
      comparison: null,
      realUserValidation: validationRun,
      warnings: [failure],
    };
  }

  const evaluation = evaluationResult.evaluation;
  let nextCareerGps = withShadowLearning(careerGps, { evaluation });
  if (!evaluation?.usable_for_shadow) {
    const validationRun = buildRealUserValidationRun({
      userId: candidate.user_id,
      action,
      outcome,
      candidate,
      evaluation: evaluation || {},
      comparison: {},
      readinessRun: {},
      productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
      source: syntheticOnly ? VALIDATION_SOURCE_KINDS.SYNTHETIC : validationSource,
      validationHistory: normalizeShadowLearning(nextCareerGps?.decision_loop?.shadow_learning).validation_runs,
      createdAt: now,
      config: config.realUserValidation || {},
    });
    nextCareerGps = withShadowLearning(nextCareerGps, { evaluation, validationRun });
    return {
      attempted: true,
      failed: false,
      career_gps: nextCareerGps,
      evaluation,
      comparison: null,
      realUserValidation: validationRun,
      shadowAttempted: false,
      warnings: [],
    };
  }

  try {
    const safeFlags = {
      ENABLE_SHADOW_REASONING: true,
      ENABLE_SHADOW_LOGGING: false,
      ENABLE_DECISION_OBSERVATORY: false,
      ENABLE_INTERNAL_REASONING_INSPECTOR: false,
      ENABLE_DRIFT_ANALYSIS: true,
      ENABLE_PROMOTION_GATE_EVALUATION: true,
      ...featureFlags,
    };
    const baselineRun = observatoryRunner({
      profile,
      productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
      historicalSnapshots,
      featureFlags: safeFlags,
      config,
      generatedAt: now,
    });
    const augmentedRun = observatoryRunner({
      profile: buildShadowAugmentedProfile(profile, evaluationResult),
      productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
      historicalSnapshots,
      featureFlags: safeFlags,
      config,
      generatedAt: now,
    });
    const comparison = classifyShadowLearningChange({
      candidateId: candidate.candidate_id,
      evaluation,
      baselineRun,
      augmentedRun,
    });
    const readinessRun = buildPromotionReadinessRun({
      userId: candidate.user_id,
      candidate,
      evaluation,
      comparison,
      productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
      realUserRunCount,
      syntheticOnly,
      privacyPassed,
      stability,
      evaluatedAt: now,
      config: config.promotionReadiness || {},
    });
    const validationRun = buildRealUserValidationRun({
      userId: candidate.user_id,
      action,
      outcome,
      candidate,
      evaluation,
      comparison,
      readinessRun,
      productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
      source: syntheticOnly ? VALIDATION_SOURCE_KINDS.SYNTHETIC : validationSource,
      validationHistory: normalizeShadowLearning(nextCareerGps?.decision_loop?.shadow_learning).validation_runs,
      createdAt: now,
      config: config.realUserValidation || {},
    });
    const gapEvaluation = buildGapEvaluation({
      validationRun,
      evaluation,
      comparison,
      productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
      createdAt: now,
    });
    nextCareerGps = withShadowLearning(nextCareerGps, { evaluation, comparison, readinessRun, validationRun, gapEvaluation });
    return {
      attempted: true,
      failed: false,
      career_gps: nextCareerGps,
      evaluation,
      comparison,
      promotionReadiness: readinessRun,
      realUserValidation: validationRun,
      gapEvaluation,
      baselineRunId: baselineRun.runId,
      augmentedRunId: augmentedRun.runId,
      shadowAttempted: true,
      warnings: [...asArray(baselineRun.warnings), ...asArray(augmentedRun.warnings)].slice(0, 8),
    };
  } catch (error) {
    const failure = {
      failure_id: `shadow_failure_${stableHash({ candidate_id: candidate.candidate_id, stage: "shadow_reasoning", now })}`,
      candidate_id: candidate.candidate_id,
      evaluation_id: evaluation.evaluation_id,
      stage: "shadow_reasoning",
      message: "Shadow reasoning failed closed.",
      version: ACTION_SHADOW_LEARNING_VERSION,
      occurred_at: now,
      error_code: error?.code || "SHADOW_REASONING_FAILED",
    };
    const validationRun = {
      ...buildRealUserValidationRun({
        userId: candidate.user_id,
        action,
        outcome,
        candidate,
        evaluation,
        comparison: {},
        readinessRun: {},
        productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
        source: syntheticOnly ? VALIDATION_SOURCE_KINDS.SYNTHETIC : validationSource,
        validationHistory: normalizeShadowLearning(nextCareerGps?.decision_loop?.shadow_learning).validation_runs,
        createdAt: now,
        config: config.realUserValidation || {},
      }),
      validation_status: "shadow_failed",
      failure_flags: ["SHADOW_REASONING_FAILURE"],
      review_classification: "REVIEW_REQUIRED",
      review_priority: 100,
      review_reasons: ["shadow_reasoning_failure"],
    };
    return {
      attempted: true,
      failed: true,
      failureStage: "shadow_reasoning",
      failure,
      career_gps: withShadowLearning(nextCareerGps, { evaluation, validationRun, failure }),
      evaluation,
      comparison: null,
      realUserValidation: validationRun,
      shadowAttempted: true,
      warnings: [failure],
    };
  }
}
