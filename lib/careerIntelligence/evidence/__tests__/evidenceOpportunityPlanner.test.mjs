import assert from "node:assert/strict";
import {
  buildEvidenceOpportunities,
  buildOpportunityPlanningReport,
  buildQuestionPlan,
  buildQuestionPlans,
  evaluateEvidenceSet,
  rankEvidenceOpportunities,
  selectNextEvidenceOpportunity,
  selectNextQuestionPlan,
} from "../index.js";

const now = new Date("2026-07-30T12:00:00.000Z");

function report(items, roleContext = "Strategy & Operations") {
  return evaluateEvidenceSet(items, { roleContext, lang: "EN", now });
}

function snapshot({ gap = "Business Case Work", action = "Write one business case.", roleName = "Strategy & Operations Intern", roleFamily = "BUSINESS", missingSignals = [gap] } = {}) {
  return {
    gapDetails: {
      title: gap,
      whyItMatters: `${gap} limits recruiter confidence.`,
      evidenceMissing: `${gap} is not visible enough.`,
      action,
    },
    primaryRoleMatch: {
      roleName,
      roleFamily,
      missingSignals,
    },
  };
}

const businessImpactNoMetric = report([
  {
    id: "ops-1",
    title: "Operations workflow",
    description: "Owned a workflow redesign that improved customer onboarding.",
    source_type: "cv",
    role_context: "Strategy & Operations",
    occurred_at: "2026",
  },
]);

const opportunities = buildEvidenceOpportunities({
  snapshot: snapshot({ gap: "Measurable Impact Proof", action: "Add one measurable result." }),
  evidenceReport: businessImpactNoMetric,
  context: { targetRole: "Strategy & Operations Intern", roleContext: "BUSINESS" },
});

assert.ok(opportunities.length > 0, "Planner must discover opportunities.");
assert.ok(
  opportunities.some((item) => item.category === "measurable_impact" && item.source.includes("business_impact_without_metric")),
  "Business-impact evidence without a metric must create a measurable-impact opportunity."
);

const metricPlan = selectNextQuestionPlan(opportunities, { targetRole: "Strategy & Operations Intern", roleContext: "BUSINESS" });
assert.equal(metricPlan.questionType, "metric_quantification", "Top measurable-impact opportunity should plan a metric question type.");
assert.ok(metricPlan.completionCriteria.some((line) => /metric|before-after/.test(line)), "Metric plan must define metric completion criteria.");

const leadershipNoOwnership = buildEvidenceOpportunities({
  snapshot: snapshot({ gap: "Ownership Proof", action: "Clarify ownership scope.", roleName: "Product Manager", roleFamily: "PRODUCT" }),
  evidenceReport: report([
    {
      id: "lead-1",
      title: "Leadership interest",
      description: "Interested in leadership and team communication.",
      source_type: "career_dna",
      role_context: "Product",
      occurred_at: "2026",
    },
  ], "Product"),
  context: { targetRole: "Product Manager", roleContext: "PRODUCT" },
});
assert.ok(leadershipNoOwnership.some((item) => item.category === "ownership"), "Leadership without ownership scope must create ownership opportunity.");

const projectNoArtifact = buildEvidenceOpportunities({
  snapshot: snapshot({ gap: "Portfolio Proof", action: "Publish one portfolio case.", roleName: "Product Manager", roleFamily: "PRODUCT" }),
  evidenceReport: report([
    {
      id: "project-1",
      title: "Product case project",
      description: "Built a product case around onboarding.",
      source_type: "user_statement",
      role_context: "Product",
      occurred_at: "2026",
    },
  ], "Product"),
  context: { targetRole: "Product Manager", roleContext: "PRODUCT" },
});
assert.ok(projectNoArtifact.some((item) => item.category === "portfolio_proof"), "Project-shaped evidence without artifact must create portfolio-proof opportunity.");

const internshipNoStakeholder = buildEvidenceOpportunities({
  snapshot: snapshot({ gap: "Stakeholder Influence", action: "Add stakeholder context." }),
  evidenceReport: report([
    {
      id: "intern-1",
      title: "Operations internship",
      description: "Completed internship tasks and supported daily operations.",
      source_type: "cv",
      role_context: "Operations",
      occurred_at: "2026",
    },
  ], "Operations"),
  context: { targetRole: "Operations Analyst", roleContext: "OPERATIONS" },
});
assert.ok(internshipNoStakeholder.some((item) => item.category === "stakeholder_influence"), "Internship without stakeholder evidence must create stakeholder opportunity.");

const strongAnswered = buildEvidenceOpportunities({
  snapshot: snapshot({ gap: "Recent Evidence", action: "Keep proof current.", roleName: "Product Manager", roleFamily: "PRODUCT" }),
  evidenceReport: report([
    {
      id: "strong-1",
      title: "Launched product",
      description: "Owned and launched a product for 800 users, increasing activation by 24%.",
      source_type: "portfolio",
      role_context: "Product Manager",
      occurred_at: "2026",
      metrics: ["800 users", "24% activation increase"],
    },
  ], "Product Manager"),
  context: { targetRole: "Product Manager", roleContext: "PRODUCT" },
});
assert.ok(
  !strongAnswered.some((item) => item.category === "measurable_impact" && item.source.includes("business_impact_without_metric")),
  "Already answered measurable outcomes must not create repeated metric questions."
);

const deterministicA = buildEvidenceOpportunities({
  snapshot: snapshot(),
  evidenceReport: businessImpactNoMetric,
  context: { targetRole: "Strategy & Operations Intern", roleContext: "BUSINESS" },
});
const deterministicB = buildEvidenceOpportunities({
  snapshot: snapshot(),
  evidenceReport: businessImpactNoMetric,
  context: { targetRole: "Strategy & Operations Intern", roleContext: "BUSINESS" },
});
assert.deepEqual(deterministicA, deterministicB, "Opportunity ranking must be deterministic.");

const strategyRanked = rankEvidenceOpportunities([
  {
    id: "portfolio",
    category: "portfolio_proof",
    title: "Portfolio Proof",
    confidenceGainPotential: 65,
    decisionImpact: 65,
    recruiterImpact: 65,
    roleRelevance: 55,
    estimatedUserEffort: { minutes: 70, band: "high" },
    currentEvidenceStrength: 20,
    missingEvidence: "Portfolio proof",
    recommendedQuestionTypes: ["artifact_link"],
    blockingDecision: "Missing artifact.",
    reason: "Missing artifact.",
    status: "active",
    source: "test",
  },
  {
    id: "business",
    category: "business_case",
    title: "Business Case Work",
    confidenceGainPotential: 65,
    decisionImpact: 65,
    recruiterImpact: 65,
    roleRelevance: 90,
    estimatedUserEffort: { minutes: 45, band: "medium" },
    currentEvidenceStrength: 20,
    missingEvidence: "Business case",
    recommendedQuestionTypes: ["business_case_structure"],
    blockingDecision: "Missing business case.",
    reason: "Missing business case.",
    status: "active",
    source: "test",
  },
], { evidenceReport: businessImpactNoMetric });
assert.equal(strategyRanked[0].category, "business_case", "Ranking must prefer higher decision-relevant opportunities.");

const plan = buildQuestionPlan(strategyRanked[0], { targetRole: "Strategy & Operations Intern", roleContext: "BUSINESS" });
assert.deepEqual(
  Object.keys(plan).sort(),
  [
    "blockingReason",
    "category",
    "completionCriteria",
    "expectedConfidenceGain",
    "expectedEvidence",
    "goal",
    "id",
    "opportunityId",
    "possibleFollowUps",
    "questionType",
    "requiredContext",
  ].sort(),
  "Question plan must expose the canonical planning contract."
);
assert.ok(!/\?$/.test(plan.goal), "Planner must not generate natural-language questions.");

const malformed = buildEvidenceOpportunities({ profile: null, snapshot: null, evidenceReport: null });
assert.ok(Array.isArray(malformed), "Malformed input must not throw.");

const selected = selectNextEvidenceOpportunity(opportunities, { evidenceReport: businessImpactNoMetric });
assert.ok(selected?.status === "active", "Selected opportunity must be active.");

const plans = buildQuestionPlans(opportunities, { targetRole: "Strategy & Operations Intern", roleContext: "BUSINESS" });
assert.ok(plans.length > 0, "Active opportunities must produce question plans.");

const planningReport = buildOpportunityPlanningReport({
  snapshot: snapshot(),
  evidenceReport: businessImpactNoMetric,
  context: { targetRole: "Strategy & Operations Intern", roleContext: "BUSINESS" },
});
assert.equal(planningReport.mode, "shadow", "Planning report must explicitly remain in shadow mode.");
assert.ok(planningReport.rankingWeights, "Planning report must expose explainable ranking weights.");
assert.ok(planningReport.nextQuestionPlan, "Planning report must include the next question plan.");

console.error("Evidence opportunity planner tests: PASS");
