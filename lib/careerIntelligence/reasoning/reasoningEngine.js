import { buildEvidenceIntelligenceLayer } from "../evidence/evidenceIntelligenceLayer.js";
import { buildInferences } from "./inferenceEngine.js";
import { detectReasoningConflicts } from "./conflictEngine.js";
import { analyzeMissingEvidence } from "./missingEvidenceEngine.js";
import { buildHypotheses } from "./hypothesisEngine.js";
import { explainHypotheses } from "./explainabilityEngine.js";
import { rankRecommendations } from "./recommendationRankingEngine.js";
import { buildReasoningMemory } from "./memoryIntegration.js";
import { analyzeReasoningLearning } from "./learningEngine.js";
import { simulateDecisionImpact } from "./decisionSimulationEngine.js";

export function buildReasoningEngine({
  evidenceIntelligence = null,
  evidenceItems = [],
  requirements = {},
  decisionOptions = [],
  history = [],
  roles = [],
  goals = [],
  profile = {},
  snapshot = {},
  context = {},
} = {}) {
  const intelligence = evidenceIntelligence || buildEvidenceIntelligenceLayer({
    evidenceItems,
    requirements,
    roles,
    goals,
    profile,
    snapshot,
    context,
  });
  const inferences = buildInferences(intelligence);
  const conflicts = detectReasoningConflicts(intelligence);
  const missingEvidence = analyzeMissingEvidence(intelligence, { inferences });
  const hypotheses = buildHypotheses({
    inferences,
    evidenceIntelligence: intelligence,
    conflicts,
    missingEvidence,
  });
  const recommendations = rankRecommendations({
    options: decisionOptions,
    hypotheses,
    evidenceIntelligence: intelligence,
    conflicts,
    missingEvidence,
    opportunityImpact: intelligence.opportunityImpact,
  });
  const memory = buildReasoningMemory(history);
  const currentReasoningSnapshot = {
    evidenceObjectCount: intelligence.evidenceObjects.length,
    confidenceByCompetency: intelligence.confidenceByCompetency,
    topRecommendation: recommendations[0] || null,
  };
  const learning = analyzeReasoningLearning(memory, currentReasoningSnapshot);
  return {
    mode: "shadow",
    evidenceIntelligence: intelligence,
    inferences,
    hypotheses,
    conflicts,
    missingEvidence,
    explainability: {
      hypothesisTraces: explainHypotheses(hypotheses, {
        evidenceIntelligence: intelligence,
        conflicts,
        missingEvidence,
      }),
    },
    recommendations,
    topRecommendation: recommendations[0] || null,
    memory,
    learning,
    simulation: {
      topOpportunity: simulateDecisionImpact({ id: "top_evidence_opportunity" }, { evidenceIntelligence: intelligence }),
    },
  };
}
