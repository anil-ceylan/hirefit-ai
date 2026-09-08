import { getServiceClient } from "../careerMemory/persistence.js";
import {
  getWeekKey,
  findActionOutcome,
  normalizeDecisionLoop,
  transitionAction,
  upsertActionOutcome,
  upsertRecommendedAction,
} from "./actionModel.js";
import { runEvidenceCandidateShadowLearning } from "./evidenceEvaluation.js";
import {
  VALIDATION_SOURCE_KINDS,
  calculateRealUserValidationAggregate,
} from "./realUserShadowValidation.js";

async function loadProfileRow(userId) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return { row: null, storageUnavailable: true };
  const { data, error } = await supabase
    .from("career_profiles")
    .select("user_id, career_gps, career_readiness, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[career-action-loop:load]", error?.message || error);
    return { row: null, storageUnavailable: true };
  }
  return { row: data || null, storageUnavailable: false };
}

async function saveCareerGps(userId, careerGps, expectedRow) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return { row: null, storageUnavailable: true };
  // Compare against the version read by this operation. Advance the timestamp
  // even when two writes occur in the same millisecond.
  const updatedAt = new Date(Math.max(Date.now(), (Date.parse(expectedRow.updated_at) || 0) + 1)).toISOString();
  let query = supabase
    .from("career_profiles")
    .update({
      career_gps: careerGps,
      updated_at: updatedAt,
    })
    .eq("user_id", userId);
  query = expectedRow.updated_at == null
    ? query.is("updated_at", null)
    : query.eq("updated_at", expectedRow.updated_at);
  const { data, error } = await query
    .select("user_id, career_gps, updated_at")
    .maybeSingle();
  if (error) {
    console.error("[career-action-loop:save]", error?.message || error);
    return { row: null, storageUnavailable: true };
  }
  // A concurrent write won. Fail closed; retry must reload the latest document.
  return { row: data, storageUnavailable: !data };
}

function findRelevantAction(careerGps = {}, { actionId = "", weekKey = getWeekKey() } = {}) {
  const loop = normalizeDecisionLoop(careerGps);
  if (actionId) return loop.actions.find((action) => action.action_id === actionId) || null;
  return loop.actions.find((action) => action.week_key === weekKey) || null;
}

export async function getCurrentCareerAction(userId, { actionId = "", weekKey = getWeekKey() } = {}) {
  const loaded = await loadProfileRow(userId);
  if (loaded.storageUnavailable) return { action: null, storageUnavailable: true };
  const action = findRelevantAction(loaded.row?.career_gps || {}, { actionId, weekKey });
  return { action, storageUnavailable: false };
}

export async function upsertRecommendedCareerAction(userId, actionInput = {}) {
  const loaded = await loadProfileRow(userId);
  if (loaded.storageUnavailable || !loaded.row) return { action: null, storageUnavailable: true };
  const result = upsertRecommendedAction(loaded.row.career_gps || {}, actionInput, { userId });
  const saved = await saveCareerGps(userId, result.career_gps, loaded.row);
  if (saved.storageUnavailable) return { action: null, storageUnavailable: true };
  return { action: result.action, created: result.created, storageUnavailable: false };
}

export async function startCareerAction(userId, actionId) {
  const loaded = await loadProfileRow(userId);
  if (loaded.storageUnavailable || !loaded.row) return { action: null, storageUnavailable: true };
  const result = transitionAction(loaded.row.career_gps || {}, actionId, "started", { userId });
  if (result.notFound) return { action: null, notFound: true, storageUnavailable: false };
  const saved = await saveCareerGps(userId, result.career_gps, loaded.row);
  if (saved.storageUnavailable) return { action: null, storageUnavailable: true };
  return { action: result.action, changed: result.changed, storageUnavailable: false };
}

export async function completeCareerAction(userId, actionId) {
  const loaded = await loadProfileRow(userId);
  if (loaded.storageUnavailable || !loaded.row) return { action: null, storageUnavailable: true };
  const result = transitionAction(loaded.row.career_gps || {}, actionId, "completed", { userId });
  if (result.notFound) return { action: null, notFound: true, storageUnavailable: false };
  if (result.invalidTransition) return { action: result.action, invalidTransition: true, storageUnavailable: false };
  const saved = await saveCareerGps(userId, result.career_gps, loaded.row);
  if (saved.storageUnavailable) return { action: null, storageUnavailable: true };
  return { action: result.action, changed: result.changed, storageUnavailable: false };
}

export async function getCareerActionOutcome(userId, actionId) {
  const loaded = await loadProfileRow(userId);
  if (loaded.storageUnavailable || !loaded.row) return { outcome: null, storageUnavailable: true };
  const action = findRelevantAction(loaded.row.career_gps || {}, { actionId });
  if (!action) return { outcome: null, action: null, notFound: true, storageUnavailable: false };
  const outcome = findActionOutcome(loaded.row.career_gps || {}, action.action_id);
  return { outcome, action, storageUnavailable: false };
}

export async function upsertCareerActionOutcome(userId, actionId, outcomeInput = {}) {
  const loaded = await loadProfileRow(userId);
  if (loaded.storageUnavailable || !loaded.row) return { outcome: null, storageUnavailable: true };
  const result = upsertActionOutcome(loaded.row.career_gps || {}, actionId, outcomeInput, { userId });
  if (result.notFound) return { outcome: null, action: null, notFound: true, storageUnavailable: false };
  if (result.ownershipMismatch) {
    return { outcome: null, action: null, notFound: true, storageUnavailable: false };
  }
  if (result.invalidState) {
    return { outcome: null, action: result.action, invalidState: true, storageUnavailable: false };
  }
  const saved = await saveCareerGps(userId, result.career_gps, loaded.row);
  if (saved.storageUnavailable) return { outcome: null, storageUnavailable: true };
  let shadowLearning = null;
  if (result.evidenceCandidate && result.candidateStatus === "candidate_created") {
    try {
      const profileForShadow = {
        ...loaded.row,
        user_id: userId,
        career_gps: saved.row?.career_gps || result.career_gps,
        career_snapshot: saved.row?.career_gps?.snapshot || loaded.row.career_gps?.snapshot || {},
      };
      const existingValidationSummary = calculateRealUserValidationAggregate(
        profileForShadow.career_gps?.decision_loop?.shadow_learning || {}
      );
      shadowLearning = runEvidenceCandidateShadowLearning({
        careerGps: saved.row?.career_gps || result.career_gps,
        profile: profileForShadow,
        candidate: result.evidenceCandidate,
        action: result.action,
        outcome: result.outcome,
        productionSnapshot: profileForShadow.career_snapshot,
        validationSource: VALIDATION_SOURCE_KINDS.REAL_BETA_USER,
        realUserRunCount: existingValidationSummary.complete_learning_cycles || 0,
      });
      if (shadowLearning?.career_gps) {
        const shadowSaved = await saveCareerGps(userId, shadowLearning.career_gps, saved.row);
        if (shadowSaved.storageUnavailable) {
          shadowLearning = {
            ...shadowLearning,
            storageUnavailable: true,
            warnings: [
              ...(shadowLearning.warnings || []),
              { code: "SHADOW_LEARNING_SAVE_FAILED", message: "Shadow learning summary could not be persisted." },
            ],
          };
        }
      }
    } catch (error) {
      shadowLearning = {
        attempted: true,
        failed: true,
        failureStage: "persistence_orchestration",
        warnings: [{ code: "SHADOW_LEARNING_FAILED_CLOSED", message: error?.message || "Shadow learning failed closed." }],
      };
    }
  }
  return {
    outcome: result.outcome,
    action: result.action,
    evidenceCandidate: result.evidenceCandidate,
    candidateStatus: result.candidateStatus,
    candidateReason: result.candidateReason,
    candidateSignals: result.candidateSignals,
    evaluationStatus: shadowLearning?.evaluation?.status || null,
    usableForShadow: shadowLearning?.evaluation?.usable_for_shadow ?? false,
    shadowLearning: shadowLearning
      ? {
          attempted: Boolean(shadowLearning.attempted),
          failed: Boolean(shadowLearning.failed),
          failureStage: shadowLearning.failureStage || null,
          evaluationStatus: shadowLearning.evaluation?.status || null,
          usableForShadow: shadowLearning.evaluation?.usable_for_shadow ?? false,
          materialChange: shadowLearning.comparison?.material_change ?? false,
          recommendationChanged: shadowLearning.comparison?.reasoning_change?.recommendation_changed ?? false,
          gapChanged: shadowLearning.comparison?.reasoning_change?.gap_changed ?? false,
          confidenceDirection: shadowLearning.comparison?.evidence_change?.confidence_direction || "unknown",
          productionShadowAlignment: shadowLearning.promotionReadiness?.production_shadow_alignment || null,
          readinessClassification: shadowLearning.promotionReadiness?.readiness_classification || null,
          failureFlags: shadowLearning.promotionReadiness?.failure_flags || [],
          validationId: shadowLearning.realUserValidation?.validation_id || null,
          validationStatus: shadowLearning.realUserValidation?.validation_status || null,
          reviewClassification: shadowLearning.realUserValidation?.review_classification || null,
          reviewPriority: shadowLearning.realUserValidation?.review_priority || null,
          gapComparison: shadowLearning.realUserValidation?.gap_comparison?.classification || null,
          gapRelationship: shadowLearning.gapEvaluation?.relationship_class || null,
          shadowGapChangeReason: shadowLearning.gapEvaluation?.shadow_change_reason || null,
          gapOutcomeSignal: shadowLearning.gapEvaluation?.outcome_signal || null,
          gapWinnerClassification: shadowLearning.gapEvaluation?.winner_classification || null,
          realUserCohortState: shadowLearning.career_gps?.decision_loop?.shadow_learning?.real_user_validation_summary?.cohort_state || null,
          baselineRunId: shadowLearning.baselineRunId || null,
          augmentedRunId: shadowLearning.augmentedRunId || null,
          storageUnavailable: Boolean(shadowLearning.storageUnavailable),
        }
      : null,
    created: result.created,
    changed: result.changed,
    storageUnavailable: false,
  };
}
