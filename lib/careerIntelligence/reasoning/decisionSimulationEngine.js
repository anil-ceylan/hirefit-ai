import { clampScore } from "../evidence/evidenceTypes.js";

function topImpactFromOpportunity(reasoning = {}) {
  return reasoning.evidenceIntelligence?.opportunityImpact?.topImpact || reasoning.opportunityImpact?.topImpact || null;
}

export function simulateDecisionImpact(action = {}, reasoning = {}) {
  const topImpact = action.opportunityImpact || topImpactFromOpportunity(reasoning);
  if (!topImpact) {
    return {
      mode: "estimate",
      actionId: action.id || "unknown_action",
      confidence: "low",
      expectedEffects: {
        recruiterTrust: 0,
        readiness: 0,
        roleFit: 0,
        decisionConfidence: 0,
      },
      reason: "No evidence opportunity is available for simulation.",
    };
  }
  const impact = topImpact.impact || topImpact;
  const baseDecisionGain = Math.max(1, Math.round(Number(impact.impactScore || 0) / 18));
  return {
    mode: "estimate",
    actionId: action.id || topImpact.opportunity?.id || "evidence_action",
    confidence: impact.impactScore >= 72 ? "medium" : "low",
    expectedEffects: {
      recruiterTrust: clampScore(impact.estimatedRecruiterTrustGain || baseDecisionGain, 0, 20),
      readiness: clampScore(impact.estimatedReadinessGain || Math.max(1, baseDecisionGain - 1), 0, 20),
      roleFit: clampScore(impact.estimatedRoleFitGain || baseDecisionGain, 0, 20),
      decisionConfidence: clampScore(baseDecisionGain, 0, 20),
    },
    reason: "Estimate is based on the current top evidence opportunity; it is not a guaranteed score delta.",
  };
}
