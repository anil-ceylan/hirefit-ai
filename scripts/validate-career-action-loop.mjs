import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildActionId,
  buildDecisionId,
  findActionOutcome,
  getWeekKey,
  transitionAction,
  upsertActionOutcome,
  upsertRecommendedAction,
} from "../lib/careerActionLoop/actionModel.js";
import { trackActivationEvent } from "../src/utils/activationEvents.js";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";
const weekKey = getWeekKey(new Date("2026-08-10T12:00:00.000Z"));
const baseAction = {
  week_key: weekKey,
  title: "Write one stakeholder-impact project example.",
  reason: "Recruiters cannot yet verify stakeholder impact.",
  blocker: "Stakeholder impact proof is missing.",
  target_dimension: "stakeholder_impact",
  expected_evidence: "One short case example.",
  confidence: "Medium",
};

const decisionIdA = buildDecisionId({ weekKey, title: baseAction.title, blocker: baseAction.blocker });
const actionIdA = buildActionId({ userId, weekKey, decisionId: decisionIdA, title: baseAction.title });
const actionIdAgain = buildActionId({ userId, weekKey, decisionId: decisionIdA, title: baseAction.title });
assert.equal(actionIdA, actionIdAgain, "action identity must be stable for same user/week/decision");
assert.notEqual(
  actionIdA,
  buildActionId({ userId: otherUserId, weekKey, decisionId: decisionIdA, title: baseAction.title }),
  "different users must not share action identity"
);

const existingCareerGps = {
  snapshot: {
    readinessScore: 63,
    recruiterTrust: 24,
    primaryRoleMatch: { roleName: "Strategy & Operations Intern", fitPercentage: 58 },
  },
  identity_v3: { primaryIdentity: "Startup Builder + Operator" },
  decision_loop: {
    actions: [],
    outcomes: [],
    evidence_candidates: [],
    last_updated_at: null,
  },
};

const recommended = upsertRecommendedAction(existingCareerGps, { ...baseAction, decision_id: decisionIdA }, {
  userId,
  now: "2026-08-10T12:00:00.000Z",
});
assert.equal(recommended.action.status, "recommended");
assert.equal(recommended.career_gps.snapshot.readinessScore, 63, "upsert must preserve snapshot scores");
assert.deepEqual(recommended.career_gps.decision_loop.outcomes, [], "upsert must not create outcomes");
assert.deepEqual(recommended.career_gps.decision_loop.evidence_candidates, [], "upsert must not create evidence");

const duplicate = upsertRecommendedAction(recommended.career_gps, { ...baseAction, decision_id: decisionIdA }, {
  userId,
  now: "2026-08-10T12:01:00.000Z",
});
assert.equal(duplicate.career_gps.decision_loop.actions.length, 1, "duplicate recommended upsert must be idempotent");

const started = transitionAction(duplicate.career_gps, duplicate.action.action_id, "started", {
  now: "2026-08-10T12:02:00.000Z",
});
assert.equal(started.action.status, "started");
assert.ok(started.action.started_at, "started action must record started_at");

const duplicateStart = transitionAction(started.career_gps, duplicate.action.action_id, "started", {
  now: "2026-08-10T12:03:00.000Z",
});
assert.equal(duplicateStart.action.started_at, started.action.started_at, "duplicate START must not overwrite started_at");

const completed = transitionAction(duplicateStart.career_gps, duplicate.action.action_id, "completed", {
  now: "2026-08-10T12:04:00.000Z",
});
assert.equal(completed.action.status, "completed");
assert.ok(completed.action.completed_at, "completed action must record completed_at");

const duplicateComplete = transitionAction(completed.career_gps, duplicate.action.action_id, "completed", {
  now: "2026-08-10T12:05:00.000Z",
});
assert.equal(duplicateComplete.action.completed_at, completed.action.completed_at, "duplicate COMPLETE must not overwrite completed_at");
assert.equal(duplicateComplete.career_gps.snapshot.recruiterTrust, 24, "completion must not change recruiter trust");
assert.equal(duplicateComplete.career_gps.snapshot.primaryRoleMatch.fitPercentage, 58, "completion must not change role fit");
assert.deepEqual(duplicateComplete.career_gps.decision_loop.evidence_candidates, [], "completion must not create evidence");

const invalidDirectComplete = transitionAction(recommended.career_gps, recommended.action.action_id, "completed", {
  now: "2026-08-10T12:06:00.000Z",
});
assert.equal(invalidDirectComplete.invalidTransition, true, "recommended -> completed direct transition must be blocked");

const missing = transitionAction(completed.career_gps, "weekly_missing", "started");
assert.equal(missing.notFound, true, "unknown action should not be modified");

const outcomeInput = {
  outcome_type: "COMPLETED_WITH_RESULT",
  summary: "Published one stakeholder-impact case example.",
  measurable_result: "One case study added",
  proof_reference: "https://example.test/case",
};
const outcomeSaved = upsertActionOutcome(completed.career_gps, duplicate.action.action_id, outcomeInput, {
  userId,
  now: "2026-08-10T12:07:00.000Z",
});
assert.equal(outcomeSaved.outcome.action_id, duplicate.action.action_id, "completed action can receive outcome");
assert.equal(outcomeSaved.outcome.evidence_status, "candidate_created", "specific outcome should create an evidence candidate");
assert.equal(outcomeSaved.candidateStatus, "candidate_created", "API model should expose candidate status");
assert.ok(outcomeSaved.evidenceCandidate?.candidate_id, "eligible outcome should return candidate");
assert.equal(outcomeSaved.evidenceCandidate.evaluation_status, "not_evaluated", "candidate must not become evaluated evidence");
assert.equal(outcomeSaved.evidenceCandidate.provenance.verified, false, "candidate provenance must stay unverified");
assert.equal(outcomeSaved.evidenceCandidate.action_id, duplicate.action.action_id, "candidate must link to action");
assert.equal(outcomeSaved.evidenceCandidate.outcome_id, outcomeSaved.outcome.outcome_id, "candidate must link to outcome");
assert.equal(outcomeSaved.evidenceCandidate.user_id, userId, "candidate must link to authenticated user");
assert.equal(outcomeSaved.evidenceCandidate.candidate_type, "measurable_outcome_claim", "metric outcome should become measurable candidate");
assert.equal(findActionOutcome(outcomeSaved.career_gps, duplicate.action.action_id)?.summary, outcomeInput.summary, "outcome can be retrieved after persistence");
assert.equal(outcomeSaved.career_gps.decision_loop.actions.length, 1, "existing actions survive outcome persistence");
assert.equal(outcomeSaved.career_gps.snapshot.readinessScore, 63, "snapshot remains unchanged after outcome");
assert.equal(outcomeSaved.career_gps.snapshot.recruiterTrust, 24, "recruiter trust remains unchanged after outcome");
assert.equal(outcomeSaved.career_gps.snapshot.primaryRoleMatch.fitPercentage, 58, "role fit remains unchanged after outcome");
assert.equal(outcomeSaved.career_gps.decision_loop.evidence_candidates.length, 1, "eligible outcome creates one candidate");

const duplicateOutcome = upsertActionOutcome(outcomeSaved.career_gps, duplicate.action.action_id, outcomeInput, {
  userId,
  now: "2026-08-10T12:08:00.000Z",
});
assert.equal(duplicateOutcome.career_gps.decision_loop.outcomes.length, 1, "duplicate outcome submission must be idempotent");
assert.equal(duplicateOutcome.career_gps.decision_loop.evidence_candidates.length, 1, "duplicate outcome must not duplicate candidate");
assert.equal(
  duplicateOutcome.evidenceCandidate.candidate_id,
  outcomeSaved.evidenceCandidate.candidate_id,
  "duplicate outcome must reuse canonical candidate identity"
);

const editedOutcome = upsertActionOutcome(duplicateOutcome.career_gps, duplicate.action.action_id, {
  ...outcomeInput,
  summary: "Updated stakeholder-impact case example.",
  measurable_result: "2 stakeholder examples added",
}, {
  userId,
  now: "2026-08-10T12:09:00.000Z",
});
assert.equal(editedOutcome.career_gps.decision_loop.outcomes.length, 1, "editing outcome must not duplicate canonical outcome");
assert.equal(editedOutcome.career_gps.decision_loop.evidence_candidates.length, 1, "editing outcome must not duplicate candidate");
assert.equal(editedOutcome.outcome.outcome_id, outcomeSaved.outcome.outcome_id, "editing outcome must preserve outcome identity");
assert.equal(editedOutcome.outcome.summary, "Updated stakeholder-impact case example.");
assert.equal(editedOutcome.evidenceCandidate.candidate_id, outcomeSaved.evidenceCandidate.candidate_id, "editing outcome must preserve candidate identity");
assert.equal(editedOutcome.evidenceCandidate.measurable_result, "2 stakeholder examples added", "editing outcome must update candidate content");

const ineligibleEdit = upsertActionOutcome(editedOutcome.career_gps, duplicate.action.action_id, {
  outcome_type: "COMPLETED_WITH_RESULT",
  summary: "I learned and got better.",
  measurable_result: "",
  proof_reference: "",
}, {
  userId,
  now: "2026-08-10T12:10:00.000Z",
});
assert.equal(ineligibleEdit.candidateStatus, "insufficient", "vague edited outcome should be insufficient");
assert.equal(ineligibleEdit.outcome.evidence_status, "insufficient", "vague edited outcome must not be candidate-created");
assert.equal(ineligibleEdit.career_gps.decision_loop.evidence_candidates.length, 1, "ineligible edit must not create extra candidates");
assert.equal(ineligibleEdit.evidenceCandidate.evaluation_status, "ineligible", "ineligible edit should invalidate existing candidate");

const emptyOutcome = upsertActionOutcome(completed.career_gps, duplicate.action.action_id, {
  outcome_type: "COMPLETED_NO_RESULT",
  summary: "No result yet",
  measurable_result: "",
  proof_reference: "",
}, {
  userId,
  now: "2026-08-10T12:11:00.000Z",
});
assert.equal(emptyOutcome.candidateStatus, "insufficient", "no-result outcome should not create a candidate");
assert.equal(emptyOutcome.evidenceCandidate, null, "no-result outcome should return no candidate");
assert.equal(emptyOutcome.career_gps.decision_loop.evidence_candidates.length, 0, "no-result outcome should not persist candidate");

const describedOutcome = upsertActionOutcome(completed.career_gps, duplicate.action.action_id, {
  outcome_type: "PARTIAL_RESULT",
  summary: "Completed one Strategy & Operations case example and added it to the project section.",
  measurable_result: "",
  proof_reference: "",
}, {
  userId,
  now: "2026-08-10T12:12:00.000Z",
});
assert.equal(describedOutcome.candidateStatus, "candidate_created", "specific described outcome should create candidate");
assert.equal(describedOutcome.evidenceCandidate.candidate_type, "described_outcome", "specific described outcome should be typed correctly");
assert.equal(describedOutcome.evidenceCandidate.preliminary_trust, "self_reported", "described outcome stays self-reported");

const proofOutcome = upsertActionOutcome(completed.career_gps, duplicate.action.action_id, {
  outcome_type: "COMPLETED_WITH_RESULT",
  summary: "Published the stakeholder-impact case study.",
  measurable_result: "",
  proof_reference: "https://github.com/example/case",
}, {
  userId,
  now: "2026-08-10T12:13:00.000Z",
});
assert.equal(proofOutcome.candidateStatus, "candidate_created", "proof reference should create candidate");
assert.equal(proofOutcome.evidenceCandidate.candidate_type, "artifact_reference", "proof reference should be typed as artifact reference");
assert.equal(proofOutcome.evidenceCandidate.source_type, "github", "GitHub proof reference should reuse evidence source vocabulary");
assert.equal(proofOutcome.evidenceCandidate.preliminary_trust, "referenced_not_verified", "proof reference is not externally verified in 6.3");

const marketOutcome = upsertActionOutcome(completed.career_gps, duplicate.action.action_id, {
  outcome_type: "INTERVIEW",
  summary: "Received an interview response after sending the revised project example.",
  measurable_result: "",
  proof_reference: "",
}, {
  userId,
  now: "2026-08-10T12:14:00.000Z",
});
assert.equal(marketOutcome.candidateStatus, "candidate_created", "market response should create candidate");
assert.equal(marketOutcome.evidenceCandidate.candidate_type, "market_response", "interview outcome is a market-response signal");
assert.equal(marketOutcome.evidenceCandidate.preliminary_trust, "market_signal_self_reported", "market response remains self-reported");

const nonexistentOutcome = upsertActionOutcome(completed.career_gps, "weekly_missing", outcomeInput, { userId });
assert.equal(nonexistentOutcome.notFound, true, "nonexistent action cannot receive outcome");

const otherUserOutcome = upsertActionOutcome(completed.career_gps, duplicate.action.action_id, outcomeInput, { userId: otherUserId });
assert.equal(otherUserOutcome.ownershipMismatch, true, "User A cannot add outcome to User B action");

const notCompletedOutcome = upsertActionOutcome(started.career_gps, duplicate.action.action_id, outcomeInput, { userId });
assert.equal(notCompletedOutcome.invalidState, true, "non-completed action cannot receive outcome");
assert.equal(started.career_gps.decision_loop.actions[0].status, "started", "failed outcome persistence must not corrupt action");

const eventStore = [];
globalThis.window = { dataLayer: eventStore };
trackActivationEvent("weekly_action_outcome_submitted", {
  route: "/dashboard",
  lang: "TR",
  action_type: "weekly_career_move",
  outcome_type: "COMPLETED_WITH_RESULT",
  has_summary: true,
  has_measurable_result: true,
  has_proof_reference: true,
  summary: outcomeInput.summary,
  proof_reference: outcomeInput.proof_reference,
});
const eventPayload = eventStore[0] || {};
assert.equal(eventPayload.summary, undefined, "analytics must not receive raw outcome summary");
assert.equal(eventPayload.proof_reference, undefined, "analytics must not receive raw proof reference");
assert.equal(eventPayload.has_summary, true, "analytics may receive safe outcome booleans");

trackActivationEvent("evidence_candidate_created", {
  route: "/dashboard",
  lang: "TR",
  candidate_type: proofOutcome.evidenceCandidate.candidate_type,
  outcome_type: "COMPLETED_WITH_RESULT",
  has_metric: false,
  has_proof_reference: true,
  quality_signal_count: 5,
  claim: proofOutcome.evidenceCandidate.claim,
  proof_reference: proofOutcome.evidenceCandidate.proof_reference,
});
const candidateEventPayload = eventStore[1] || {};
assert.equal(candidateEventPayload.claim, undefined, "candidate analytics must not receive raw claim text");
assert.equal(candidateEventPayload.proof_reference, undefined, "candidate analytics must not receive proof reference text");
assert.equal(candidateEventPayload.candidate_type, "artifact_reference", "candidate analytics may receive safe candidate type");
assert.equal(candidateEventPayload.has_proof_reference, true, "candidate analytics may receive proof-reference boolean");

trackActivationEvent("evidence_candidate_insufficient", {
  route: "/dashboard",
  lang: "TR",
  outcome_type: "COMPLETED_NO_RESULT",
  has_metric: false,
  has_proof_reference: false,
  quality_signal_count: 1,
  summary: "No result yet",
});
const insufficientEventPayload = eventStore[2] || {};
assert.equal(insufficientEventPayload.summary, undefined, "insufficient analytics must not receive raw summary text");
assert.equal(insufficientEventPayload.quality_signal_count, 1, "insufficient analytics may receive quality signal count");

const actionModelSource = readFileSync("lib/careerActionLoop/actionModel.js", "utf8");
assert.equal(/evaluateEvidenceSet|observeDecisionRun|runShadowReasoning/.test(actionModelSource), false, "6.3 must not trigger evidence evaluation, reasoning, or observatory");
assert.equal(/verified_outcome|accepted|trusted/.test(actionModelSource), false, "candidate model must not use verified/accepted/trusted status language");

const dashboardSource = readFileSync("src/components/dashboard/WeeklyDecisionCenter.jsx", "utf8");
assert.ok(
  dashboardSource.includes("Sonucun kaydedildi ve değerlendirilmek üzere bir kanıt adayı oluşturuldu."),
  "dashboard should show candidate-created copy"
);
assert.ok(dashboardSource.includes("Sonucun kaydedildi."), "dashboard should show neutral insufficient copy");

process.stdout.write("Career action loop validation passed: Sprint 6.3 checks passed\n");
