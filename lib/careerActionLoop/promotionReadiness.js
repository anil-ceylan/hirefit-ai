import { stableHash } from "../careerIntelligence/observatory/utils.js";

export const PROMOTION_READINESS_VERSION = "shadow-promotion-readiness.v1";

export const ALIGNMENT_CLASSES = Object.freeze({
  ALIGNED: "ALIGNED",
  PARTIALLY_ALIGNED: "PARTIALLY_ALIGNED",
  MEANINGFUL_DIVERGENCE: "MEANINGFUL_DIVERGENCE",
  UNSAFE_DIVERGENCE: "UNSAFE_DIVERGENCE",
  INSUFFICIENT_SIGNAL: "INSUFFICIENT_SIGNAL",
});

export const READINESS_CATEGORIES = Object.freeze({
  NOT_READY: "NOT_READY",
  OBSERVE_MORE: "OBSERVE_MORE",
  LIMITED_EXPERIMENT_READY: "LIMITED_EXPERIMENT_READY",
  CONTROLLED_PROMOTION_READY: "CONTROLLED_PROMOTION_READY",
});

export const FAILURE_CODES = Object.freeze({
  EVIDENCE_EVALUATION_FAILURE: "EVIDENCE_EVALUATION_FAILURE",
  SHADOW_REASONING_FAILURE: "SHADOW_REASONING_FAILURE",
  OBSERVATORY_FAILURE: "OBSERVATORY_FAILURE",
  UNSAFE_DIVERGENCE: "UNSAFE_DIVERGENCE",
  UNEXPLAINED_RECOMMENDATION_SWING: "UNEXPLAINED_RECOMMENDATION_SWING",
  REDUNDANCY_INFLATION: "REDUNDANCY_INFLATION",
  CONTRADICTION_MISSED: "CONTRADICTION_MISSED",
  PRIVACY_GUARD_FAILURE: "PRIVACY_GUARD_FAILURE",
  PRODUCTION_REGRESSION: "PRODUCTION_REGRESSION",
});

export const DEFAULT_PROMOTION_READINESS_CONFIG = Object.freeze({
  minimumRealUserRuns: 30,
  maxUnsafeDivergenceRate: "TBD_AFTER_BETA_DATA",
  maxFailureRate: "TBD_AFTER_BETA_DATA",
  maxNoiseInstabilityRate: "TBD_AFTER_BETA_DATA",
  minTraceCompleteness: "TBD_AFTER_BETA_DATA",
  minEvidenceUsabilityRate: "TBD_AFTER_BETA_DATA",
  materialConfidenceDelta: 8,
});

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function compact(value, max = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
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

function productionTopRoleId(productionSnapshot = {}) {
  const role =
    productionSnapshot.primaryRoleMatch ||
    productionSnapshot.topRoleMatches?.[0] ||
    productionSnapshot.roleMatches?.[0] ||
    productionSnapshot.topRoles?.[0] ||
    productionSnapshot.bestRole ||
    productionSnapshot.targetRole ||
    null;
  if (!role) return null;
  return normalizeId(role.id || role.roleId || role.roleName || role.label || role.name || role);
}

function productionGapId(productionSnapshot = {}) {
  return normalizeId(
    productionSnapshot.gapDetails?.title ||
    productionSnapshot.biggestGap?.title ||
    productionSnapshot.biggestGap ||
    productionSnapshot.primaryGap ||
    ""
  );
}

function missingTriangleSignal(production, baseline, augmented) {
  return !production.top_role_id && !production.gap_id && !baseline.top_recommendation_id && !augmented.top_recommendation_id;
}

function scoreDirection(value) {
  return ["increased", "decreased", "flat"].includes(value) ? value : "unknown";
}

export function classifyProductionShadowAlignment({
  productionSnapshot = {},
  comparison = {},
  evaluation = {},
} = {}) {
  const production = {
    top_role_id: productionTopRoleId(productionSnapshot),
    gap_id: productionGapId(productionSnapshot),
  };
  const baseline = comparison.baseline || {};
  const augmented = comparison.augmented || {};
  const reasons = [];
  const failureFlags = [];
  const recommendationChanged = Boolean(comparison.reasoning_change?.recommendation_changed);
  const gapChanged = Boolean(comparison.reasoning_change?.gap_changed);
  const conflictChanged = Boolean(comparison.reasoning_change?.conflict_changed);
  const materialChange = Boolean(comparison.material_change);
  const usable = Boolean(evaluation.usable_for_shadow);
  const trust = Number(evaluation.trust || 0);
  const strength = Number(evaluation.strength || 0);
  const productionMatchesBaseline = Boolean(
    production.top_role_id &&
    baseline.top_recommendation_id &&
    production.top_role_id === baseline.top_recommendation_id
  );
  const productionMatchesAugmented = Boolean(
    production.top_role_id &&
    augmented.top_recommendation_id &&
    production.top_role_id === augmented.top_recommendation_id
  );
  const gapMatchesBaseline = Boolean(production.gap_id && baseline.strongest_gap && production.gap_id === normalizeId(baseline.strongest_gap));
  const gapMatchesAugmented = Boolean(production.gap_id && augmented.strongest_gap && production.gap_id === normalizeId(augmented.strongest_gap));
  const confidenceDirection = scoreDirection(comparison.evidence_change?.confidence_direction);

  if (missingTriangleSignal(production, baseline, augmented) || !usable) {
    reasons.push("Insufficient usable shadow signal for promotion assessment.");
    return {
      classification: ALIGNMENT_CLASSES.INSUFFICIENT_SIGNAL,
      reasons,
      failure_flags: [],
      production,
      baseline,
      augmented,
      recommendation_alignment: "unknown",
      gap_alignment: "unknown",
      confidence_alignment: confidenceDirection,
    };
  }

  if (recommendationChanged && trust < 45) {
    reasons.push("Recommendation changed while evaluated evidence trust is low.");
    failureFlags.push(FAILURE_CODES.UNSAFE_DIVERGENCE);
    failureFlags.push(FAILURE_CODES.UNEXPLAINED_RECOMMENDATION_SWING);
  }
  if (recommendationChanged && strength < 45) {
    reasons.push("Recommendation changed from weak evaluated evidence.");
    failureFlags.push(FAILURE_CODES.UNSAFE_DIVERGENCE);
  }

  if (failureFlags.length) {
    return {
      classification: ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE,
      reasons,
      failure_flags: [...new Set(failureFlags)],
      production,
      baseline,
      augmented,
      recommendation_alignment: "unsafe_divergence",
      gap_alignment: gapChanged ? "changed" : "stable",
      confidence_alignment: confidenceDirection,
    };
  }

  if (productionMatchesAugmented && (gapMatchesAugmented || !production.gap_id)) {
    reasons.push("Production and augmented shadow point to the same role direction.");
    return {
      classification: productionMatchesBaseline ? ALIGNMENT_CLASSES.ALIGNED : ALIGNMENT_CLASSES.PARTIALLY_ALIGNED,
      reasons,
      failure_flags: [],
      production,
      baseline,
      augmented,
      recommendation_alignment: "aligned",
      gap_alignment: gapMatchesAugmented ? "aligned" : "unknown",
      confidence_alignment: confidenceDirection,
    };
  }

  if (materialChange && (recommendationChanged || gapChanged || conflictChanged)) {
    reasons.push(
      recommendationChanged
        ? "New evidence produced a meaningful recommendation movement."
        : gapChanged
          ? "New evidence produced a meaningful gap movement."
          : "New evidence changed the conflict/uncertainty state."
    );
    if (!productionMatchesAugmented) reasons.push("Production may not yet include the newly evaluated evidence.");
    return {
      classification: ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE,
      reasons,
      failure_flags: [],
      production,
      baseline,
      augmented,
      recommendation_alignment: recommendationChanged ? "diverged" : productionMatchesAugmented ? "aligned" : "partial",
      gap_alignment: gapChanged ? "diverged" : gapMatchesAugmented ? "aligned" : "partial",
      confidence_alignment: confidenceDirection,
    };
  }

  reasons.push("Production and shadow are directionally close, but not identical.");
  return {
    classification: ALIGNMENT_CLASSES.PARTIALLY_ALIGNED,
    reasons,
    failure_flags: [],
    production,
    baseline,
    augmented,
    recommendation_alignment: productionMatchesAugmented || productionMatchesBaseline ? "partial" : "unknown",
    gap_alignment: gapMatchesAugmented || gapMatchesBaseline ? "partial" : "unknown",
    confidence_alignment: confidenceDirection,
  };
}

export function buildMaterialChangeExplanation({ evaluation = {}, comparison = {}, alignment = {} } = {}) {
  const lines = [];
  if (comparison.material_change) {
    lines.push(`${evaluation.candidate_type || "New evidence"} was evaluated as ${evaluation.status || "evaluated"}.`);
    if (comparison.reasoning_change?.gap_changed) {
      lines.push(`Strongest gap moved from ${comparison.baseline?.strongest_gap || "unknown"} to ${comparison.augmented?.strongest_gap || "unknown"}.`);
    }
    if (comparison.reasoning_change?.recommendation_changed) {
      lines.push(`Top recommendation moved from ${comparison.baseline?.top_recommendation_label || "unknown"} to ${comparison.augmented?.top_recommendation_label || "unknown"}.`);
    }
    if (comparison.reasoning_change?.conflict_changed || evaluation.status === "evaluated_conflicted") {
      lines.push("Conflict or uncertainty state changed after the new evidence.");
    }
  } else {
    lines.push("New evidence did not create a semantic reasoning change.");
  }
  for (const reason of asArray(alignment.reasons).slice(0, 2)) lines.push(reason);
  return lines.map((line) => compact(line, 180));
}

export function evaluateReadinessGates({
  evaluation = {},
  comparison = {},
  alignment = {},
  realUserRunCount = 0,
  syntheticOnly = false,
  privacyPassed = true,
  stability = {},
  config = {},
} = {}) {
  const cfg = { ...DEFAULT_PROMOTION_READINESS_CONFIG, ...config };
  const gates = [
    {
      id: "reliability",
      label: "Reliability",
      passed: !asArray(alignment.failure_flags).some((flag) =>
        [FAILURE_CODES.EVIDENCE_EVALUATION_FAILURE, FAILURE_CODES.SHADOW_REASONING_FAILURE, FAILURE_CODES.OBSERVATORY_FAILURE].includes(flag)
      ),
      status: "observed",
      threshold: cfg.maxFailureRate,
    },
    {
      id: "evidence_sensitivity",
      label: "Evidence Sensitivity",
      passed: evaluation.usable_for_shadow ? comparison.material_change != null : true,
      status: "observed",
      threshold: cfg.minEvidenceUsabilityRate,
    },
    {
      id: "stability",
      label: "Stability",
      passed: stability.noiseStable !== false && stability.duplicateStable !== false,
      status: Object.keys(stability || {}).length ? "observed" : "not_measured",
      threshold: cfg.maxNoiseInstabilityRate,
    },
    {
      id: "safety",
      label: "Safety",
      passed: alignment.classification !== ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE,
      status: "observed",
      threshold: cfg.maxUnsafeDivergenceRate,
    },
    {
      id: "alignment",
      label: "Alignment",
      passed: [
        ALIGNMENT_CLASSES.ALIGNED,
        ALIGNMENT_CLASSES.PARTIALLY_ALIGNED,
        ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE,
      ].includes(alignment.classification),
      status: "observed",
      threshold: "semantic_classification",
    },
    {
      id: "explainability",
      label: "Explainability",
      passed: asArray(buildMaterialChangeExplanation({ evaluation, comparison, alignment })).length > 0,
      status: "observed",
      threshold: cfg.minTraceCompleteness,
    },
    {
      id: "privacy",
      label: "Privacy",
      passed: Boolean(privacyPassed),
      status: "observed",
      threshold: "zero_privacy_failures",
    },
    {
      id: "real_user_sample",
      label: "Real-user Sample",
      passed: !syntheticOnly && realUserRunCount >= cfg.minimumRealUserRuns,
      status: realUserRunCount ? "observed" : "insufficient_sample",
      threshold: cfg.minimumRealUserRuns,
    },
  ];
  return gates;
}

function classifyReadiness(gates, alignment, { syntheticOnly = false, realUserRunCount = 0, config = {} } = {}) {
  const cfg = { ...DEFAULT_PROMOTION_READINESS_CONFIG, ...config };
  const failed = gates.filter((gate) => !gate.passed);
  const hasUnresolvedThresholds = gates.some((gate) => String(gate.threshold || "").includes("TBD_AFTER_BETA_DATA"));
  if (alignment.classification === ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE || failed.some((gate) => ["reliability", "safety", "privacy", "explainability"].includes(gate.id))) {
    return READINESS_CATEGORIES.NOT_READY;
  }
  if (syntheticOnly || realUserRunCount < cfg.minimumRealUserRuns) return READINESS_CATEGORIES.OBSERVE_MORE;
  if (failed.length || hasUnresolvedThresholds) return READINESS_CATEGORIES.LIMITED_EXPERIMENT_READY;
  return READINESS_CATEGORIES.CONTROLLED_PROMOTION_READY;
}

export function buildPromotionReadinessRun({
  userId = null,
  candidate = {},
  evaluation = {},
  comparison = {},
  productionSnapshot = {},
  realUserRunCount = 0,
  syntheticOnly = false,
  privacyPassed = true,
  stability = {},
  evaluatedAt = new Date().toISOString(),
  config = {},
} = {}) {
  const alignment = classifyProductionShadowAlignment({ productionSnapshot, comparison, evaluation });
  const gates = evaluateReadinessGates({
    evaluation,
    comparison,
    alignment,
    realUserRunCount,
    syntheticOnly,
    privacyPassed,
    stability,
    config,
  });
  const readiness = classifyReadiness(gates, alignment, { syntheticOnly, realUserRunCount, config });
  const explanation = buildMaterialChangeExplanation({ evaluation, comparison, alignment });
  return {
    run_id: `promotion_ready_${stableHash({
      candidate_id: candidate.candidate_id || evaluation.candidate_id,
      evaluation_id: evaluation.evaluation_id,
      comparison_id: comparison.comparison_id,
      version: PROMOTION_READINESS_VERSION,
    })}`,
    user_id: userId || candidate.user_id || evaluation.user_id || null,
    candidate_id: candidate.candidate_id || evaluation.candidate_id || null,
    evaluation_id: evaluation.evaluation_id || null,
    comparison_id: comparison.comparison_id || null,
    shadow_status: comparison.material_change ? "shadow_changed" : "shadow_stable",
    evidence_usability: evaluation.usable_for_shadow ? "usable_for_shadow" : "not_usable_for_shadow",
    material_change: Boolean(comparison.material_change),
    production_shadow_alignment: alignment.classification,
    recommendation_alignment: alignment.recommendation_alignment,
    gap_alignment: alignment.gap_alignment,
    confidence_alignment: alignment.confidence_alignment,
    safety_flags: asArray(comparison.safety_flags),
    failure_flags: alignment.failure_flags,
    readiness_classification: readiness,
    readiness_gates: gates,
    explanation,
    triangle: {
      production: alignment.production,
      baseline: {
        top_recommendation_id: comparison.baseline?.top_recommendation_id || null,
        strongest_gap: comparison.baseline?.strongest_gap || null,
        decision_confidence: comparison.baseline?.decision_confidence ?? null,
      },
      augmented: {
        top_recommendation_id: comparison.augmented?.top_recommendation_id || null,
        strongest_gap: comparison.augmented?.strongest_gap || null,
        decision_confidence: comparison.augmented?.decision_confidence ?? null,
      },
    },
    validation_hooks: {
      next_outcome_can_validate: Boolean(comparison.material_change),
      validation_target: comparison.reasoning_change?.recommendation_changed
        ? "recommendation_direction"
        : comparison.reasoning_change?.gap_changed
          ? "gap_direction"
          : "confidence_direction",
      requires_real_user_followup: true,
    },
    evaluated_at: evaluatedAt,
    evaluator_version: PROMOTION_READINESS_VERSION,
  };
}

export function calculatePromotionReadinessAggregate(shadowLearning = {}) {
  const runs = asArray(shadowLearning.readiness_runs);
  const failures = asArray(shadowLearning.failures);
  const usableRuns = runs.filter((run) => run.evidence_usability === "usable_for_shadow");
  const materialRuns = runs.filter((run) => run.material_change);
  const alignedRuns = runs.filter((run) =>
    [ALIGNMENT_CLASSES.ALIGNED, ALIGNMENT_CLASSES.PARTIALLY_ALIGNED].includes(run.production_shadow_alignment)
  );
  const meaningfulDivergenceRuns = runs.filter((run) => run.production_shadow_alignment === ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE);
  const unsafeDivergenceRuns = runs.filter((run) => run.production_shadow_alignment === ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE);
  const unexplainedSwings = runs.filter((run) => asArray(run.failure_flags).includes(FAILURE_CODES.UNEXPLAINED_RECOMMENDATION_SWING));
  const privacyFailures = runs.filter((run) => asArray(run.failure_flags).includes(FAILURE_CODES.PRIVACY_GUARD_FAILURE));
  const noiseFailures = runs.filter((run) => asArray(run.failure_flags).includes(FAILURE_CODES.REDUNDANCY_INFLATION));
  return {
    total_readiness_runs: runs.length,
    evidence_usability_rate: rate(usableRuns.length, runs.length),
    shadow_evaluation_success_rate: rate(runs.length, runs.length + failures.length),
    material_change_rate: rate(materialRuns.length, usableRuns.length),
    recommendation_change_rate: rate(runs.filter((run) => run.recommendation_alignment === "diverged").length, usableRuns.length),
    gap_change_rate: rate(runs.filter((run) => run.gap_alignment === "diverged").length, usableRuns.length),
    production_shadow_alignment_rate: rate(alignedRuns.length, runs.length),
    meaningful_divergence_rate: rate(meaningfulDivergenceRuns.length, runs.length),
    unsafe_divergence_rate: rate(unsafeDivergenceRuns.length, runs.length),
    unexplained_recommendation_swing_rate: rate(unexplainedSwings.length, runs.length),
    shadow_failure_rate: rate(failures.length, runs.length + failures.length),
    privacy_failure_rate: rate(privacyFailures.length, runs.length),
    noise_instability_rate: rate(noiseFailures.length, runs.length),
    readiness_classification_counts: runs.reduce((acc, run) => {
      acc[run.readiness_classification] = (acc[run.readiness_classification] || 0) + 1;
      return acc;
    }, {}),
  };
}

export function classifyStabilityProbe({
  baseline = {},
  variant = {},
  evidenceType = "unknown",
  expectedMaterial = false,
} = {}) {
  const recommendationChanged = normalizeId(baseline.top_recommendation_id || baseline.topRole) !==
    normalizeId(variant.top_recommendation_id || variant.topRole);
  const confidenceDelta = Math.abs(Number(variant.decision_confidence || 0) - Number(baseline.decision_confidence || 0));
  const materialShift = recommendationChanged || confidenceDelta >= DEFAULT_PROMOTION_READINESS_CONFIG.materialConfidenceDelta;
  const stable = expectedMaterial ? materialShift : !materialShift;
  return {
    evidence_type: evidenceType,
    expected_material: expectedMaterial,
    recommendation_changed: recommendationChanged,
    confidence_delta: confidenceDelta,
    material_shift: materialShift,
    stable,
    failure_code: stable ? null : evidenceType === "duplicate" ? FAILURE_CODES.REDUNDANCY_INFLATION : "NOISE_INSTABILITY",
  };
}
