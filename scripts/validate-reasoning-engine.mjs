import { buildReasoningEngine } from "../lib/careerIntelligence/reasoning/index.js";

const now = new Date("2026-07-31T12:00:00.000Z");

const reasoning = buildReasoningEngine({
  evidenceItems: [
    {
      id: "hirefit",
      title: "Built HireFit",
      description: "Founder and end-to-end owner. Built and launched HireFit for 800 users, increasing onboarding activation by 24%.",
      source_type: "portfolio",
      role_context: "Product Management",
      occurred_at: "2026",
      metrics: ["800 users", "24% activation increase"],
    },
    {
      id: "ops-internship",
      title: "Operations internship",
      description: "Supported daily operations and onboarding workflows during internship.",
      source_type: "cv",
      role_context: "Strategy & Operations",
      occurred_at: "2025",
    },
    {
      id: "communication-claim",
      title: "Excellent communication",
      description: "Excellent communication and leadership.",
      source_type: "user_statement",
      role_context: "Strategy",
    },
  ],
  requirements: {
    ownership: 2,
    execution: 2,
    product_thinking: 2,
    strategic_reasoning: 1,
    stakeholder_influence: 1,
  },
  decisionOptions: [
    {
      id: "product_management",
      label: "Product Management",
      requiredCompetencies: ["ownership", "execution", "product_thinking"],
    },
    {
      id: "strategy_ops",
      label: "Strategy & Operations",
      requiredCompetencies: ["strategic_reasoning", "stakeholder_influence", "execution"],
    },
    {
      id: "analytics",
      label: "Analytics",
      requiredCompetencies: ["analytical_reasoning", "execution"],
    },
  ],
  history: [
    {
      id: "previous",
      evidenceObjectCount: 1,
      confidenceByCompetency: {
        ownership: { confidence: 34 },
        execution: { confidence: 40 },
      },
    },
  ],
  context: {
    roleContext: "Product Management",
    targetRole: "Product Management",
    now,
  },
});

const output = {
  mode: reasoning.mode,
  topInferences: reasoning.inferences.slice(0, 5).map((item) => ({
    competency: item.competency,
    confidence: item.confidence,
    supportCount: item.supportCount,
  })),
  hypotheses: reasoning.hypotheses.slice(0, 5).map((item) => ({
    competency: item.competency,
    type: item.type,
    confidence: item.confidence,
  })),
  conflicts: reasoning.conflicts.conflicts.map((item) => ({
    id: item.id,
    evidenceId: item.evidenceId,
    severity: item.severity,
  })),
  primaryMissingEvidence: reasoning.missingEvidence.primaryMissingEvidence,
  recommendations: reasoning.recommendations.map((item) => ({
    label: item.label,
    rankScore: item.rankScore,
    decisionConfidence: item.decisionConfidence,
    confidenceBand: item.confidenceBand,
    evidenceCount: item.explanationTrace.evidence.length,
    missingEvidenceCount: item.missingEvidenceIds.length,
  })),
  learning: reasoning.learning,
  simulation: reasoning.simulation.topOpportunity,
};

console.error("=== Reasoning Engine Validation ===");
console.error(JSON.stringify(output, null, 2));
