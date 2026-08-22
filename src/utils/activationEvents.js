export const ACTIVATION_EVENTS = Object.freeze([
  "analyze_viewed",
  "landing_cta_clicked",
  "analysis_intent_selected",
  "auth_started",
  "signup_started",
  "signup_completed",
  "career_discovery_started",
  "career_snapshot_generated",
  "dashboard_first_view",
  "weekly_action_viewed",
  "weekly_action_started",
  "weekly_action_completed",
  "weekly_action_outcome_prompt_viewed",
  "weekly_action_outcome_submitted",
  "weekly_action_outcome_updated",
  "evidence_candidate_created",
  "evidence_candidate_insufficient",
  "evidence_candidate_updated",
  "evidence_candidate_evaluated",
  "shadow_learning_run_completed",
  "shadow_learning_material_change",
  "shadow_learning_no_change",
  "shadow_learning_failed",
  "shadow_promotion_readiness_evaluated",
  "real_shadow_validation_completed",
  "real_shadow_review_required",
  "real_shadow_review_submitted",
  "real_shadow_validation_insufficient",
  "gap_prioritization_shadow_changed",
  "application_validation_started",
  "decision_mirror_viewed",
  "decision_mirror_opened",
  "reflection_question_viewed",
  "reflection_journal_started",
]);

const ALLOWED_KEYS = new Set([
  "intent",
  "lang",
  "mode",
  "next",
  "route",
  "source",
  "state",
  "profileComplete",
  "surface",
  "questionCount",
  "actionStatus",
  "storage",
  "action_type",
  "outcome_type",
  "has_summary",
  "has_measurable_result",
  "has_proof_reference",
  "candidate_type",
  "has_metric",
  "quality_signal_count",
  "evaluation_status",
  "usable_for_shadow",
  "material_change",
  "recommendation_changed",
  "gap_changed",
  "confidence_direction",
  "production_shadow_alignment",
  "readiness_classification",
  "failure_flag_count",
  "validation_status",
  "review_classification",
  "review_priority",
  "gap_comparison",
  "gap_relationship",
  "shadow_gap_change_reason",
  "gap_outcome_signal",
  "gap_winner_classification",
  "real_user_cohort_state",
  "beta_cohort",
]);

function sanitizedPayload(payload = {}) {
  return Object.entries(payload).reduce((safe, [key, value]) => {
    if (!ALLOWED_KEYS.has(key)) return safe;
    if (value == null) return safe;
    safe[key] = typeof value === "string" ? value.slice(0, 80) : value;
    return safe;
  }, {});
}

export function trackActivationEvent(eventName, payload = {}) {
  if (typeof window === "undefined") return false;
  if (!ACTIVATION_EVENTS.includes(eventName)) return false;
  try {
    const safePayload = sanitizedPayload(payload);
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, safePayload);
    }
    if (typeof window.plausible === "function") {
      window.plausible(eventName, { props: safePayload });
    }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...safePayload, ts: Date.now() });
    }
    return true;
  } catch {
    return false;
  }
}
