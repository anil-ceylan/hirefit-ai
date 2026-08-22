import { classifyEvidenceSet } from "./evidenceClassification.js";
import { calculateEvidenceStrength } from "./evidenceStrengthEngine.js";
import { calculateEvidenceFreshness } from "./evidenceFreshness.js";
import { calculateEvidenceTrust } from "./evidenceTrustEngine.js";
import { calculateEvidenceRedundancy } from "./evidenceRedundancy.js";
import { calculateCompetencyConfidence } from "./evidenceConfidenceEngine.js";
import { calculateEvidenceCoverage } from "./evidenceCoverage.js";
import { buildEvidenceGraph } from "./evidenceGraph.js";
import {
  calculateEvidenceQuality,
  calculateEvidenceSetQuality,
} from "./evidenceQualityEngine.js";
import { evaluateEvidence } from "./evaluateEvidence.js";
import { buildOpportunityImpactPlan } from "./opportunityImpactEngine.js";
import { clampScore } from "./evidenceTypes.js";

function enrichWithBaseEvaluation(items, context) {
  return items.map((item) => ({
    ...item,
    ...evaluateEvidence(item, {
      roleContext: context.roleContext || item.role_context,
      now: context.now,
      roleWeights: context.roleWeights,
    }),
  }));
}

function enrichEvidence(items, context) {
  return items.map((item) => {
    const strength = calculateEvidenceStrength(item, context);
    const freshness = calculateEvidenceFreshness(item, context);
    const trust = calculateEvidenceTrust(item, context);
    return {
      ...item,
      strength: strength.strength,
      strengthFactors: strength.strengthFactors,
      freshness: freshness.freshness,
      freshnessFactors: freshness,
      trust: trust.trust,
      trustFactors: trust.trustFactors,
    };
  });
}

function applyQuality(items, competencyConfidence) {
  return items.map((item) => ({
    ...item,
    ...calculateEvidenceQuality(item, { competencyConfidence }),
  }));
}

export function buildEvidenceIntelligenceLayer({
  evidenceItems = [],
  requirements = {},
  roles = [],
  goals = [],
  profile = {},
  snapshot = {},
  context = {},
} = {}) {
  const classified = classifyEvidenceSet(evidenceItems, { context });
  const baseEvaluated = enrichWithBaseEvaluation(classified, context);
  const enriched = enrichEvidence(baseEvaluated, context);
  const preliminaryRedundancy = calculateEvidenceRedundancy(enriched);
  const preliminaryConfidence = calculateCompetencyConfidence(enriched, { redundancyReport: preliminaryRedundancy });
  const qualityItems = applyQuality(enriched, preliminaryConfidence);
  const redundancy = calculateEvidenceRedundancy(qualityItems);
  const confidenceByCompetency = calculateCompetencyConfidence(qualityItems, { redundancyReport: redundancy });
  const evidenceObjects = applyQuality(qualityItems, confidenceByCompetency).map((item) => ({
    ...item,
    confidence: item.competencies?.length
      ? clampScore(item.competencies.reduce((sum, competency) => sum + (confidenceByCompetency[competency]?.confidence || 0), 0) / item.competencies.length)
      : item.confidence,
    redundancyScore: redundancy.itemRedundancy[item.id]?.redundancyScore || 0,
    relationships: [
      ...(item.competencies || []).map((competency) => ({ type: "supports_competency", target: competency })),
      item.role_context ? { type: "supports_role_context", target: item.role_context } : null,
    ].filter(Boolean),
    metadata: {
      source_type: item.source_type,
      occurred_at: item.occurred_at,
      metrics: item.metrics,
      missing_fields: item.missing_fields,
      contradictions: item.contradictions,
    },
  }));
  const graph = buildEvidenceGraph(evidenceObjects, { roles, goals });
  const coverage = calculateEvidenceCoverage(evidenceObjects, requirements, { confidenceByCompetency });
  const quality = calculateEvidenceSetQuality(evidenceObjects);
  const evidenceReport = {
    evidenceItems: evidenceObjects,
    confidenceScore: quality.evidenceQualityScore,
    roleSpecificEvidenceScore: coverage.coverageScore,
    strongestEvidence: quality.strongestEvidence,
    weakestEvidence: quality.weakestEvidence,
    missingEvidenceFields: Object.entries(
      evidenceObjects.flatMap((item) => item.missing_fields || []).reduce((acc, field) => {
        acc[field] = (acc[field] || 0) + 1;
        return acc;
      }, {})
    ).map(([field, count]) => ({ field, label: field, count })),
    contradictionFlags: evidenceObjects.flatMap((item) => (item.contradictions || []).map((id) => ({ id, evidenceId: item.id }))),
  };
  const opportunityImpact = buildOpportunityImpactPlan({
    profile,
    snapshot,
    evidenceReport,
    context,
  });
  return {
    mode: "shadow",
    evidenceObjects,
    graph,
    confidenceByCompetency,
    coverage,
    quality,
    redundancy,
    opportunityImpact,
  };
}
