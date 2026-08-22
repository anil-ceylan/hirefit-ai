import { clampScore } from "./evidenceTypes.js";
import {
  buildEvidenceOpportunities,
  buildQuestionPlan,
} from "./evidenceOpportunityPlanner.js";
import { DEFAULT_OPPORTUNITY_IMPACT_STRATEGY } from "./evidenceIntelligenceConfig.js";

function effortInverse(minutes) {
  return clampScore(100 - Number(minutes || 45) * 0.9);
}

function weightedAverage(factors, weights) {
  let total = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (factors[key] || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : 0;
}

export function estimateOpportunityImpact(opportunity, { strategy = DEFAULT_OPPORTUNITY_IMPACT_STRATEGY } = {}) {
  if (!opportunity) return null;
  const factors = {
    gapSeverity: clampScore(100 - Number(opportunity.currentEvidenceStrength || 0)),
    recruiterTrustGain: clampScore(opportunity.recruiterImpact),
    roleFitGain: clampScore(opportunity.roleRelevance),
    readinessGain: clampScore(opportunity.decisionImpact),
    effortInverse: effortInverse(opportunity.estimatedUserEffort?.minutes),
  };
  const impactScore = clampScore(weightedAverage(factors, strategy.weights));
  return {
    opportunityId: opportunity.id,
    category: opportunity.category,
    impactScore,
    estimatedRecruiterTrustGain: Math.max(1, Math.round(opportunity.recruiterImpact / 14)),
    estimatedRoleFitGain: Math.max(1, Math.round(opportunity.roleRelevance / 16)),
    estimatedReadinessGain: Math.max(1, Math.round(opportunity.decisionImpact / 18)),
    estimatedEvidenceQualityGain: Math.max(1, Math.round((100 - opportunity.currentEvidenceStrength) / 8)),
    explanation: {
      gapSeverity: factors.gapSeverity,
      recruiterTrustGain: factors.recruiterTrustGain,
      roleFitGain: factors.roleFitGain,
      readinessGain: factors.readinessGain,
      effortInverse: factors.effortInverse,
    },
  };
}

export function buildOpportunityImpactPlan({ profile = {}, snapshot = {}, evidenceReport = null, context = {} } = {}) {
  const opportunities = buildEvidenceOpportunities({ profile, snapshot, evidenceReport, context });
  const impacts = opportunities
    .filter((opportunity) => opportunity.status === "active")
    .map((opportunity) => ({
      opportunity,
      impact: estimateOpportunityImpact(opportunity),
      questionPlan: buildQuestionPlan(opportunity, context),
    }))
    .sort((a, b) => {
      if (b.impact.impactScore !== a.impact.impactScore) return b.impact.impactScore - a.impact.impactScore;
      return b.opportunity.priority - a.opportunity.priority;
    });
  return {
    mode: "shadow",
    topImpact: impacts[0] || null,
    impacts,
  };
}
