import assert from "node:assert/strict";
import {
  buildEvidenceGraph,
  buildEvidenceIntelligenceLayer,
  calculateCompetencyConfidence,
  calculateEvidenceCoverage,
  calculateEvidenceFreshness,
  calculateEvidenceRedundancy,
  calculateEvidenceStrength,
  calculateEvidenceTrust,
  classifyEvidence,
} from "../index.js";

const now = new Date("2026-07-31T12:00:00.000Z");

const genericClaim = {
  id: "claim-1",
  title: "Leadership",
  description: "Strong leadership and communication skills.",
  source_type: "user_statement",
  role_context: "Strategy",
};

const shippedProduct = {
  id: "product-1",
  title: "Built HireFit",
  description: "Founder and end-to-end owner. Built and launched HireFit for 800 users, increasing onboarding activation by 24%.",
  source_type: "portfolio",
  role_context: "Product Management",
  occurred_at: "2026",
  metrics: ["800 users", "24% activation increase"],
};

const dashboardProject = {
  id: "analytics-1",
  title: "Financial dashboard",
  description: "Created a financial dashboard and forecast model for monthly reporting.",
  source_type: "github",
  role_context: "Finance",
  occurred_at: "2025",
};

const duplicateExcelA = {
  id: "excel-a",
  title: "Excel",
  description: "Excel reporting.",
  source_type: "career_dna",
};

const duplicateExcelB = {
  id: "excel-b",
  title: "Excel",
  description: "Excel reporting.",
  source_type: "career_dna",
};

const classified = classifyEvidence(shippedProduct);
assert.ok(classified.categories.length >= 2, "Evidence should support multiple categories.");
assert.ok(classified.competencies.includes("ownership"), "Founder evidence must classify ownership.");
assert.ok(classified.competencies.includes("product_thinking"), "Product evidence must classify product thinking.");
assert.ok(classified.competencies.includes("execution"), "Launch evidence must classify execution.");

const weakStrength = calculateEvidenceStrength(genericClaim);
const strongStrength = calculateEvidenceStrength(shippedProduct);
assert.ok(strongStrength.strength > weakStrength.strength, "Strength engine must reward ownership, scope, metrics, and validation.");

const oldFreshness = calculateEvidenceFreshness({ occurred_at: "2017" }, { now });
const currentFreshness = calculateEvidenceFreshness({ occurred_at: "2026" }, { now });
assert.ok(currentFreshness.freshness > oldFreshness.freshness, "Freshness engine must decay older inactive evidence.");

const weakTrust = calculateEvidenceTrust(genericClaim);
const strongTrust = calculateEvidenceTrust(shippedProduct);
assert.ok(strongTrust.trust > weakTrust.trust, "Trust engine must reward measurable and externally verifiable evidence.");

const redundancy = calculateEvidenceRedundancy([duplicateExcelA, duplicateExcelB, dashboardProject]);
assert.ok(redundancy.duplicateGroups.length >= 1, "Redundancy engine must detect repeated evidence.");
assert.ok(
  redundancy.itemRedundancy[dashboardProject.id].redundancyScore < redundancy.itemRedundancy[duplicateExcelA.id].redundancyScore,
  "Different-context evidence should be less redundant than repeated text."
);

const qualityItems = [
  { ...classified, quality: 82, trust: 80, strength: 88 },
  { ...classifyEvidence(dashboardProject), quality: 76, trust: 78, strength: 70 },
];
const lowConfidence = calculateCompetencyConfidence([{ ...classifyEvidence(genericClaim), quality: 34, trust: 26, strength: 30 }]);
const highConfidence = calculateCompetencyConfidence(qualityItems, { redundancyReport: calculateEvidenceRedundancy(qualityItems) });
assert.ok(
  highConfidence.execution?.confidence > (lowConfidence.communication?.confidence || 0),
  "Confidence should rise with stronger, independent evidence."
);

const coverage = calculateEvidenceCoverage(qualityItems, {
  ownership: 2,
  execution: 2,
  analytical_reasoning: 1,
  stakeholder_influence: 1,
}, { confidenceByCompetency: highConfidence });
assert.ok(coverage.coverageScore > 0, "Coverage engine must calculate a coverage score.");
assert.ok(
  coverage.missingCompetencies.some((item) => item.competency === "stakeholder_influence"),
  "Coverage engine must return uncovered competencies."
);

const graph = buildEvidenceGraph(qualityItems, { roles: ["Product Management"], goals: ["Find product role"] });
assert.ok(graph.nodes.some((item) => item.type === "evidence"), "Graph must include evidence nodes.");
assert.ok(graph.nodes.some((item) => item.type === "competency"), "Graph must include competency nodes.");
assert.ok(graph.edges.some((item) => item.type === "supports_competency"), "Graph must include support edges.");
assert.ok(graph.getEvidenceForCompetency("ownership").some((item) => item.id === shippedProduct.id), "Graph must query evidence by competency.");

const intelligence = buildEvidenceIntelligenceLayer({
  evidenceItems: [genericClaim, shippedProduct, dashboardProject],
  requirements: {
    ownership: 2,
    execution: 2,
    strategic_reasoning: 1,
    stakeholder_influence: 1,
  },
  roles: ["Strategy & Operations Intern", "Product Manager"],
  goals: ["Career decision"],
  context: {
    roleContext: "Strategy & Operations",
    targetRole: "Strategy & Operations Intern",
    now,
  },
});

assert.equal(intelligence.mode, "shadow", "Evidence Intelligence Layer must remain shadow mode.");
assert.equal(intelligence.evidenceObjects.length, 3, "Layer must return first-class evidence objects.");
assert.ok(intelligence.evidenceObjects.every((item) => Number.isFinite(item.strength)), "Evidence objects need strength.");
assert.ok(intelligence.evidenceObjects.every((item) => Number.isFinite(item.trust)), "Evidence objects need trust.");
assert.ok(intelligence.evidenceObjects.every((item) => Number.isFinite(item.freshness)), "Evidence objects need freshness.");
assert.ok(intelligence.evidenceObjects.every((item) => Number.isFinite(item.quality)), "Evidence objects need quality.");
assert.ok(intelligence.confidenceByCompetency.ownership, "Layer must compute competency confidence.");
assert.ok(intelligence.coverage.missingCompetencies.length >= 1, "Layer must compute missing coverage.");
assert.ok(intelligence.graph.edges.length > 0, "Layer must create an evidence graph.");
assert.ok(intelligence.opportunityImpact.mode === "shadow", "Opportunity impact must remain shadow mode.");
assert.ok(intelligence.opportunityImpact.impacts.length >= 1, "Opportunity impact must be evidence-driven.");

console.error("Evidence Intelligence Layer tests: PASS");
