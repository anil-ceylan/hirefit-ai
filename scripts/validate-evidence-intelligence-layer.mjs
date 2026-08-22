import { buildEvidenceIntelligenceLayer } from "../lib/careerIntelligence/evidence/index.js";

const now = new Date("2026-07-31T12:00:00.000Z");

const evidenceItems = [
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
    id: "leadership-claim",
    title: "Leadership",
    description: "Strong leadership and communication skills.",
    source_type: "user_statement",
    role_context: "Strategy & Operations",
  },
  {
    id: "case-study",
    title: "Business case",
    description: "Prepared a market entry case with options and recommendation.",
    source_type: "career_dna",
    role_context: "Strategy & Operations",
    occurred_at: "2026",
  },
];

const intelligence = buildEvidenceIntelligenceLayer({
  evidenceItems,
  requirements: {
    ownership: 2,
    execution: 2,
    strategic_reasoning: 2,
    stakeholder_influence: 1,
    analytical_reasoning: 1,
  },
  roles: ["Strategy & Operations Intern", "Product Manager"],
  goals: ["Decide next weekly career move"],
  context: {
    roleContext: "Strategy & Operations",
    targetRole: "Strategy & Operations Intern",
    now,
  },
});

const result = {
  mode: intelligence.mode,
  evidenceObjectCount: intelligence.evidenceObjects.length,
  graph: {
    nodeCount: intelligence.graph.nodes.length,
    edgeCount: intelligence.graph.edges.length,
  },
  quality: intelligence.quality,
  qualityCompact: {
    evidenceQualityScore: intelligence.quality.evidenceQualityScore,
    averageQuality: intelligence.quality.averageQuality,
    strongestEvidence: intelligence.quality.strongestEvidence.map((item) => ({
      id: item.id,
      title: item.title,
      quality: item.quality,
      trust: item.trust,
      strength: item.strength,
    })),
    weakestEvidence: intelligence.quality.weakestEvidence.map((item) => ({
      id: item.id,
      title: item.title,
      quality: item.quality,
      trust: item.trust,
      strength: item.strength,
    })),
  },
  confidenceByCompetency: Object.fromEntries(
    Object.entries(intelligence.confidenceByCompetency)
      .sort((a, b) => b[1].confidence - a[1].confidence)
      .slice(0, 8)
      .map(([key, value]) => [key, {
        confidence: value.confidence,
        evidenceCount: value.evidenceCount,
        independentSourceCount: value.independentSourceCount,
      }])
  ),
  coverage: {
    score: intelligence.coverage.coverageScore,
    missing: intelligence.coverage.missingCompetencies.map((item) => ({
      competency: item.competency,
      status: item.status,
      score: item.score,
    })),
  },
  topOpportunityImpact: intelligence.opportunityImpact.topImpact
    ? {
        category: intelligence.opportunityImpact.topImpact.opportunity.category,
        impactScore: intelligence.opportunityImpact.topImpact.impact.impactScore,
        questionType: intelligence.opportunityImpact.topImpact.questionPlan?.questionType,
        estimatedEvidenceQualityGain: intelligence.opportunityImpact.topImpact.impact.estimatedEvidenceQualityGain,
      }
    : null,
};

console.error("=== Evidence Intelligence Layer Validation ===");
delete result.quality;
console.error(JSON.stringify(result, null, 2));
