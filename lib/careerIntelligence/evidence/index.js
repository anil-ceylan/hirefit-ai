import { normalizeEvidenceItem, normalizeEvidenceList } from "./normalizeEvidence.js";
import { evaluateEvidence } from "./evaluateEvidence.js";
import { evaluateEvidenceSet } from "./evaluateEvidenceSet.js";
import {
  selectPrimaryEvidenceGap,
  selectStrongestEvidence,
  selectWeakestEvidence,
} from "./evidenceSelectors.js";

export * from "./evidenceTypes.js";
export * from "./evidenceConfig.js";
export * from "./roleEvidenceWeights.js";
export * from "./normalizeEvidence.js";
export * from "./evaluateEvidence.js";
export * from "./evaluateEvidenceSet.js";
export * from "./evidenceSelectors.js";
export * from "./evidenceExplanations.js";
export * from "./legacyEvidenceAdapter.js";
export * from "./evidenceCoherence.js";
export * from "./gapShadowSelector.js";
export * from "./evidenceOpportunityPlanner.js";
export * from "./evidenceIntelligenceConfig.js";
export * from "./evidenceClassification.js";
export * from "./evidenceStrengthEngine.js";
export * from "./evidenceConfidenceEngine.js";
export * from "./evidenceCoverage.js";
export * from "./evidenceFreshness.js";
export * from "./evidenceRedundancy.js";
export * from "./evidenceTrustEngine.js";
export * from "./evidenceGraph.js";
export * from "./evidenceQualityEngine.js";
export * from "./opportunityImpactEngine.js";
export * from "./evidenceIntelligenceLayer.js";

export function normalizeEvidence(input, context = {}) {
  return Array.isArray(input)
    ? normalizeEvidenceList(input, context)
    : normalizeEvidenceItem(input, context);
}

export function getEvidenceSummary(report) {
  return {
    overallEvidenceQuality: report?.overallEvidenceQuality ?? 0,
    confidenceScore: report?.confidenceScore ?? 0,
    roleSpecificEvidenceScore: report?.roleSpecificEvidenceScore ?? 0,
    qualityBand: report?.qualityBand || "weak",
    explanationText: report?.explanationText || "",
    recommendedEvidenceImprovement: report?.recommendedEvidenceImprovement || "",
    primaryGap: selectPrimaryEvidenceGap(report),
  };
}

export function getStrongestEvidence(report, count = 3) {
  return selectStrongestEvidence(report, count);
}

export function getWeakestEvidence(report, count = 3) {
  return selectWeakestEvidence(report, count);
}

export function getMissingEvidence(report) {
  return report?.missingEvidenceFields || [];
}

export function getContradictions(report) {
  return report?.contradictionFlags || [];
}

export { evaluateEvidence, evaluateEvidenceSet };
