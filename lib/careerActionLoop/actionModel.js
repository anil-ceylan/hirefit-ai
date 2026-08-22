import { SOURCE_TYPES } from "../careerIntelligence/evidence/evidenceTypes.js";

const ACTION_STATUSES = new Set(["recommended", "started", "completed"]);
const OUTCOME_TYPES = new Set([
  "COMPLETED_WITH_RESULT",
  "COMPLETED_NO_RESULT",
  "PARTIAL_RESULT",
  "EXTERNAL_RESPONSE",
  "INTERVIEW",
  "REJECTION",
  "OFFER",
]);

function compact(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stableHash(value) {
  let result = 5381;
  for (const char of String(value || "")) result = ((result << 5) + result) ^ char.charCodeAt(0);
  return (result >>> 0).toString(36);
}

export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function buildDecisionId({ weekKey, title, blocker, source = "weekly_decision_center" } = {}) {
  return `decision_${weekKey || getWeekKey()}_${stableHash(`${source}|${title}|${blocker}`)}`;
}

export function buildActionId({ userId, weekKey, decisionId, title } = {}) {
  return `weekly_${stableHash(`${userId}|${weekKey || getWeekKey()}|${decisionId}|${title}`)}`;
}

export function buildOutcomeId({ userId, actionId } = {}) {
  return `outcome_${stableHash(`${userId}|${actionId}`)}`;
}

export function buildEvidenceCandidateId({ userId, outcomeId } = {}) {
  return `candidate_${stableHash(`${userId}|${outcomeId}`)}`;
}

export function normalizeDecisionLoop(careerGps = {}) {
  const loop = careerGps?.decision_loop && typeof careerGps.decision_loop === "object"
    ? careerGps.decision_loop
    : {};
  return {
    actions: Array.isArray(loop.actions) ? loop.actions.filter(Boolean) : [],
    outcomes: Array.isArray(loop.outcomes) ? loop.outcomes.filter(Boolean) : [],
    evidence_candidates: Array.isArray(loop.evidence_candidates) ? loop.evidence_candidates.filter(Boolean) : [],
    shadow_learning: {
      evaluations: Array.isArray(loop.shadow_learning?.evaluations) ? loop.shadow_learning.evaluations.filter(Boolean) : [],
      comparisons: Array.isArray(loop.shadow_learning?.comparisons) ? loop.shadow_learning.comparisons.filter(Boolean) : [],
      readiness_runs: Array.isArray(loop.shadow_learning?.readiness_runs) ? loop.shadow_learning.readiness_runs.filter(Boolean) : [],
      validation_runs: Array.isArray(loop.shadow_learning?.validation_runs) ? loop.shadow_learning.validation_runs.filter(Boolean) : [],
      human_reviews: Array.isArray(loop.shadow_learning?.human_reviews) ? loop.shadow_learning.human_reviews.filter(Boolean) : [],
      gap_evaluations: Array.isArray(loop.shadow_learning?.gap_evaluations) ? loop.shadow_learning.gap_evaluations.filter(Boolean) : [],
      gap_human_reviews: Array.isArray(loop.shadow_learning?.gap_human_reviews) ? loop.shadow_learning.gap_human_reviews.filter(Boolean) : [],
      failures: Array.isArray(loop.shadow_learning?.failures) ? loop.shadow_learning.failures.filter(Boolean) : [],
      metrics: loop.shadow_learning?.metrics || {},
      aggregate_summary: loop.shadow_learning?.aggregate_summary || {},
      real_user_validation_summary: loop.shadow_learning?.real_user_validation_summary || {},
      gap_prioritization_summary: loop.shadow_learning?.gap_prioritization_summary || {},
      last_evaluated_at: loop.shadow_learning?.last_evaluated_at || null,
    },
    last_updated_at: loop.last_updated_at || null,
  };
}

export function normalizeCareerAction(input = {}, { userId, now = new Date().toISOString() } = {}) {
  const title = compact(input.title || input.action, 180);
  if (!title) throw new Error("Action title is required");
  const week_key = compact(input.week_key || input.weekKey || getWeekKey(), 24);
  const decision_id = compact(
    input.decision_id || input.decisionId || buildDecisionId({ weekKey: week_key, title, blocker: input.blocker }),
    120
  );
  const action_id = compact(
    input.action_id || input.actionId || buildActionId({ userId, weekKey: week_key, decisionId: decision_id, title }),
    120
  );
  const status = ACTION_STATUSES.has(input.status) ? input.status : "recommended";
  return {
    action_id,
    user_id: userId,
    decision_id,
    week_key,
    action_type: compact(input.action_type || input.actionType || "weekly_career_move", 80),
    title,
    reason: compact(input.reason || input.why, 320),
    blocker: compact(input.blocker, 220),
    target_dimension: compact(input.target_dimension || input.targetDimension, 120),
    expected_evidence: compact(input.expected_evidence || input.expectedEvidence, 220),
    status,
    source: compact(input.source || "weekly_decision_center", 80),
    recommended_at: input.recommended_at || input.recommendedAt || now,
    started_at: input.started_at || input.startedAt || null,
    completed_at: input.completed_at || input.completedAt || null,
    production_snapshot_ref: input.production_snapshot_ref || input.productionSnapshotRef || null,
    confidence: compact(input.confidence, 80),
  };
}

export function normalizeCareerActionOutcome(input = {}, { userId, actionId, now = new Date().toISOString() } = {}) {
  const resolvedActionId = compact(input.action_id || input.actionId || actionId, 120);
  if (!resolvedActionId) throw new Error("Outcome action_id is required");
  const rawType = String(input.outcome_type || input.outcomeType || "").trim().toUpperCase();
  const outcome_type = OUTCOME_TYPES.has(rawType)
    ? rawType
    : compact(input.measurable_result || input.measurableResult || input.proof_reference || input.proofReference || input.summary)
      ? "COMPLETED_WITH_RESULT"
      : "COMPLETED_NO_RESULT";
  return {
    outcome_id: compact(input.outcome_id || input.outcomeId || buildOutcomeId({ userId, actionId: resolvedActionId }), 120),
    action_id: resolvedActionId,
    user_id: userId,
    outcome_type,
    summary: compact(input.summary, 640),
    measurable_result: compact(input.measurable_result || input.measurableResult, 240),
    proof_reference: compact(input.proof_reference || input.proofReference, 320),
    occurred_at: input.occurred_at || input.occurredAt || null,
    captured_at: input.captured_at || input.capturedAt || now,
    updated_at: input.updated_at || input.updatedAt || now,
    source: compact(input.source || "weekly_decision_center", 80),
    evidence_status: "not_evaluated",
  };
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasMetricText(value) {
  return /\b\d+(?:[.,]\d+)?\s*(?:%|x|k|m|users?|customers?|clients?|hours?|days?|weeks?|months?|tl|try|usd|eur|başvuru|basvuru|kişi|kisi)?\b/i.test(String(value || ""));
}

function hasUrl(value) {
  return /https?:\/\/|www\.|linkedin\.com|github\.com|notion\.site|medium\.com|docs\.google\.com/i.test(String(value || ""));
}

function sourceTypeFromProof(proofReference = "") {
  const proof = norm(proofReference);
  if (/github/.test(proof)) return SOURCE_TYPES.GITHUB;
  if (/linkedin/.test(proof)) return SOURCE_TYPES.LINKEDIN;
  if (/portfolio|case|notion|medium|docs\.google|drive\.google/.test(proof)) return SOURCE_TYPES.PORTFOLIO;
  return SOURCE_TYPES.USER_STATEMENT;
}

function isVagueSelfClaim(text = "") {
  const t = norm(text);
  return /(i learned|i improved|i got better|felt|motivated|understood|ogren|gelistim|daha iyi|motive|hisset)/.test(t) &&
    !hasMetricText(t) &&
    !/published|created|built|launched|sent|updated|completed|interview|offer|rejection|yayin|olustur|ekled|gonder|tamamlad|mulakat|teklif|red/.test(t);
}

function candidateSignals(outcome = {}, action = {}) {
  const text = `${outcome.summary || ""} ${outcome.measurable_result || ""} ${outcome.proof_reference || ""}`;
  const normalized = norm(text);
  const has_summary = compact(outcome.summary, 20).length > 0;
  const has_metric = compact(outcome.measurable_result, 20).length > 0 || hasMetricText(text);
  const has_artifact_reference = compact(outcome.proof_reference, 20).length > 0;
  const has_external_reference = hasUrl(outcome.proof_reference);
  const has_specific_claim =
    compact(outcome.summary, 80).length >= 36 &&
    /(published|created|built|launched|sent|updated|completed|wrote|analyzed|interview|offer|rejection|yayin|olustur|ekled|gonder|tamamlad|yazd|analiz|mulakat|teklif|red|sonuc|result|case|project|portfolio|linkedin|cv)/.test(normalized);
  const has_role_context = Boolean(action?.target_dimension || action?.blocker || action?.title);
  const has_time_context = Boolean(outcome.occurred_at || outcome.captured_at);
  return {
    has_summary,
    has_specific_claim,
    has_role_context,
    has_metric,
    has_artifact_reference,
    has_external_reference,
    has_time_context,
    missing_result: !has_summary && !has_metric && !has_artifact_reference,
    missing_context: !has_role_context,
    vague_self_claim: isVagueSelfClaim(text),
  };
}

function candidateTypeFor(outcome = {}, signals = {}) {
  if (["INTERVIEW", "OFFER", "REJECTION", "EXTERNAL_RESPONSE"].includes(outcome.outcome_type)) {
    return "market_response";
  }
  if (signals.has_metric) return "measurable_outcome_claim";
  if (signals.has_artifact_reference) return "artifact_reference";
  return "described_outcome";
}

function preliminaryStrength(signals = {}, outcome = {}) {
  if (signals.has_metric && signals.has_artifact_reference) return "supported";
  if (signals.has_metric || signals.has_external_reference) return "structured";
  if (["INTERVIEW", "OFFER", "EXTERNAL_RESPONSE"].includes(outcome.outcome_type)) return "structured";
  if (signals.has_specific_claim) return "structured";
  return "weak";
}

function preliminaryTrust(signals = {}, outcome = {}) {
  if (signals.has_external_reference) return "referenced_not_verified";
  if (signals.has_metric) return "metric_claim_not_verified";
  if (["INTERVIEW", "OFFER", "REJECTION", "EXTERNAL_RESPONSE"].includes(outcome.outcome_type)) return "market_signal_self_reported";
  return "self_reported";
}

function missingCandidateFields(signals = {}) {
  const missing = [];
  if (!signals.has_specific_claim) missing.push("specific_claim");
  if (!signals.has_metric) missing.push("measurable_result");
  if (!signals.has_artifact_reference) missing.push("proof_reference");
  if (!signals.has_time_context) missing.push("time_context");
  if (!signals.has_role_context) missing.push("role_context");
  return missing;
}

export function buildEvidenceCandidateFromOutcome({
  outcome,
  action,
  userId,
  existingCandidate = null,
  now = new Date().toISOString(),
} = {}) {
  if (!outcome?.outcome_id || !action?.action_id) {
    return { candidate: null, eligible: false, reason: "missing_action_or_outcome" };
  }
  const signals = candidateSignals(outcome, action);
  const specialOutcome = ["INTERVIEW", "OFFER", "REJECTION", "EXTERNAL_RESPONSE"].includes(outcome.outcome_type);
  const eligible = !signals.missing_result &&
    !signals.vague_self_claim &&
    (signals.has_specific_claim || signals.has_metric || signals.has_artifact_reference || specialOutcome);

  if (!eligible) {
    if (!existingCandidate) {
      return {
        candidate: null,
        eligible: false,
        reason: signals.vague_self_claim ? "vague_self_claim" : "insufficient_outcome_detail",
        signals,
      };
    }
    return {
      candidate: {
        ...existingCandidate,
        evaluation_status: "ineligible",
        updated_at: now,
        quality_signals: signals,
        missing_fields: missingCandidateFields(signals),
      },
      eligible: false,
      reason: signals.vague_self_claim ? "vague_self_claim" : "insufficient_outcome_detail",
      signals,
    };
  }

  const candidate_type = candidateTypeFor(outcome, signals);
  return {
    candidate: {
      candidate_id: existingCandidate?.candidate_id || buildEvidenceCandidateId({ userId, outcomeId: outcome.outcome_id }),
      user_id: userId,
      action_id: action.action_id,
      outcome_id: outcome.outcome_id,
      candidate_type,
      target_dimension: compact(action.target_dimension || action.blocker || action.title, 140),
      claim: compact(outcome.summary, 640),
      measurable_result: compact(outcome.measurable_result, 240),
      proof_reference: compact(outcome.proof_reference, 320),
      source_type: sourceTypeFromProof(outcome.proof_reference),
      provenance: {
        source: "weekly_decision_outcome",
        action_type: action.action_type || "weekly_career_move",
        outcome_type: outcome.outcome_type,
        structured: true,
        verified: false,
      },
      created_at: existingCandidate?.created_at || now,
      updated_at: now,
      evaluation_status: "not_evaluated",
      preliminary_strength: preliminaryStrength(signals, outcome),
      preliminary_trust: preliminaryTrust(signals, outcome),
      quality_signals: signals,
      missing_fields: missingCandidateFields(signals),
    },
    eligible: true,
    reason: "candidate_created",
    signals,
  };
}

export function upsertRecommendedAction(careerGps = {}, actionInput = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const decisionLoop = normalizeDecisionLoop(careerGps);
  const incoming = normalizeCareerAction(actionInput, { ...options, now });
  const index = decisionLoop.actions.findIndex((action) => action.action_id === incoming.action_id);
  const actions = [...decisionLoop.actions];
  const existing = index >= 0 ? actions[index] : null;
  const action = existing
    ? {
        ...existing,
        title: incoming.title,
        reason: incoming.reason,
        blocker: incoming.blocker,
        target_dimension: incoming.target_dimension,
        expected_evidence: incoming.expected_evidence,
        production_snapshot_ref: incoming.production_snapshot_ref || existing.production_snapshot_ref || null,
        confidence: incoming.confidence || existing.confidence || "",
      }
    : incoming;
  if (index >= 0) actions[index] = action;
  else actions.unshift(action);
  return {
    career_gps: {
      ...(careerGps || {}),
      decision_loop: {
        ...decisionLoop,
        actions,
        last_updated_at: now,
      },
    },
    action,
    created: index < 0,
  };
}

export function transitionAction(careerGps = {}, actionId, nextStatus, options = {}) {
  if (!ACTION_STATUSES.has(nextStatus)) throw new Error("Invalid action status");
  const now = options.now || new Date().toISOString();
  const decisionLoop = normalizeDecisionLoop(careerGps);
  const index = decisionLoop.actions.findIndex((action) => action.action_id === actionId);
  if (index < 0) {
    return { career_gps: careerGps || {}, action: null, notFound: true, changed: false };
  }
  const actions = [...decisionLoop.actions];
  const current = actions[index];
  let next = current;

  if (nextStatus === "started") {
    if (current.status === "completed") next = current;
    else {
      next = {
        ...current,
        status: "started",
        started_at: current.started_at || now,
      };
    }
  }

  if (nextStatus === "completed") {
    if (current.status === "recommended") {
      return { career_gps: careerGps || {}, action: current, invalidTransition: true, changed: false };
    }
    next = {
      ...current,
      status: "completed",
      started_at: current.started_at || now,
      completed_at: current.completed_at || now,
    };
  }

  actions[index] = next;
  const changed = JSON.stringify(current) !== JSON.stringify(next);
  return {
    career_gps: {
      ...(careerGps || {}),
      decision_loop: {
        ...decisionLoop,
        actions,
        last_updated_at: changed ? now : decisionLoop.last_updated_at || now,
      },
    },
    action: next,
    changed,
  };
}

export function findActionOutcome(careerGps = {}, actionId) {
  const decisionLoop = normalizeDecisionLoop(careerGps);
  return decisionLoop.outcomes.find((outcome) => outcome.action_id === actionId) || null;
}

export function upsertActionOutcome(careerGps = {}, actionId, outcomeInput = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const decisionLoop = normalizeDecisionLoop(careerGps);
  const action = decisionLoop.actions.find((item) => item.action_id === actionId) || null;
  if (!action) return { career_gps: careerGps || {}, outcome: null, notFound: true, changed: false };
  if (action.user_id && options.userId && action.user_id !== options.userId) {
    return { career_gps: careerGps || {}, outcome: null, action, ownershipMismatch: true, changed: false };
  }
  if (action.status !== "completed") {
    return { career_gps: careerGps || {}, outcome: null, action, invalidState: true, changed: false };
  }
  const incoming = normalizeCareerActionOutcome(outcomeInput, { ...options, actionId, now });
  const index = decisionLoop.outcomes.findIndex((outcome) => outcome.outcome_id === incoming.outcome_id || outcome.action_id === actionId);
  const outcomes = [...decisionLoop.outcomes];
  const existing = index >= 0 ? outcomes[index] : null;
  let outcome = existing
    ? {
        ...existing,
        outcome_type: incoming.outcome_type,
        summary: incoming.summary,
        measurable_result: incoming.measurable_result,
        proof_reference: incoming.proof_reference,
        occurred_at: incoming.occurred_at,
        updated_at: now,
        source: incoming.source || existing.source || "weekly_decision_center",
        evidence_status: "not_evaluated",
      }
    : incoming;
  const existingCandidateIndex = decisionLoop.evidence_candidates.findIndex(
    (candidate) => candidate.outcome_id === outcome.outcome_id || candidate.action_id === actionId
  );
  const existingCandidate = existingCandidateIndex >= 0 ? decisionLoop.evidence_candidates[existingCandidateIndex] : null;
  const candidateResult = buildEvidenceCandidateFromOutcome({
    outcome,
    action,
    userId: options.userId || action.user_id,
    existingCandidate,
    now,
  });
  const evidenceCandidates = [...decisionLoop.evidence_candidates];
  if (candidateResult.candidate) {
    if (existingCandidateIndex >= 0) evidenceCandidates[existingCandidateIndex] = candidateResult.candidate;
    else evidenceCandidates.unshift(candidateResult.candidate);
  }
  outcome = {
    ...outcome,
    evidence_status: candidateResult.eligible ? "candidate_created" : "insufficient",
  };
  if (index >= 0) outcomes[index] = outcome;
  else outcomes.unshift(outcome);
  return {
    career_gps: {
      ...(careerGps || {}),
      decision_loop: {
        ...decisionLoop,
        outcomes,
        evidence_candidates: evidenceCandidates,
        last_updated_at: now,
      },
    },
    outcome,
    evidenceCandidate: candidateResult.candidate,
    candidateStatus: candidateResult.eligible ? "candidate_created" : "insufficient",
    candidateReason: candidateResult.reason,
    candidateSignals: candidateResult.signals,
    action,
    created: index < 0,
    changed: JSON.stringify(existing) !== JSON.stringify(outcome),
  };
}

export { OUTCOME_TYPES };
