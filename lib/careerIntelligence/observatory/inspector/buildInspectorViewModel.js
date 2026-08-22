import { asArray } from "../utils.js";
import { filterInspectorData } from "./filterInspectorData.js";

export function buildInspectorViewModel(observatoryResult = {}) {
  const safe = filterInspectorData(observatoryResult);
  const reasoning = safe.shadowResult?.reasoning || {};
  return {
    runMetadata: {
      runId: safe.runId,
      activationState: safe.activation?.state,
      stored: Boolean(safe.stored),
    },
    inputCoverage: safe.shadowSummary?.inputCoverage || {},
    productionDecision: safe.shadowSummary?.production || {},
    shadowDecision: safe.shadowSummary?.shadow || {},
    evidenceSummary: safe.reasoningReport?.evidenceSummary || {},
    competencyConfidence: safe.reasoningReport?.competencies || [],
    inferences: asArray(reasoning.inferences).map((item) => ({ id: item.id, competency: item.competency, confidence: item.confidence, evidenceIds: item.evidenceIds })),
    hypotheses: safe.reasoningReport?.hypotheses || [],
    conflicts: safe.reasoningReport?.conflicts || [],
    missingEvidence: safe.reasoningReport?.missingEvidence || [],
    decisionOptions: safe.reasoningReport?.decisionOptions || [],
    drift: safe.drift || {},
    guardrails: safe.shadowResult?.guardrails || {},
    traceCompleteness: safe.shadowResult?.guardrails?.trace || {},
    promotionGates: safe.promotionGates || {},
    warnings: safe.warnings || [],
  };
}
