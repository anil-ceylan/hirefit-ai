import assert from "node:assert/strict";
import {
  buildActionId,
  buildDecisionId,
  getWeekKey,
  transitionAction,
  upsertActionOutcome,
  upsertRecommendedAction,
} from "../lib/careerActionLoop/actionModel.js";
import {
  calculateShadowLearningMetrics,
  classifyShadowLearningChange,
  evaluateEvidenceCandidate,
  runEvidenceCandidateShadowLearning,
} from "../lib/careerActionLoop/evidenceEvaluation.js";
import { trackActivationEvent } from "../src/utils/activationEvents.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  return name;
}

const userId = "00000000-0000-4000-8000-000000000064";
const otherUserId = "00000000-0000-4000-8000-000000000065";
const weekKey = getWeekKey(new Date("2026-08-19T09:00:00.000Z"));
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

function completedCareerGps() {
  const base = {
    snapshot: {
      readinessScore: 63,
      recruiterTrust: 24,
      primaryRoleMatch: { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
      topRoleMatches: [
        { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
        { roleName: "Business Analyst", fitPercentage: 54 },
      ],
      gapDetails: { title: "Stakeholder impact", action: baseAction.title },
    },
    decision_loop: {
      actions: [],
      outcomes: [],
      evidence_candidates: [],
    },
  };
  const recommended = upsertRecommendedAction(base, { ...baseAction, decision_id: decisionId, action_id: actionId }, {
    userId,
    now: "2026-08-19T09:00:00.000Z",
  });
  const started = transitionAction(recommended.career_gps, actionId, "started", {
    userId,
    now: "2026-08-19T09:01:00.000Z",
  });
  return transitionAction(started.career_gps, actionId, "completed", {
    userId,
    now: "2026-08-19T09:02:00.000Z",
  }).career_gps;
}

function saveOutcome(outcome, now = "2026-08-19T09:03:00.000Z", gps = completedCareerGps()) {
  return upsertActionOutcome(gps, actionId, outcome, { userId, now });
}

function profileFor(careerGps) {
  return {
    user_id: userId,
    career_gps: careerGps,
    career_snapshot: careerGps.snapshot,
    career_readiness: { score: 63 },
    projects: [
      {
        title: "HireFit workflow",
        description: "Built a career decision workflow for target role discovery.",
        occurred_at: "2026",
      },
    ],
  };
}

function fakeRun({
  runId,
  evidenceCount = 2,
  quality = 55,
  coverage = 50,
  recommendation = "Strategy & Operations Intern",
  confidence = 52,
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

const metricOutcome = saveOutcome({
  outcome_type: "COMPLETED_WITH_RESULT",
  summary: "Published a stakeholder-impact case example for the HireFit project.",
  measurable_result: "Added 2 stakeholder impact examples",
  proof_reference: "",
});

check("eligible candidate can be evaluated", () => {
  const result = evaluateEvidenceCandidate({
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
    now: "2026-08-19T09:04:00.000Z",
  });
  assert.ok(result.evaluation?.evaluation_id);
  assert.match(result.evaluation.status, /^evaluated_/);
});

check("insufficient candidate is not usable evidence", () => {
  const empty = saveOutcome({
    outcome_type: "COMPLETED_NO_RESULT",
    summary: "No result yet",
    measurable_result: "",
    proof_reference: "",
  });
  assert.equal(empty.candidateStatus, "insufficient");
  assert.equal(empty.evidenceCandidate, null);
});

check("URL presence is not verified evidence", () => {
  const proof = saveOutcome({
    outcome_type: "COMPLETED_WITH_RESULT",
    summary: "Published the stakeholder-impact case study.",
    measurable_result: "",
    proof_reference: "https://github.com/example/case",
  });
  const result = evaluateEvidenceCandidate({ candidate: proof.evidenceCandidate, action: proof.action, outcome: proof.outcome });
  assert.equal(result.evaluation.verification_status, "not_verified");
  assert.notEqual(result.evaluation.status, "verified");
});

check("metric presence is not verified evidence", () => {
  const result = evaluateEvidenceCandidate({
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
  });
  assert.equal(result.evaluation.verification_status, "not_verified");
  assert.notEqual(result.evaluation.support_level, "verified");
});

const interviewOutcome = saveOutcome({
  outcome_type: "INTERVIEW",
  summary: "Received an interview response after sending the revised project example.",
  measurable_result: "",
  proof_reference: "",
});

check("market-response evidence remains distinct from skill evidence", () => {
  const result = evaluateEvidenceCandidate({
    candidate: interviewOutcome.evidenceCandidate,
    action: interviewOutcome.action,
    outcome: interviewOutcome.outcome,
  });
  assert.equal(result.evaluation.candidate_type, "market_response");
  assert.equal(result.shadowEvidenceItem.metadata.market_response, true);
});

const shadowLearning = runEvidenceCandidateShadowLearning({
  careerGps: metricOutcome.career_gps,
  profile: profileFor(metricOutcome.career_gps),
  candidate: metricOutcome.evidenceCandidate,
  action: metricOutcome.action,
  outcome: metricOutcome.outcome,
  now: "2026-08-19T09:05:00.000Z",
});

check("production Snapshot remains unchanged", () => {
  assert.deepEqual(shadowLearning.career_gps.snapshot, metricOutcome.career_gps.snapshot);
});

check("production Career Readiness remains unchanged", () => {
  assert.equal(shadowLearning.career_gps.snapshot.readinessScore, 63);
});

check("production Recruiter Trust remains unchanged", () => {
  assert.equal(shadowLearning.career_gps.snapshot.recruiterTrust, 24);
});

check("production Role Fit remains unchanged", () => {
  assert.equal(shadowLearning.career_gps.snapshot.primaryRoleMatch.fitPercentage, 58);
});

check("production Weekly Decision remains unchanged", () => {
  assert.equal(shadowLearning.career_gps.decision_loop.actions[0].title, baseAction.title);
});

check("baseline shadow run excludes new candidate", () => {
  assert.ok(shadowLearning.comparison.baseline.evidence_count < shadowLearning.comparison.augmented.evidence_count);
});

check("augmented shadow run includes evaluated usable candidate", () => {
  assert.equal(shadowLearning.evaluation.usable_for_shadow, true);
  assert.ok(shadowLearning.comparison.augmented.evidence_count >= shadowLearning.comparison.baseline.evidence_count + 1);
});

check("comparison detects meaningful gap change", () => {
  const comparison = classifyShadowLearningChange({
    candidateId: "candidate_gap",
    evaluation: { evaluation_id: "eval_gap", status: "evaluated_usable" },
    baselineRun: fakeRun({ runId: "base_gap", gap: "stakeholder_impact" }),
    augmentedRun: fakeRun({ runId: "aug_gap", gap: "business_impact" }),
  });
  assert.equal(comparison.reasoning_change.gap_changed, true);
  assert.equal(comparison.material_change, true);
});

check("comparison detects recommendation change", () => {
  const comparison = classifyShadowLearningChange({
    candidateId: "candidate_rec",
    evaluation: { evaluation_id: "eval_rec", status: "evaluated_usable" },
    baselineRun: fakeRun({ runId: "base_rec", recommendation: "Business Analyst" }),
    augmentedRun: fakeRun({ runId: "aug_rec", recommendation: "Strategy & Operations Intern" }),
  });
  assert.equal(comparison.reasoning_change.recommendation_changed, true);
  assert.equal(comparison.material_change, true);
});

check("small noisy score movement is not material by itself", () => {
  const comparison = classifyShadowLearningChange({
    candidateId: "candidate_noise",
    evaluation: { evaluation_id: "eval_noise", status: "evaluated_usable" },
    baselineRun: fakeRun({ runId: "base_noise", quality: 55, coverage: 50, confidence: 52 }),
    augmentedRun: fakeRun({ runId: "aug_noise", quality: 57, coverage: 51, confidence: 53 }),
  });
  assert.equal(comparison.material_change, false);
});

check("increased uncertainty can count as meaningful learning", () => {
  const comparison = classifyShadowLearningChange({
    candidateId: "candidate_uncertainty",
    evaluation: { evaluation_id: "eval_uncertainty", status: "evaluated_usable" },
    baselineRun: fakeRun({ runId: "base_uncertainty", confidence: 70 }),
    augmentedRun: fakeRun({ runId: "aug_uncertainty", confidence: 58 }),
  });
  assert.equal(comparison.evidence_change.confidence_direction, "decreased");
  assert.equal(comparison.material_change, true);
});

check("contradiction emergence is detected", () => {
  const contradiction = saveOutcome({
    outcome_type: "COMPLETED_WITH_RESULT",
    summary: "Built and owned the stakeholder management work across the project.",
    measurable_result: "",
    proof_reference: "",
  });
  const result = evaluateEvidenceCandidate({
    candidate: contradiction.evidenceCandidate,
    action: contradiction.action,
    outcome: contradiction.outcome,
  });
  assert.equal(result.evaluation.status, "evaluated_conflicted");
  assert.ok(result.evaluation.contradictions.includes("high_ownership_without_outcome"));
});

check("candidate evaluation failure does not remove outcome", () => {
  const result = runEvidenceCandidateShadowLearning({
    careerGps: metricOutcome.career_gps,
    profile: profileFor(metricOutcome.career_gps),
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
    evaluator: () => {
      throw new Error("forced evaluation failure");
    },
  });
  assert.equal(result.failed, true);
  assert.equal(result.career_gps.decision_loop.outcomes.length, 1);
  assert.equal(result.career_gps.decision_loop.evidence_candidates.length, 1);
});

check("shadow reasoning failure does not remove candidate", () => {
  const result = runEvidenceCandidateShadowLearning({
    careerGps: metricOutcome.career_gps,
    profile: profileFor(metricOutcome.career_gps),
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
    observatoryRunner: () => {
      throw new Error("forced shadow failure");
    },
  });
  assert.equal(result.failed, true);
  assert.equal(result.evaluation.usable_for_shadow, true);
  assert.equal(result.career_gps.decision_loop.evidence_candidates.length, 1);
});

check("observatory failure does not break production flow", () => {
  const result = runEvidenceCandidateShadowLearning({
    careerGps: metricOutcome.career_gps,
    profile: profileFor(metricOutcome.career_gps),
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
    observatoryRunner: () => {
      throw new Error("observatory unavailable");
    },
  });
  assert.equal(result.failureStage, "shadow_reasoning");
  assert.equal(result.career_gps.snapshot.recruiterTrust, 24);
});

check("candidate edit supersedes previous evaluation", () => {
  const first = runEvidenceCandidateShadowLearning({
    careerGps: metricOutcome.career_gps,
    profile: profileFor(metricOutcome.career_gps),
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
    observatoryRunner: (input) => fakeRun({ runId: input.profile._shadow_augmented_evidence_ids ? "aug_first" : "base_first" }),
  });
  const edited = saveOutcome({
    outcome_type: "COMPLETED_WITH_RESULT",
    summary: "Published a stakeholder-impact case example for HireFit and added clearer business impact.",
    measurable_result: "Added 3 stakeholder impact examples",
    proof_reference: "",
  }, "2026-08-19T10:00:00.000Z", first.career_gps);
  const second = runEvidenceCandidateShadowLearning({
    careerGps: edited.career_gps,
    profile: profileFor(edited.career_gps),
    candidate: edited.evidenceCandidate,
    action: edited.action,
    outcome: edited.outcome,
    observatoryRunner: (input) => fakeRun({ runId: input.profile._shadow_augmented_evidence_ids ? "aug_second" : "base_second" }),
  });
  assert.equal(second.career_gps.decision_loop.shadow_learning.evaluations.length, 2);
  assert.equal(second.career_gps.decision_loop.shadow_learning.evaluations.some((item) => item.status === "superseded"), true);
});

check("duplicate evaluation requests are idempotent", () => {
  const first = runEvidenceCandidateShadowLearning({
    careerGps: metricOutcome.career_gps,
    profile: profileFor(metricOutcome.career_gps),
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
    observatoryRunner: (input) => fakeRun({ runId: input.profile._shadow_augmented_evidence_ids ? "aug_dup" : "base_dup" }),
  });
  const second = runEvidenceCandidateShadowLearning({
    careerGps: first.career_gps,
    profile: profileFor(first.career_gps),
    candidate: metricOutcome.evidenceCandidate,
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
    observatoryRunner: (input) => fakeRun({ runId: input.profile._shadow_augmented_evidence_ids ? "aug_dup" : "base_dup" }),
  });
  assert.equal(second.career_gps.decision_loop.shadow_learning.evaluations.length, 1);
  assert.equal(second.career_gps.decision_loop.shadow_learning.comparisons.length, 1);
});

check("User A cannot evaluate User B candidate", () => {
  const result = runEvidenceCandidateShadowLearning({
    careerGps: metricOutcome.career_gps,
    profile: profileFor(metricOutcome.career_gps),
    candidate: { ...metricOutcome.evidenceCandidate, user_id: otherUserId },
    action: metricOutcome.action,
    outcome: metricOutcome.outcome,
  });
  assert.equal(result.ownershipMismatch, true);
  assert.equal(result.evaluation, null);
});

check("analytics contain no raw sensitive content", () => {
  const eventStore = [];
  globalThis.window = { dataLayer: eventStore };
  trackActivationEvent("evidence_candidate_evaluated", {
    route: "/dashboard",
    lang: "TR",
    candidate_type: "artifact_reference",
    outcome_type: "COMPLETED_WITH_RESULT",
    evaluation_status: "evaluated_usable",
    usable_for_shadow: true,
    material_change: true,
    recommendation_changed: false,
    gap_changed: true,
    confidence_direction: "increased",
    claim: "Sensitive claim text",
    proof_reference: "https://private.example.test",
  });
  assert.equal(eventStore[0].claim, undefined);
  assert.equal(eventStore[0].proof_reference, undefined);
  assert.equal(eventStore[0].evaluation_status, "evaluated_usable");
});

check("shadow learning metrics are enabled", () => {
  const metrics = calculateShadowLearningMetrics(shadowLearning.career_gps.decision_loop.shadow_learning);
  assert.equal(metrics.evaluated_candidate_count, 1);
  assert.equal(metrics.usable_candidate_count, 1);
  assert.equal(typeof metrics.evidence_usability_rate, "number");
});

check("existing Sprint 6.3 outcome survives evaluated learning", () => {
  assert.equal(shadowLearning.career_gps.decision_loop.outcomes[0].outcome_id, metricOutcome.outcome.outcome_id);
  assert.equal(shadowLearning.career_gps.decision_loop.evidence_candidates[0].candidate_id, metricOutcome.evidenceCandidate.candidate_id);
});

process.stdout.write(`Evidence candidate evaluation validation passed: ${passed}/26\n`);
