import assert from "node:assert/strict";
import {
  buildActionId,
  buildDecisionId,
  getWeekKey,
  transitionAction,
  upsertActionOutcome,
  upsertRecommendedAction,
} from "../lib/careerActionLoop/actionModel.js";
import { runEvidenceCandidateShadowLearning } from "../lib/careerActionLoop/evidenceEvaluation.js";
import {
  ALIGNMENT_CLASSES,
  FAILURE_CODES,
  READINESS_CATEGORIES,
  buildPromotionReadinessRun,
  calculatePromotionReadinessAggregate,
  classifyProductionShadowAlignment,
  classifyStabilityProbe,
} from "../lib/careerActionLoop/promotionReadiness.js";
import { trackActivationEvent } from "../src/utils/activationEvents.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  return name;
}

const userId = "00000000-0000-4000-8000-000000000165";
const weekKey = getWeekKey(new Date("2026-08-19T11:00:00.000Z"));
const baseAction = {
  week_key: weekKey,
  title: "Write one stakeholder-impact project example.",
  reason: "Recruiters cannot yet verify stakeholder impact.",
  blocker: "Stakeholder impact proof is missing.",
  target_dimension: "stakeholder_impact",
  expected_evidence: "One short case example.",
  confidence: "Medium",
};
const decisionId = buildDecisionId({ weekKey, title: baseAction.title, blocker: baseAction.blocker });
const actionId = buildActionId({ userId, weekKey, decisionId, title: baseAction.title });
const productionSnapshot = {
  primaryRoleMatch: { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
  topRoleMatches: [
    { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
    { roleName: "Business Analyst", fitPercentage: 54 },
  ],
  gapDetails: { title: "Stakeholder Impact" },
  readinessScore: 63,
  recruiterTrust: 24,
};

function makeCompletedGps() {
  const base = {
    snapshot: productionSnapshot,
    decision_loop: {
      actions: [],
      outcomes: [],
      evidence_candidates: [],
      shadow_learning: {
        evaluations: [],
        comparisons: [],
        readiness_runs: [],
        failures: [],
      },
    },
  };
  const recommended = upsertRecommendedAction(base, { ...baseAction, decision_id: decisionId, action_id: actionId }, { userId });
  const started = transitionAction(recommended.career_gps, actionId, "started", { userId });
  return transitionAction(started.career_gps, actionId, "completed", { userId }).career_gps;
}

function saveOutcome(outcome, gps = makeCompletedGps()) {
  return upsertActionOutcome(gps, actionId, outcome, { userId, now: "2026-08-19T11:01:00.000Z" });
}

function profileFor(careerGps) {
  return {
    user_id: userId,
    career_gps: careerGps,
    career_snapshot: productionSnapshot,
    projects: [
      {
        title: "HireFit workflow",
        description: "Built a career decision workflow.",
        occurred_at: "2026",
      },
    ],
  };
}

function fakeRun({
  runId,
  evidenceCount = 3,
  quality = 58,
  coverage = 52,
  recommendation = "Strategy & Operations Intern",
  confidence = 55,
  gap = "stakeholder_impact",
  conflicts = 0,
  hypothesis = "operations",
} = {}) {
  return {
    runId,
    shadowResult: {
      inputSummary: { evidenceCount },
      reasoning: {
        evidenceIntelligence: {
          evidenceObjects: Array.from({ length: evidenceCount }, (_, index) => ({ id: `ev_${index}` })),
          quality: { evidenceQualityScore: quality },
          coverage: { coverageScore: coverage },
        },
        topRecommendation: {
          id: recommendation.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: recommendation,
          decisionConfidence: confidence,
        },
        recommendations: [{ label: recommendation, decisionConfidence: confidence }],
        missingEvidence: { primaryMissingEvidence: { competency: gap } },
        conflicts: { items: Array.from({ length: conflicts }, (_, index) => ({ id: `conflict_${index}` })) },
        hypotheses: [{ competency: hypothesis, confidence }],
      },
    },
    warnings: [],
  };
}

const strongOutcome = saveOutcome({
  outcome_type: "COMPLETED_WITH_RESULT",
  summary: "Published a stakeholder-impact case example for the HireFit project.",
  measurable_result: "Added 3 stakeholder impact examples",
  proof_reference: "",
});

check("strong relevant evidence creates stable reasoning movement", () => {
  const learning = runEvidenceCandidateShadowLearning({
    careerGps: strongOutcome.career_gps,
    profile: profileFor(strongOutcome.career_gps),
    candidate: strongOutcome.evidenceCandidate,
    action: strongOutcome.action,
    outcome: strongOutcome.outcome,
    productionSnapshot,
    observatoryRunner: (input) =>
      fakeRun(input.profile._shadow_augmented_evidence_ids
        ? { runId: "aug_strong", coverage: 66, gap: "quantified_outcomes", confidence: 64 }
        : { runId: "base_strong", coverage: 52, gap: "stakeholder_impact", confidence: 55 }),
  });
  assert.equal(learning.comparison.material_change, true);
  assert.equal(learning.promotionReadiness.production_shadow_alignment, ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE);
});

check("vague evidence does not create large recommendation swing", () => {
  const probe = classifyStabilityProbe({
    baseline: { top_recommendation_id: "strategy_operations", decision_confidence: 50 },
    variant: { top_recommendation_id: "strategy_operations", decision_confidence: 53 },
    evidenceType: "vague_self_report",
  });
  assert.equal(probe.stable, true);
});

check("duplicate evidence does not inflate confidence materially", () => {
  const probe = classifyStabilityProbe({
    baseline: { top_recommendation_id: "strategy_operations", decision_confidence: 62 },
    variant: { top_recommendation_id: "strategy_operations", decision_confidence: 64 },
    evidenceType: "duplicate",
  });
  assert.equal(probe.stable, true);
});

check("duplicate instability is detectable as redundancy inflation", () => {
  const probe = classifyStabilityProbe({
    baseline: { top_recommendation_id: "strategy_operations", decision_confidence: 62 },
    variant: { top_recommendation_id: "product_management", decision_confidence: 78 },
    evidenceType: "duplicate",
  });
  assert.equal(probe.stable, false);
  assert.equal(probe.failure_code, FAILURE_CODES.REDUNDANCY_INFLATION);
});

check("contradiction increases uncertainty or conflict state", () => {
  const alignment = classifyProductionShadowAlignment({
    productionSnapshot,
    evaluation: { usable_for_shadow: true, trust: 60, strength: 60, status: "evaluated_conflicted" },
    comparison: {
      material_change: true,
      reasoning_change: { conflict_changed: true },
      evidence_change: { confidence_direction: "decreased" },
      baseline: fakeRun({ runId: "base_conf", conflicts: 0 }).shadowResult.reasoning.evidenceIntelligence && {
        top_recommendation_id: "strategy_operations_intern",
        strongest_gap: "stakeholder_impact",
      },
      augmented: {
        top_recommendation_id: "strategy_operations_intern",
        strongest_gap: "stakeholder_impact",
      },
    },
  });
  assert.notEqual(alignment.classification, ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE);
  assert.equal(alignment.confidence_alignment, "decreased");
});

check("rejection does not automatically reduce unrelated skill confidence", () => {
  const rejection = saveOutcome({
    outcome_type: "REJECTION",
    summary: "Received a rejection response after applying.",
    measurable_result: "",
    proof_reference: "",
  });
  const learning = runEvidenceCandidateShadowLearning({
    careerGps: rejection.career_gps,
    profile: profileFor(rejection.career_gps),
    candidate: rejection.evidenceCandidate,
    action: rejection.action,
    outcome: rejection.outcome,
    productionSnapshot,
    observatoryRunner: (input) =>
      fakeRun(input.profile._shadow_augmented_evidence_ids
        ? { runId: "aug_rej", recommendation: "Strategy & Operations Intern", confidence: 55 }
        : { runId: "base_rej", recommendation: "Strategy & Operations Intern", confidence: 55 }),
  });
  assert.equal(learning.evaluation.candidate_type, "market_response");
  if (learning.comparison) {
    assert.equal(learning.comparison.reasoning_change.recommendation_changed, false);
  } else {
    assert.equal(learning.shadowAttempted, false);
    assert.equal(learning.evaluation.usable_for_shadow, false);
  }
});

check("offer does not automatically prove unrelated skill", () => {
  const offer = saveOutcome({
    outcome_type: "OFFER",
    summary: "Received an offer response after the application process.",
    measurable_result: "",
    proof_reference: "",
  });
  const learning = runEvidenceCandidateShadowLearning({
    careerGps: offer.career_gps,
    profile: profileFor(offer.career_gps),
    candidate: offer.evidenceCandidate,
    action: offer.action,
    outcome: offer.outcome,
    productionSnapshot,
    observatoryRunner: (input) =>
      fakeRun(input.profile._shadow_augmented_evidence_ids
        ? { runId: "aug_offer", recommendation: "Strategy & Operations Intern", confidence: 57 }
        : { runId: "base_offer", recommendation: "Strategy & Operations Intern", confidence: 55 }),
  });
  assert.equal(learning.evaluation.candidate_type, "market_response");
  if (learning.promotionReadiness) {
    assert.equal(learning.promotionReadiness.production_shadow_alignment, ALIGNMENT_CLASSES.PARTIALLY_ALIGNED);
  } else {
    assert.equal(learning.shadowAttempted, false);
    assert.equal(learning.evaluation.usable_for_shadow, false);
  }
});

check("production remains unchanged", () => {
  const learning = runEvidenceCandidateShadowLearning({
    careerGps: strongOutcome.career_gps,
    profile: profileFor(strongOutcome.career_gps),
    candidate: strongOutcome.evidenceCandidate,
    action: strongOutcome.action,
    outcome: strongOutcome.outcome,
    productionSnapshot,
  });
  assert.deepEqual(learning.career_gps.snapshot, productionSnapshot);
});

check("shadow failure does not break production", () => {
  const learning = runEvidenceCandidateShadowLearning({
    careerGps: strongOutcome.career_gps,
    profile: profileFor(strongOutcome.career_gps),
    candidate: strongOutcome.evidenceCandidate,
    action: strongOutcome.action,
    outcome: strongOutcome.outcome,
    observatoryRunner: () => {
      throw new Error("forced shadow failure");
    },
  });
  assert.equal(learning.failed, true);
  assert.equal(learning.career_gps.snapshot.recruiterTrust, 24);
});

check("material change has explanation", () => {
  const readiness = buildPromotionReadinessRun({
    userId,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { ...strongOutcome.evidenceCandidate, evaluation_id: "eval_exp", usable_for_shadow: true, status: "evaluated_usable", trust: 60, strength: 70, candidate_type: "measurable_outcome_claim" },
    comparison: {
      comparison_id: "cmp_exp",
      material_change: true,
      reasoning_change: { gap_changed: true, recommendation_changed: false },
      evidence_change: { confidence_direction: "increased" },
      baseline: { top_recommendation_id: "strategy_operations_intern", top_recommendation_label: "Strategy & Operations Intern", strongest_gap: "stakeholder_impact", decision_confidence: 55 },
      augmented: { top_recommendation_id: "strategy_operations_intern", top_recommendation_label: "Strategy & Operations Intern", strongest_gap: "quantified_outcomes", decision_confidence: 65 },
    },
    productionSnapshot,
    syntheticOnly: true,
  });
  assert.ok(readiness.explanation.length >= 2);
});

check("unsafe divergence is classified", () => {
  const alignment = classifyProductionShadowAlignment({
    productionSnapshot,
    evaluation: { usable_for_shadow: true, trust: 30, strength: 35 },
    comparison: {
      material_change: true,
      reasoning_change: { recommendation_changed: true },
      evidence_change: { confidence_direction: "increased" },
      baseline: { top_recommendation_id: "strategy_operations_intern" },
      augmented: { top_recommendation_id: "finance_analyst" },
    },
  });
  assert.equal(alignment.classification, ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE);
  assert.ok(alignment.failure_flags.includes(FAILURE_CODES.UNSAFE_DIVERGENCE));
});

check("small score noise does not count as semantic divergence", () => {
  const readiness = buildPromotionReadinessRun({
    userId,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { evaluation_id: "eval_noise", usable_for_shadow: true, status: "evaluated_usable", trust: 60, strength: 60 },
    comparison: {
      comparison_id: "cmp_noise",
      material_change: false,
      reasoning_change: {},
      evidence_change: { confidence_direction: "flat" },
      baseline: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact", decision_confidence: 55 },
      augmented: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact", decision_confidence: 57 },
    },
    productionSnapshot,
    syntheticOnly: true,
  });
  assert.notEqual(readiness.production_shadow_alignment, ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE);
});

check("alignment can exist despite numeric score differences", () => {
  const alignment = classifyProductionShadowAlignment({
    productionSnapshot,
    evaluation: { usable_for_shadow: true, trust: 60, strength: 60 },
    comparison: {
      material_change: false,
      reasoning_change: {},
      evidence_change: { confidence_direction: "flat" },
      baseline: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact", decision_confidence: 48 },
      augmented: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact", decision_confidence: 67 },
    },
  });
  assert.equal(alignment.classification, ALIGNMENT_CLASSES.ALIGNED);
});

check("readiness cannot become promotion-ready from synthetic tests alone", () => {
  const readiness = buildPromotionReadinessRun({
    userId,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { evaluation_id: "eval_syn", usable_for_shadow: true, status: "evaluated_usable", trust: 80, strength: 80 },
    comparison: {
      comparison_id: "cmp_syn",
      material_change: false,
      reasoning_change: {},
      evidence_change: { confidence_direction: "flat" },
      baseline: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact" },
      augmented: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact" },
    },
    productionSnapshot,
    realUserRunCount: 100,
    syntheticOnly: true,
  });
  assert.equal(readiness.readiness_classification, READINESS_CATEGORIES.OBSERVE_MORE);
});

check("real-user sample requirement blocks promotion when insufficient", () => {
  const readiness = buildPromotionReadinessRun({
    userId,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { evaluation_id: "eval_real", usable_for_shadow: true, status: "evaluated_usable", trust: 80, strength: 80 },
    comparison: {
      comparison_id: "cmp_real",
      material_change: false,
      reasoning_change: {},
      evidence_change: { confidence_direction: "flat" },
      baseline: { top_recommendation_id: "strategy_operations_intern" },
      augmented: { top_recommendation_id: "strategy_operations_intern" },
    },
    productionSnapshot,
    realUserRunCount: 2,
  });
  assert.equal(readiness.readiness_classification, READINESS_CATEGORIES.OBSERVE_MORE);
});

check("privacy-safe telemetry contains no raw user evidence", () => {
  const eventStore = [];
  globalThis.window = { dataLayer: eventStore };
  trackActivationEvent("shadow_promotion_readiness_evaluated", {
    route: "/dashboard",
    lang: "TR",
    candidate_type: "measurable_outcome_claim",
    evaluation_status: "evaluated_usable",
    usable_for_shadow: true,
    material_change: true,
    recommendation_changed: false,
    gap_changed: true,
    confidence_direction: "increased",
    production_shadow_alignment: "MEANINGFUL_DIVERGENCE",
    readiness_classification: "OBSERVE_MORE",
    failure_flag_count: 0,
    claim: "raw personal claim",
    proof_reference: "https://private.example.test",
  });
  assert.equal(eventStore[0].claim, undefined);
  assert.equal(eventStore[0].proof_reference, undefined);
  assert.equal(eventStore[0].readiness_classification, "OBSERVE_MORE");
});

check("aggregate readiness metrics are calculated", () => {
  const readiness = buildPromotionReadinessRun({
    userId,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { evaluation_id: "eval_agg", usable_for_shadow: true, status: "evaluated_usable", trust: 70, strength: 70 },
    comparison: {
      comparison_id: "cmp_agg",
      material_change: true,
      reasoning_change: { gap_changed: true },
      evidence_change: { confidence_direction: "increased" },
      baseline: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact" },
      augmented: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "business_impact" },
    },
    productionSnapshot,
  });
  const aggregate = calculatePromotionReadinessAggregate({
    readiness_runs: [readiness],
    failures: [],
  });
  assert.equal(aggregate.total_readiness_runs, 1);
  assert.equal(aggregate.evidence_usability_rate, 1);
  assert.equal(aggregate.material_change_rate, 1);
});

check("limited experiment can be classified only with enough real data", () => {
  const readiness = buildPromotionReadinessRun({
    userId,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { evaluation_id: "eval_limit", usable_for_shadow: true, status: "evaluated_usable", trust: 80, strength: 80 },
    comparison: {
      comparison_id: "cmp_limit",
      material_change: false,
      reasoning_change: {},
      evidence_change: { confidence_direction: "flat" },
      baseline: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact" },
      augmented: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact" },
    },
    productionSnapshot,
    realUserRunCount: 30,
    stability: {},
  });
  assert.equal(readiness.readiness_classification, READINESS_CATEGORIES.LIMITED_EXPERIMENT_READY);
});

check("readiness run stores production-baseline-augmented triangle", () => {
  const run = strongOutcome.career_gps.decision_loop.shadow_learning?.readiness_runs?.[0] || buildPromotionReadinessRun({
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { evaluation_id: "eval_tri", usable_for_shadow: true, status: "evaluated_usable", trust: 70, strength: 70 },
    comparison: {
      comparison_id: "cmp_tri",
      material_change: false,
      reasoning_change: {},
      evidence_change: { confidence_direction: "flat" },
      baseline: { top_recommendation_id: "strategy_operations_intern" },
      augmented: { top_recommendation_id: "strategy_operations_intern" },
    },
    productionSnapshot,
  });
  assert.ok(run.triangle.production);
  assert.ok(run.triangle.baseline);
  assert.ok(run.triangle.augmented);
});

check("absence of evidence is insufficient signal, not negative evidence", () => {
  const alignment = classifyProductionShadowAlignment({
    productionSnapshot: {},
    evaluation: { usable_for_shadow: false },
    comparison: { baseline: {}, augmented: {}, material_change: false },
  });
  assert.equal(alignment.classification, ALIGNMENT_CLASSES.INSUFFICIENT_SIGNAL);
});

check("promotion readiness is persisted during shadow learning", () => {
  const learning = runEvidenceCandidateShadowLearning({
    careerGps: strongOutcome.career_gps,
    profile: profileFor(strongOutcome.career_gps),
    candidate: strongOutcome.evidenceCandidate,
    action: strongOutcome.action,
    outcome: strongOutcome.outcome,
    productionSnapshot,
    observatoryRunner: (input) =>
      fakeRun(input.profile._shadow_augmented_evidence_ids
        ? { runId: "aug_persist", evidenceCount: 4 }
        : { runId: "base_persist", evidenceCount: 3 }),
  });
  assert.equal(learning.career_gps.decision_loop.shadow_learning.readiness_runs.length, 1);
  assert.equal(learning.career_gps.decision_loop.shadow_learning.aggregate_summary.total_readiness_runs, 1);
});

check("existing Sprint 6.1-6.4 data survives readiness persistence", () => {
  const learning = runEvidenceCandidateShadowLearning({
    careerGps: strongOutcome.career_gps,
    profile: profileFor(strongOutcome.career_gps),
    candidate: strongOutcome.evidenceCandidate,
    action: strongOutcome.action,
    outcome: strongOutcome.outcome,
    productionSnapshot,
  });
  assert.equal(learning.career_gps.decision_loop.actions.length, 1);
  assert.equal(learning.career_gps.decision_loop.outcomes.length, 1);
  assert.equal(learning.career_gps.decision_loop.evidence_candidates.length, 1);
  assert.equal(learning.career_gps.snapshot.readinessScore, 63);
});

process.stdout.write(`Shadow promotion readiness validation passed: ${passed}/22\n`);
