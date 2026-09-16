import { COMPANION_CASE_STATUSES, MAX, PROMOTION_RAISE_SCENARIO } from "./constants.js";

const text = (v) => String(v ?? "").trim();
function bounded(value, max, required = false) {
  const v = text(value);
  return (!required || v.length > 0) && v.length <= max;
}
export function validatePromotionRaiseInput(input = {}) {
  const fields = ["what_happened", "desired_outcome", "role_context", "achievements"];
  const valid = fields.every((k) => bounded(input[k], MAX[k], true)) &&
    bounded(input.manager_context, MAX.manager_context) &&
    ["low", "medium", "high"].includes(input.urgency);
  return { ok: valid, errors: valid ? [] : fields.filter((k) => !bounded(input[k], MAX[k], true)).concat(!["low", "medium", "high"].includes(input.urgency) ? ["urgency"] : []) };
}
export function validateGuidanceOutput(output = {}) {
  const keys = ["situation_summary", "known_facts", "assumptions_unknowns", "recommended_next_step", "conversation_plan", "suggested_wording", "evidence_checklist", "decision_criteria", "risks_tradeoffs"];
  const ok = keys.every((k) => (Array.isArray(output[k]) ? output[k].length > 0 : text(output[k]).length > 0));
  return { ok, errors: ok ? [] : keys.filter((k) => !(Array.isArray(output[k]) ? output[k].length > 0 : text(output[k]).length > 0)) };
}
export function validateOutcome(input = {}) {
  const ok = bounded(input.manager_response, MAX.outcome, true) && bounded(input.measurable_effect, MAX.measurable_effect) && bounded(input.proof_reference, MAX.proof_reference) && (!input.outcome_date || /^\d{4}-\d{2}-\d{2}$/.test(input.outcome_date));
  return { ok, errors: ok ? [] : ["outcome"] };
}
export function normalizeCaseInput(input = {}) {
  const result = { scenario_type: PROMOTION_RAISE_SCENARIO, title: text(input.title).slice(0, MAX.title), what_happened: text(input.what_happened), desired_outcome: text(input.desired_outcome), role_context: text(input.role_context), achievements: text(input.achievements), urgency: text(input.urgency), manager_context: text(input.manager_context) };
  const check = validatePromotionRaiseInput(result);
  if (!check.ok) return { value: null, ...check };
  return { value: result, ok: true, errors: [] };
}
export { COMPANION_CASE_STATUSES };
