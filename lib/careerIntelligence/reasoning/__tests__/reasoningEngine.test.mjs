import assert from "node:assert/strict";
import {
  analyzeMissingEvidence,
  buildInferences,
  buildReasoningEngine,
  detectReasoningConflicts,
  rankRecommendations,
  simulateDecisionImpact,
} from "../index.js";
import { buildEvidenceIntelligenceLayer } from "../../evidence/index.js";

const now = new Date("2026-07-31T12:00:00.000Z");

const evidenceItems = [
  {
    id: "product-builder",
    title: "Built HireFit",
    description: "Founder and end-to-end owner. Built and launched HireFit for 800 users, increasing onboarding activation by 24%.",
    source_type: "portfolio",
    role_context: "Product Management",
    occurred_at: "2026",
    metrics: ["800 users", "24% activation increase"],
  },
  {
    id: "business-case",
    title: "Market entry case",
    description: "Prepared a market entry case with options and recommendation.",
    source_type: "career_dna",
    role_context: "Strategy",
    occurred_at: "2026",
  },
  {
    id: "communication-claim",
    title: "Excellent communication",
    description: "Excellent communication and leadership.",
    source_type: "user_statement",
    role_context: "Strategy",
  },
];

const requirements = {
  ownership: 2,
  execution: 2,
  product_thinking: 2,
  strategic_reasoning: 1,
  stakeholder_influence: 1,
};

const evidenceIntelligence = buildEvidenceIntelligenceLayer({
  evidenceItems,
  requirements,
  context: {
    roleContext: "Product Management",
    targetRole: "Product Manager",
    now,
  },
});

const inferences = buildInferences(evidenceIntelligence);
assert.ok(inferences.some((item) => item.competency === "product_thinking"), "Inference engine must infer competencies from evidence.");
assert.ok(inferences.every((item) => item.type === "competency_inference"), "Inferences must be separate objects, not raw evidence.");

const conflicts = detectReasoningConflicts(evidenceIntelligence);
assert.ok(conflicts.conflicts.some((item) => item.id === "strong_claim_without_support"), "Conflict engine must catch unsupported strong claims.");
assert.ok(conflicts.conflictPenalty > 0, "Conflicts must create a confidence penalty.");

const missing = analyzeMissingEvidence(evidenceIntelligence, { inferences });
assert.ok(missing.missingEvidence.some((item) => item.competency === "stakeholder_influence"), "Missing evidence must be explicitly modeled.");
assert.ok(missing.primaryMissingEvidence, "Missing evidence engine must select a primary uncertainty.");

const reasoning = buildReasoningEngine({
  evidenceIntelligence,
  requirements,
  decisionOptions: [
    {
      id: "product_management",
      label: "Product Management",
      requiredCompetencies: ["ownership", "execution", "product_thinking"],
    },
    {
      id: "strategy",
      label: "Strategy",
      requiredCompetencies: ["strategic_reasoning", "stakeholder_influence", "analytical_reasoning"],
    },
  ],
  history: [
    {
      id: "previous",
      evidenceObjectCount: 1,
      confidenceByCompetency: {
        ownership: { confidence: 38 },
        execution: { confidence: 35 },
      },
    },
  ],
});

assert.equal(reasoning.mode, "shadow", "Reasoning Engine must remain shadow mode.");
assert.ok(reasoning.hypotheses.length >= 1, "Hypothesis engine must produce probabilistic hypotheses.");
assert.ok(reasoning.hypotheses.every((item) => Number.isFinite(item.confidence)), "Hypotheses must carry confidence.");
assert.ok(reasoning.recommendations.length === 2, "Recommendation engine must return ranked alternatives.");
assert.equal(reasoning.recommendations[0].label, "Product Management", "Ranking must prefer the better-supported option.");
assert.ok(Number.isFinite(reasoning.recommendations[0].decisionConfidence), "Recommendations must expose decision confidence.");
assert.ok(reasoning.recommendations[0].explanationTrace.evidence.length >= 1, "Recommendations must be traceable to evidence.");
assert.ok(reasoning.learning.hasProgress, "Learning engine must compare against history.");
assert.ok(reasoning.simulation.topOpportunity.expectedEffects.decisionConfidence >= 0, "Decision simulation must estimate effects without guarantees.");

const unsupportedStrategy = rankRecommendations({
  options: [{
    id: "strategy",
    label: "Strategy",
    requiredCompetencies: ["stakeholder_influence", "analytical_reasoning"],
  }],
  hypotheses: reasoning.hypotheses,
  evidenceIntelligence,
  conflicts,
  missingEvidence: missing,
});
assert.ok(
  unsupportedStrategy[0].decisionConfidence < reasoning.recommendations[0].decisionConfidence,
  "Options with missing required competencies must receive lower decision confidence."
);

const simulation = simulateDecisionImpact({ id: "publish_portfolio" }, reasoning);
assert.equal(simulation.mode, "estimate", "Simulation must be explicit about estimates.");
assert.ok(simulation.reason.includes("not a guaranteed"), "Simulation must not imply guaranteed score deltas.");

console.error("Reasoning Engine tests: PASS");
