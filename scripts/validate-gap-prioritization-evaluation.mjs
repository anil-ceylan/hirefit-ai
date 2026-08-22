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
import { ALIGNMENT_CLASSES, FAILURE_CODES } from "../lib/careerActionLoop/promotionReadiness.js";
import { VALIDATION_SOURCE_KINDS } from "../lib/careerActionLoop/realUserShadowValidation.js";
import {
  GAP_DATA_SUFFICIENCY,
  GAP_OUTCOME_SIGNALS,
  GAP_PROMOTION_STATES,
  GAP_RELATIONSHIP_CLASSES,
  GAP_REVIEW_JUDGMENTS,
  GAP_WINNER_CLASSIFICATIONS,
  SHADOW_GAP_CHANGE_REASONS,
  buildGapEvaluation,
  buildGapHumanReview,
  calculateGapPrioritizationMetrics,
  classifyGapOutcomeSignal,
  classifyGapRelationship,
  classifyShadowGapChangeReason,
  linkFollowupOutcomeToGapEvaluation,
  upsertGapHumanReview,
} from "../lib/careerActionLoop/gapPrioritizationEvaluation.js";
import { trackActivationEvent } from "../src/utils/activationEvents.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  return name;
}

const userId = "00000000-0000-4000-8000-000000000167";
const weekKey = getWeekKey(new Date("2026-08-19T13:00:00.000Z"));
const productionSnapshot = {
  readinessScore: 63,
  recruiterTrust: 24,
  primaryRoleMatch: { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
  gapDetails: { title: "Stakeholder Impact" },
};
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
        gap_evaluations: [],
        gap_human_reviews: [],
        failures: [],
      },
    },
  };
  const recommended = upsertRecommendedAction(base, { ...baseAction, decision_id: decisionId, action_id: actionId }, {
    userId,
    now: "2026-08-19T13:00:00.000Z",
  });
  const started = transitionAction(recommended.career_gps, actionId, "started", {
    userId,
    now: "2026-08-19T13:01:00.000Z",
  });
  return transitionAction(started.career_gps, actionId, "completed", {
    userId,
    now: "2026-08-19T13:02:00.000Z",
  }).career_gps;
}

function saveOutcome(outcome, gps = makeCompletedGps(), now = "2026-08-19T13:03:00.000Z") {
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

function fakeRun({ runId, gap = "stakeholder_impact", confidence = 55, evidenceCount = 3 } = {}) {
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
          id: "strategy_operations_intern",
          label: "Strategy & Operations Intern",
          decisionConfidence: confidence,
        },
        recommendations: [{ label: "Strategy & Operations Intern", decisionConfidence: confidence }],
        missingEvidence: { primaryMissingEvidence: { competency: gap } },
        conflicts: { items: [] },
        hypotheses: [{ competency: "operations", confidence }],
      },
    },
    warnings: [],
  };
}

const outcome = saveOutcome({
  outcome_type: "COMPLETED_WITH_RESULT",
  summary: "Published a stakeholder-impact case example for the HireFit project.",
  measurable_result: "Added 3 stakeholder impact examples",
  proof_reference: "",
});

const learning = runEvidenceCandidateShadowLearning({
  careerGps: outcome.career_gps,
  profile: profileFor(outcome.career_gps),
  candidate: outcome.evidenceCandidate,
  action: outcome.action,
  outcome: outcome.outcome,
  productionSnapshot,
  validationSource: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
  observatoryRunner: (input) =>
    fakeRun(input.profile._shadow_augmented_evidence_ids
      ? { runId: "aug_gap_eval", gap: "quantified_outcomes", confidence: 64, evidenceCount: 4 }
      : { runId: "base_gap_eval", gap: "stakeholder_impact", confidence: 55, evidenceCount: 3 }),
});

check("identical canonical gaps classify SAME_GAP", () => {
  const result = classifyGapRelationship({ productionGap: "Stakeholder Impact", shadowGap: "Stakeholder Impact" });
  assert.equal(result.classification, GAP_RELATIONSHIP_CLASSES.SAME_GAP);
});

check("semantically mapped gaps classify SEMANTICALLY_SIMILAR", () => {
  const result = classifyGapRelationship({ productionGap: "Stakeholder impact", shadowGap: "Cross-functional influence evidence" });
  assert.equal(result.classification, GAP_RELATIONSHIP_CLASSES.SEMANTICALLY_SIMILAR);
});

check("narrower shadow bottleneck can classify SHADOW_REFINEMENT", () => {
  const result = classifyGapRelationship({ productionGap: "Need stronger portfolio", shadowGap: "Quantified product case study" });
  assert.equal(result.classification, GAP_RELATIONSHIP_CLASSES.SHADOW_REFINEMENT);
});

check("unrelated dimensions classify MEANINGFUL_DIFFERENCE", () => {
  const result = classifyGapRelationship({ productionGap: "Leadership evidence", shadowGap: "SQL proof" });
  assert.equal(result.classification, GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE);
});

check("ambiguous mapping does not fake certainty", () => {
  const result = classifyGapRelationship({ productionGap: "better vibes", shadowGap: "unclear fit" });
  assert.equal(result.classification, GAP_RELATIONSHIP_CLASSES.INSUFFICIENT_SIGNAL);
});

check("new evidence filling previous gap can produce correct reason code", () => {
  const reason = classifyShadowGapChangeReason({
    evaluation: { trust: 70, strength: 70, usable_for_shadow: true },
    comparison: {
      material_change: true,
      reasoning_change: { gap_changed: true },
      baseline: { strongest_gap: "stakeholder_impact" },
      augmented: { strongest_gap: "quantified_outcomes" },
    },
    relationship: { classification: GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE },
  });
  assert.equal(reason, SHADOW_GAP_CHANGE_REASONS.NEW_EVIDENCE_FILLED_PREVIOUS_GAP);
});

check("rejection does not automatically prove production or shadow gap correct", () => {
  const signal = classifyGapOutcomeSignal({
    gapEvaluation: learning.gapEvaluation,
    followupOutcome: { outcome_id: "outcome_rej", outcome_type: "REJECTION" },
  });
  assert.equal(signal, GAP_OUTCOME_SIGNALS.INCONCLUSIVE);
});

check("offer does not automatically prove unrelated capability gap correct", () => {
  const signal = classifyGapOutcomeSignal({
    gapEvaluation: learning.gapEvaluation,
    followupOutcome: { outcome_id: "outcome_offer", outcome_type: "OFFER" },
  });
  assert.equal(signal, GAP_OUTCOME_SIGNALS.INCONCLUSIVE);
});

check("follow-up action and outcome can link to prior gap evaluation", () => {
  const linked = linkFollowupOutcomeToGapEvaluation(learning.gapEvaluation, {
    action: { action_id: "next_action", target_dimension: "quantified_outcomes" },
    outcome: { outcome_id: "next_outcome", outcome_type: "COMPLETED_WITH_RESULT" },
    evaluation: { evaluation_id: "next_eval", usable_for_shadow: true },
  });
  assert.equal(linked.subsequent_action_id, "next_action");
  assert.equal(linked.outcome_signal, GAP_OUTCOME_SIGNALS.SUPPORTS_SHADOW);
});

check("missing follow-up remains NO_FOLLOWUP_YET", () => {
  assert.equal(learning.gapEvaluation.outcome_signal, GAP_OUTCOME_SIGNALS.NO_FOLLOWUP_YET);
});

check("human reviewer can mark shadow better", () => {
  const review = buildGapHumanReview({
    gapEvaluationId: learning.gapEvaluation.gap_evaluation_id,
    judgment: GAP_REVIEW_JUDGMENTS.SHADOW_BETTER,
  });
  const updated = upsertGapHumanReview(learning.career_gps.decision_loop.shadow_learning, {
    gapEvaluationId: learning.gapEvaluation.gap_evaluation_id,
    judgment: GAP_REVIEW_JUDGMENTS.SHADOW_BETTER,
  });
  assert.equal(review.judgment, GAP_REVIEW_JUDGMENTS.SHADOW_BETTER);
  assert.equal(updated.gap_evaluations[0].winner_classification, GAP_WINNER_CLASSIFICATIONS.SHADOW_DIRECTIONALLY_BETTER);
});

check("human reviewer can mark production better", () => {
  const updated = upsertGapHumanReview(learning.career_gps.decision_loop.shadow_learning, {
    gapEvaluationId: learning.gapEvaluation.gap_evaluation_id,
    judgment: GAP_REVIEW_JUDGMENTS.PRODUCTION_BETTER,
  });
  assert.equal(updated.gap_evaluations[0].winner_classification, GAP_WINNER_CLASSIFICATIONS.PRODUCTION_DIRECTIONALLY_BETTER);
});

check("duplicate review remains idempotent", () => {
  const first = upsertGapHumanReview(learning.career_gps.decision_loop.shadow_learning, {
    gapEvaluationId: learning.gapEvaluation.gap_evaluation_id,
    judgment: GAP_REVIEW_JUDGMENTS.BOTH_REASONABLE,
  });
  const second = upsertGapHumanReview(first, {
    gapEvaluationId: learning.gapEvaluation.gap_evaluation_id,
    judgment: GAP_REVIEW_JUDGMENTS.SHADOW_BETTER,
  });
  assert.equal(second.gap_human_reviews.length, 1);
  assert.equal(second.gap_human_reviews[0].judgment, GAP_REVIEW_JUDGMENTS.SHADOW_BETTER);
});

check("synthetic users do not affect real-user gap metrics", () => {
  const synthetic = {
    ...learning.gapEvaluation,
    gap_evaluation_id: "synthetic_gap",
    source_kind: VALIDATION_SOURCE_KINDS.SYNTHETIC,
    is_real_user: false,
  };
  const metrics = calculateGapPrioritizationMetrics({ gap_evaluations: [learning.gapEvaluation, synthetic] });
  assert.equal(metrics.gap_evaluation_count, 1);
});

check("production strongest gap remains unchanged", () => {
  assert.equal(learning.career_gps.snapshot.gapDetails.title, "Stakeholder Impact");
});

check("Weekly Decision remains unchanged", () => {
  assert.equal(learning.career_gps.decision_loop.actions[0].title, baseAction.title);
});

check("Career scores remain unchanged", () => {
  assert.equal(learning.career_gps.snapshot.readinessScore, 63);
  assert.equal(learning.career_gps.snapshot.recruiterTrust, 24);
  assert.equal(learning.career_gps.snapshot.primaryRoleMatch.fitPercentage, 58);
});

check("unsafe comparison cannot be promoted", () => {
  const unsafe = buildGapEvaluation({
    validationRun: {
      ...learning.realUserValidation,
      failure_flags: [FAILURE_CODES.UNSAFE_DIVERGENCE],
      alignment_class: ALIGNMENT_CLASSES.UNSAFE_DIVERGENCE,
    },
    evaluation: learning.evaluation,
    comparison: learning.comparison,
    productionSnapshot,
  });
  assert.equal(unsafe.winner_classification, GAP_WINNER_CLASSIFICATIONS.UNSAFE_TO_COMPARE);
});

check("30 runs alone do not guarantee experiment readiness", () => {
  const sameRuns = Array.from({ length: 30 }, (_, index) => ({
    ...learning.gapEvaluation,
    gap_evaluation_id: `same_${index}`,
    user_id: `user_${index}`,
    relationship_class: GAP_RELATIONSHIP_CLASSES.SAME_GAP,
  }));
  const metrics = calculateGapPrioritizationMetrics({ gap_evaluations: sameRuns });
  assert.equal(metrics.data_sufficiency, GAP_DATA_SUFFICIENCY.NOT_ENOUGH_DIVERGENCE);
  assert.equal(metrics.promotion_state, GAP_PROMOTION_STATES.OBSERVE_MORE);
});

check("missing review coverage blocks readiness", () => {
  const divergentRuns = Array.from({ length: 30 }, (_, index) => ({
    ...learning.gapEvaluation,
    gap_evaluation_id: `divergent_${index}`,
    user_id: `user_${index}`,
    relationship_class: GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE,
    outcome_signal: GAP_OUTCOME_SIGNALS.SUPPORTS_SHADOW,
  }));
  const metrics = calculateGapPrioritizationMetrics({ gap_evaluations: divergentRuns, gap_human_reviews: [] });
  assert.equal(metrics.data_sufficiency, GAP_DATA_SUFFICIENCY.NOT_ENOUGH_REVIEW);
});

check("missing follow-up outcomes blocks readiness", () => {
  const divergentRuns = Array.from({ length: 30 }, (_, index) => ({
    ...learning.gapEvaluation,
    gap_evaluation_id: `reviewed_${index}`,
    user_id: `user_${index}`,
    relationship_class: GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE,
    human_judgment: GAP_REVIEW_JUDGMENTS.SHADOW_BETTER,
  }));
  const reviews = divergentRuns.map((item) => ({
    gap_review_id: `review_${item.gap_evaluation_id}`,
    gap_evaluation_id: item.gap_evaluation_id,
    judgment: GAP_REVIEW_JUDGMENTS.SHADOW_BETTER,
  }));
  const metrics = calculateGapPrioritizationMetrics({ gap_evaluations: divergentRuns, gap_human_reviews: reviews });
  assert.equal(metrics.data_sufficiency, GAP_DATA_SUFFICIENCY.NOT_ENOUGH_FOLLOWUP_OUTCOMES);
});

check("privacy telemetry contains no raw user content", () => {
  const eventStore = [];
  globalThis.window = { dataLayer: eventStore };
  trackActivationEvent("gap_prioritization_shadow_changed", {
    route: "/dashboard",
    lang: "TR",
    gap_relationship: learning.gapEvaluation.relationship_class,
    shadow_gap_change_reason: learning.gapEvaluation.shadow_change_reason,
    gap_outcome_signal: learning.gapEvaluation.outcome_signal,
    gap_winner_classification: learning.gapEvaluation.winner_classification,
    claim: "raw private evidence claim",
    proof_reference: "https://private.example.test",
    raw_outcome: "private outcome detail",
  });
  assert.equal(eventStore[0].claim, undefined);
  assert.equal(eventStore[0].proof_reference, undefined);
  assert.equal(eventStore[0].raw_outcome, undefined);
  assert.equal(eventStore[0].gap_relationship, learning.gapEvaluation.relationship_class);
});

check("gap evaluation is persisted during shadow learning", () => {
  assert.equal(learning.career_gps.decision_loop.shadow_learning.gap_evaluations.length, 1);
  assert.equal(learning.career_gps.decision_loop.shadow_learning.gap_prioritization_summary.gap_evaluation_count, 1);
});

check("real-user gap metrics expose observe-more state", () => {
  const metrics = calculateGapPrioritizationMetrics(learning.career_gps.decision_loop.shadow_learning);
  assert.equal(metrics.data_sufficiency, GAP_DATA_SUFFICIENCY.NOT_ENOUGH_RUNS);
  assert.equal(metrics.promotion_state, GAP_PROMOTION_STATES.OBSERVE_MORE);
});

check("limited experiment ready is never returned by default TBD gates", () => {
  const runs = Array.from({ length: 30 }, (_, index) => ({
    ...learning.gapEvaluation,
    gap_evaluation_id: `followed_${index}`,
    user_id: `user_${index}`,
    relationship_class: GAP_RELATIONSHIP_CLASSES.MEANINGFUL_DIFFERENCE,
    outcome_signal: GAP_OUTCOME_SIGNALS.SUPPORTS_SHADOW,
    human_judgment: GAP_REVIEW_JUDGMENTS.SHADOW_BETTER,
  }));
  const reviews = runs.map((item) => ({
    gap_review_id: `review_${item.gap_evaluation_id}`,
    gap_evaluation_id: item.gap_evaluation_id,
    judgment: GAP_REVIEW_JUDGMENTS.SHADOW_BETTER,
  }));
  const metrics = calculateGapPrioritizationMetrics({ gap_evaluations: runs, gap_human_reviews: reviews });
  assert.notEqual(metrics.promotion_state, GAP_PROMOTION_STATES.LIMITED_EXPERIMENT_READY);
});

process.stdout.write(`Gap prioritization evaluation validation passed: ${passed}/25\n`);

