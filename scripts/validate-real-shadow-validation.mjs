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
} from "../lib/careerActionLoop/promotionReadiness.js";
import {
  GAP_COMPARISON_CLASSES,
  REAL_USER_COHORT_STATES,
  REVIEW_CLASSIFICATIONS,
  REVIEW_JUDGMENTS,
  VALIDATION_SOURCE_KINDS,
  buildHumanReview,
  buildInternalReviewQueue,
  buildRealUserValidationRun,
  calculateRealUserValidationAggregate,
  upsertHumanReview,
} from "../lib/careerActionLoop/realUserShadowValidation.js";
import { trackActivationEvent } from "../src/utils/activationEvents.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  return name;
}

const userId = "00000000-0000-4000-8000-000000000166";
const weekKey = getWeekKey(new Date("2026-08-19T12:00:00.000Z"));
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
  readinessScore: 63,
  recruiterTrust: 24,
  primaryRoleMatch: { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
  topRoleMatches: [
    { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
    { roleName: "Business Analyst", fitPercentage: 54 },
  ],
  gapDetails: { title: "Stakeholder Impact" },
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
        validation_runs: [],
        human_reviews: [],
        failures: [],
      },
    },
  };
  const recommended = upsertRecommendedAction(base, { ...baseAction, decision_id: decisionId, action_id: actionId }, {
    userId,
    now: "2026-08-19T12:00:00.000Z",
  });
  const started = transitionAction(recommended.career_gps, actionId, "started", {
    userId,
    now: "2026-08-19T12:01:00.000Z",
  });
  return transitionAction(started.career_gps, actionId, "completed", {
    userId,
    now: "2026-08-19T12:02:00.000Z",
  }).career_gps;
}

function saveOutcome(outcome, gps = makeCompletedGps(), now = "2026-08-19T12:03:00.000Z") {
  return upsertActionOutcome(gps, actionId, outcome, { userId, now });
}

function profileFor(careerGps) {
  return {
    user_id: userId,
    career_gps: careerGps,
    career_snapshot: productionSnapshot,
    career_readiness: { score: 63 },
    projects: [{ title: "HireFit workflow", description: "Built a career decision workflow.", occurred_at: "2026" }],
  };
}

function fakeRun({
  runId,
  evidenceCount = 3,
  recommendation = "Strategy & Operations Intern",
  confidence = 55,
  gap = "stakeholder_impact",
  conflicts = 0,
} = {}) {
  return {
    runId,
    shadowResult: {
      inputSummary: { evidenceCount },
      reasoning: {
        evidenceIntelligence: {
          evidenceObjects: Array.from({ length: evidenceCount }, (_, index) => ({ id: `ev_${index}` })),
          quality: { evidenceQualityScore: 58 },
          coverage: { coverageScore: 52 },
        },
        topRecommendation: {
          id: recommendation.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: recommendation,
          decisionConfidence: confidence,
        },
        recommendations: [{ label: recommendation, decisionConfidence: confidence }],
        missingEvidence: { primaryMissingEvidence: { competency: gap } },
        conflicts: { items: Array.from({ length: conflicts }, (_, index) => ({ id: `conflict_${index}` })) },
        hypotheses: [{ competency: "operations", confidence }],
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

function runRealLearning({
  outcome = strongOutcome,
  validationSource = VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
  observatoryRunner = (input) =>
    fakeRun(input.profile._shadow_augmented_evidence_ids
      ? { runId: "aug_real", evidenceCount: 4, gap: "quantified_outcomes", confidence: 64 }
      : { runId: "base_real", evidenceCount: 3, gap: "stakeholder_impact", confidence: 55 }),
} = {}) {
  return runEvidenceCandidateShadowLearning({
    careerGps: outcome.career_gps,
    profile: profileFor(outcome.career_gps),
    candidate: outcome.evidenceCandidate,
    action: outcome.action,
    outcome: outcome.outcome,
    productionSnapshot,
    validationSource,
    realUserRunCount: 0,
    observatoryRunner,
  });
}

check("synthetic user does not count toward real-user sample", () => {
  const learning = runRealLearning({ validationSource: VALIDATION_SOURCE_KINDS.SYNTHETIC });
  const aggregate = calculateRealUserValidationAggregate(learning.career_gps.decision_loop.shadow_learning);
  assert.equal(learning.realUserValidation.source_kind, VALIDATION_SOURCE_KINDS.SYNTHETIC);
  assert.equal(aggregate.complete_learning_cycles, 0);
});

const realLearning = runRealLearning();

check("real authenticated run can create validation record", () => {
  assert.equal(realLearning.realUserValidation.source_kind, VALIDATION_SOURCE_KINDS.REAL_BETA_USER);
  assert.equal(realLearning.realUserValidation.complete_learning_cycle, true);
  assert.ok(realLearning.realUserValidation.validation_id);
});

check("partial pipeline does not count as complete learning cycle", () => {
  const weakOutcome = saveOutcome({
    outcome_type: "COMPLETED_NO_RESULT",
    summary: "No result yet",
    measurable_result: "",
    proof_reference: "",
  });
  const partial = runEvidenceCandidateShadowLearning({
    careerGps: weakOutcome.career_gps,
    profile: profileFor(weakOutcome.career_gps),
    candidate: { ...strongOutcome.evidenceCandidate, candidate_id: "candidate_partial", preliminary_strength: "weak", measurable_result: "" },
    action: weakOutcome.action,
    outcome: weakOutcome.outcome,
    productionSnapshot,
    validationSource: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
    evaluator: ({ candidate }) => ({
      evaluation: {
        evaluation_id: "eval_partial",
        candidate_id: candidate.candidate_id,
        user_id: candidate.user_id,
        action_id: candidate.action_id,
        outcome_id: candidate.outcome_id,
        status: "evaluated_insufficient",
        candidate_type: "described_outcome",
        trust: 20,
        strength: 20,
        usable_for_shadow: false,
        evaluated_at: "2026-08-19T12:04:00.000Z",
      },
      usableForShadow: false,
    }),
  });
  assert.equal(partial.realUserValidation.complete_learning_cycle, false);
  assert.equal(calculateRealUserValidationAggregate(partial.career_gps.decision_loop.shadow_learning).complete_learning_cycles, 0);
});

check("broken action/outcome/candidate lineage is detected", () => {
  const validation = buildRealUserValidationRun({
    userId,
    action: { ...strongOutcome.action, status: "completed" },
    outcome: { ...strongOutcome.outcome, action_id: "different_action" },
    candidate: strongOutcome.evidenceCandidate,
    evaluation: realLearning.evaluation,
    comparison: realLearning.comparison,
    readinessRun: realLearning.promotionReadiness,
    productionSnapshot,
    source: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
  });
  assert.equal(validation.complete_learning_cycle, false);
  assert.ok(validation.incomplete_reasons.includes("action_outcome"));
});

check("unsafe divergence triggers review requirement", () => {
  const validation = buildRealUserValidationRun({
    userId,
    action: { ...strongOutcome.action, status: "completed" },
    outcome: strongOutcome.outcome,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { ...realLearning.evaluation, trust: 20, strength: 20 },
    comparison: {
      ...realLearning.comparison,
      material_change: true,
      reasoning_change: { recommendation_changed: true },
      baseline: { top_recommendation_id: "strategy_operations_intern", strongest_gap: "stakeholder_impact" },
      augmented: { top_recommendation_id: "finance_analyst", strongest_gap: "stakeholder_impact" },
    },
    readinessRun: {
      ...realLearning.promotionReadiness,
      production_shadow_alignment: ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE,
      failure_flags: [FAILURE_CODES.UNSAFE_DIVERGENCE],
    },
    productionSnapshot,
    source: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
  });
  assert.equal(validation.review_classification, REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED);
});

check("weak evidence causing large change triggers review", () => {
  const validation = buildRealUserValidationRun({
    userId,
    action: { ...strongOutcome.action, status: "completed" },
    outcome: strongOutcome.outcome,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { ...realLearning.evaluation, trust: 30, strength: 35 },
    comparison: { ...realLearning.comparison, material_change: true, reasoning_change: { gap_changed: true } },
    readinessRun: realLearning.promotionReadiness,
    productionSnapshot,
    source: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
  });
  assert.equal(validation.review_classification, REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED);
});

check("aligned low-risk run can auto-clear", () => {
  const aligned = runRealLearning({
    observatoryRunner: (input) =>
      fakeRun(input.profile._shadow_augmented_evidence_ids
        ? { runId: "aug_aligned", gap: "stakeholder_impact", confidence: 57 }
        : { runId: "base_aligned", gap: "stakeholder_impact", confidence: 55 }),
  });
  assert.equal(aligned.realUserValidation.review_classification, REVIEW_CLASSIFICATIONS.AUTO_CLEAR);
});

check("human review updates the canonical validation record", () => {
  const shadowLearning = upsertHumanReview(realLearning.career_gps.decision_loop.shadow_learning, {
    validationId: realLearning.realUserValidation.validation_id,
    judgment: REVIEW_JUDGMENTS.SHADOW_DIRECTIONALLY_CORRECT,
  });
  const run = shadowLearning.validation_runs.find((item) => item.validation_id === realLearning.realUserValidation.validation_id);
  assert.equal(run.review_status, "reviewed");
  assert.equal(run.review_judgment, REVIEW_JUDGMENTS.SHADOW_DIRECTIONALLY_CORRECT);
});

check("duplicate review does not create inconsistent state", () => {
  const first = upsertHumanReview(realLearning.career_gps.decision_loop.shadow_learning, {
    validationId: realLearning.realUserValidation.validation_id,
    judgment: REVIEW_JUDGMENTS.BOTH_REASONABLE,
  });
  const second = upsertHumanReview(first, {
    validationId: realLearning.realUserValidation.validation_id,
    judgment: REVIEW_JUDGMENTS.PRODUCTION_DIRECTIONALLY_CORRECT,
  });
  assert.equal(second.human_reviews.length, 1);
  assert.equal(second.human_reviews[0].judgment, REVIEW_JUDGMENTS.PRODUCTION_DIRECTIONALLY_CORRECT);
});

check("gap comparison is classified", () => {
  assert.equal(realLearning.realUserValidation.gap_comparison.classification, GAP_COMPARISON_CLASSES.CHANGED_UNEXPECTEDLY);
});

check("trusted usable evidence can classify gap movement as expected", () => {
  const trusted = buildRealUserValidationRun({
    userId,
    action: { ...strongOutcome.action, status: "completed" },
    outcome: strongOutcome.outcome,
    candidate: strongOutcome.evidenceCandidate,
    evaluation: { ...realLearning.evaluation, trust: 70, strength: 75, usable_for_shadow: true },
    comparison: realLearning.comparison,
    readinessRun: realLearning.promotionReadiness,
    productionSnapshot,
    source: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
  });
  assert.equal(trusted.gap_comparison.classification, GAP_COMPARISON_CLASSES.CHANGED_DUE_TO_USABLE_EVIDENCE);
});

check("production gap remains unchanged", () => {
  assert.equal(realLearning.career_gps.snapshot.gapDetails.title, "Stakeholder Impact");
});

check("production Weekly Decision remains unchanged", () => {
  assert.equal(realLearning.career_gps.decision_loop.actions[0].title, baseAction.title);
});

check("production scores remain unchanged", () => {
  assert.equal(realLearning.career_gps.snapshot.readinessScore, 63);
  assert.equal(realLearning.career_gps.snapshot.recruiterTrust, 24);
  assert.equal(realLearning.career_gps.snapshot.primaryRoleMatch.fitPercentage, 58);
});

check("review telemetry contains no raw evidence", () => {
  const eventStore = [];
  globalThis.window = { dataLayer: eventStore };
  trackActivationEvent("real_shadow_review_required", {
    route: "/dashboard",
    lang: "TR",
    validation_status: "complete",
    review_classification: "REVIEW_REQUIRED",
    review_priority: 100,
    gap_comparison: "changed_unexpectedly",
    real_user_cohort_state: "EARLY_SIGNAL",
    claim: "raw evidence claim",
    proof_reference: "https://private.example.test",
  });
  assert.equal(eventStore[0].claim, undefined);
  assert.equal(eventStore[0].proof_reference, undefined);
  assert.equal(eventStore[0].review_classification, "REVIEW_REQUIRED");
});

check("aggregate metrics exclude synthetic fixtures", () => {
  const real = realLearning.realUserValidation;
  const synthetic = { ...real, validation_id: "synthetic_validation", source_kind: VALIDATION_SOURCE_KINDS.SYNTHETIC, is_real_user: false };
  const aggregate = calculateRealUserValidationAggregate({ validation_runs: [real, synthetic], human_reviews: [] });
  assert.equal(aggregate.complete_learning_cycles, 1);
});

check("insufficient sample returns insufficient-data status", () => {
  const aggregate = calculateRealUserValidationAggregate(realLearning.career_gps.decision_loop.shadow_learning);
  assert.equal(aggregate.cohort_state, REAL_USER_COHORT_STATES.INSUFFICIENT_REAL_DATA);
});

check("30+ runs satisfy sample gate but do not automatically satisfy review and safety gates", () => {
  const runs = Array.from({ length: 30 }, (_, index) => ({
    ...realLearning.realUserValidation,
    validation_id: `real_${index}`,
    user_id: `user_${index}`,
    alignment_class: ALIGNMENT_CLASSES.MEANINGFUL_DIVERGENCE,
    review_status: "pending",
  }));
  const aggregate = calculateRealUserValidationAggregate({ validation_runs: runs, human_reviews: [] });
  assert.equal(aggregate.complete_learning_cycles, 30);
  assert.equal(aggregate.cohort_state, REAL_USER_COHORT_STATES.EARLY_SIGNAL);
});

check("shadow failure does not break production", () => {
  const failed = runEvidenceCandidateShadowLearning({
    careerGps: strongOutcome.career_gps,
    profile: profileFor(strongOutcome.career_gps),
    candidate: strongOutcome.evidenceCandidate,
    action: strongOutcome.action,
    outcome: strongOutcome.outcome,
    productionSnapshot,
    validationSource: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
    observatoryRunner: () => {
      throw new Error("forced shadow failure");
    },
  });
  assert.equal(failed.failed, true);
  assert.equal(failed.career_gps.snapshot.recruiterTrust, 24);
  assert.equal(failed.realUserValidation.validation_status, "shadow_failed");
});

check("internal review queue prioritizes divergent runs", () => {
  const queue = buildInternalReviewQueue({
    validation_runs: [
      realLearning.realUserValidation,
      {
        ...realLearning.realUserValidation,
        validation_id: "review_required",
        review_classification: REVIEW_CLASSIFICATIONS.REVIEW_REQUIRED,
        review_priority: 100,
        review_status: "pending",
      },
    ],
  });
  assert.equal(queue[0].validation_id, "review_required");
  assert.equal(queue[0].safe_user_id.startsWith("user_"), true);
});

check("review event can be submitted without raw content", () => {
  const review = buildHumanReview({
    validationId: realLearning.realUserValidation.validation_id,
    judgment: REVIEW_JUDGMENTS.INSUFFICIENT_CONTEXT,
    notes: "compact note only",
  });
  assert.equal(review.validation_id, realLearning.realUserValidation.validation_id);
  assert.equal(review.status, "reviewed");
});

check("gap prioritization telemetry event is safe", () => {
  const eventStore = [];
  globalThis.window = { dataLayer: eventStore };
  trackActivationEvent("gap_prioritization_shadow_changed", {
    route: "/dashboard",
    lang: "EN",
    gap_comparison: realLearning.realUserValidation.gap_comparison.classification,
    validation_status: realLearning.realUserValidation.validation_status,
    raw_outcome: "private outcome text",
  });
  assert.equal(eventStore[0].raw_outcome, undefined);
  assert.equal(eventStore[0].gap_comparison, GAP_COMPARISON_CLASSES.CHANGED_UNEXPECTEDLY);
});

process.stdout.write(`Real-user shadow validation passed: ${passed}/22\n`);
