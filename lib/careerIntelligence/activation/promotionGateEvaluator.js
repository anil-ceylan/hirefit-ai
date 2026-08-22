import { DEFAULT_PROMOTION_GATE_CONFIG } from "./activationConfig.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function gate(id, passed, status, reason = "") {
  return { id, passed: Boolean(passed), status, reason };
}

export function evaluatePromotionGates({
  contracts = {},
  shadowResult = {},
  drift = {},
  stability = null,
  realSampleCount = 0,
  manualReviews = [],
  config = {},
} = {}) {
  const cfg = { ...DEFAULT_PROMOTION_GATE_CONFIG, ...config };
  const contractErrors = Object.values(contracts || {}).flatMap((result) => asArray(result?.errors));
  const criticalGuardrails = asArray(shadowResult.guardrails?.violations).filter((item) => item.severity === "critical");
  const traceScore = Number(shadowResult.guardrails?.trace?.completenessScore ?? shadowResult.reasoning?.traceValidation?.completenessScore ?? 0);
  const top = shadowResult.reasoning?.recommendations?.[0] || {};
  const highDrift = asArray(drift.items || drift.divergences).filter((item) => item.severity === "critical" || item.severity === "high");
  const reviewedRuns = new Set(asArray(manualReviews).filter((item) => item.status === "reviewed" || item.status === "accepted").map((item) => item.runId));
  const stabilityScore = stability?.stabilityScore ?? null;

  const gates = [
    gate("contract_validity_gate", contractErrors.length === 0, "observed", contractErrors.length ? "Critical contract errors exist." : "Contracts are valid."),
    gate("guardrail_gate", criticalGuardrails.length === 0, "observed", criticalGuardrails.length ? "Critical guardrail violations exist." : "No critical guardrail violations."),
    gate("trace_gate", traceScore >= cfg.minimumTraceCompleteness, "observed", `Trace completeness ${traceScore || 0}.`),
    gate("evidence_support_gate", (top.evidenceIds?.length || 0) >= cfg.minimumTopEvidenceCount, "observed", `${top.evidenceIds?.length || 0} evidence item(s) support top recommendation.`),
    gate("confidence_gate", Number(top.decisionConfidence || 0) >= cfg.minimumTopDecisionConfidence, "observed", `Top confidence ${top.decisionConfidence ?? 0}.`),
    gate("drift_gate", !highDrift.length, "observed", highDrift.length ? "High or critical drift requires review." : "No unresolved high/critical drift."),
    gate("stability_gate", stabilityScore == null ? false : stabilityScore >= cfg.minimumRankingStability, stabilityScore == null ? "not_measurable" : "observed", stabilityScore == null ? "Ranking stability not measured." : `Ranking stability ${stabilityScore}.`),
    gate("real_sample_gate", realSampleCount >= cfg.minimumRealShadowRuns, "observed", `${realSampleCount} real shadow run(s); ${cfg.minimumRealShadowRuns} required.`),
    gate("manual_review_gate", !cfg.highSeverityReviewRequired || !highDrift.length || highDrift.every((item) => reviewedRuns.has(item.runId)), "derived", highDrift.length ? "High-severity drift requires manual review." : "No manual review required."),
  ];
  const blockers = gates.filter((item) => !item.passed).map((item) => item.reason);
  return {
    eligible: false,
    gates,
    blockers,
    nextState: blockers.length ? "internal_review" : "eligible_for_controlled_activation",
    productionInfluenceAllowed: false,
  };
}
