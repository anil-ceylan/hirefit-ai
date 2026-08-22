import {
  buildOpportunityPlanningReport,
  evaluateEvidenceSet,
} from "../lib/careerIntelligence/evidence/index.js";

const now = new Date("2026-07-30T12:00:00.000Z");

function report(items, roleContext = "Strategy & Operations") {
  return evaluateEvidenceSet(items, { roleContext, lang: "EN", now });
}

function snap({ gap, action, roleName = "Strategy & Operations Intern", roleFamily = "BUSINESS", missingSignals = [gap] }) {
  return {
    gapDetails: {
      title: gap,
      whyItMatters: `${gap} blocks a cleaner hiring decision.`,
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

const fixtures = [
  {
    name: "business impact without metric",
    snapshot: snap({ gap: "Measurable Impact Proof", action: "Add one measurable business result." }),
    evidence: report([
      {
        id: "ops-workflow",
        title: "Operations workflow",
        description: "Owned a workflow redesign that improved customer onboarding.",
        source_type: "cv",
        role_context: "Strategy & Operations",
        occurred_at: "2026",
      },
    ]),
  },
  {
    name: "leadership without ownership scope",
    snapshot: snap({ gap: "Ownership Proof", action: "Clarify ownership scope.", roleName: "Product Manager", roleFamily: "PRODUCT" }),
    evidence: report([
      {
        id: "leadership",
        title: "Leadership interest",
        description: "Interested in leadership and team communication.",
        source_type: "career_dna",
        role_context: "Product",
        occurred_at: "2026",
      },
    ], "Product"),
  },
  {
    name: "project without artifact",
    snapshot: snap({ gap: "Portfolio Proof", action: "Publish one project artifact.", roleName: "Product Analyst", roleFamily: "PRODUCT" }),
    evidence: report([
      {
        id: "project",
        title: "Product case project",
        description: "Built an onboarding case project.",
        source_type: "user_statement",
        role_context: "Product",
        occurred_at: "2026",
      },
    ], "Product"),
  },
  {
    name: "internship without stakeholders",
    snapshot: snap({ gap: "Stakeholder Influence", action: "Add stakeholder context.", roleName: "Operations Analyst", roleFamily: "OPERATIONS" }),
    evidence: report([
      {
        id: "internship",
        title: "Operations internship",
        description: "Completed internship tasks and supported daily operations.",
        source_type: "cv",
        role_context: "Operations",
        occurred_at: "2026",
      },
    ], "Operations"),
  },
  {
    name: "strong answered product proof",
    snapshot: snap({ gap: "Recent Evidence", action: "Keep proof current.", roleName: "Product Manager", roleFamily: "PRODUCT" }),
    evidence: report([
      {
        id: "launched-product",
        title: "Launched product",
        description: "Owned and launched a product for 800 users, increasing activation by 24%.",
        source_type: "portfolio",
        role_context: "Product Manager",
        occurred_at: "2026",
        metrics: ["800 users", "24% activation increase"],
      },
    ], "Product Manager"),
  },
  {
    name: "empty evidence",
    snapshot: snap({ gap: "Business Case Work", action: "Write one business case." }),
    evidence: report([]),
  },
];

function runFixture(fixture) {
  const context = {
    targetRole: fixture.snapshot.primaryRoleMatch.roleName,
    roleContext: fixture.snapshot.primaryRoleMatch.roleFamily,
    currentAction: fixture.snapshot.gapDetails.action,
  };
  const planning = buildOpportunityPlanningReport({
    snapshot: fixture.snapshot,
    evidenceReport: fixture.evidence,
    context,
  });
  return {
    name: fixture.name,
    topOpportunity: planning.topOpportunity
      ? {
          category: planning.topOpportunity.category,
          priority: planning.topOpportunity.priority,
          confidenceGainPotential: planning.topOpportunity.confidenceGainPotential,
          decisionImpact: planning.topOpportunity.decisionImpact,
          recruiterImpact: planning.topOpportunity.recruiterImpact,
          status: planning.topOpportunity.status,
          source: planning.topOpportunity.source,
        }
      : null,
    nextQuestionPlan: planning.nextQuestionPlan
      ? {
          questionType: planning.nextQuestionPlan.questionType,
          expectedEvidence: planning.nextQuestionPlan.expectedEvidence,
          expectedConfidenceGain: planning.nextQuestionPlan.expectedConfidenceGain,
          completionCriteria: planning.nextQuestionPlan.completionCriteria,
        }
      : null,
    activeOpportunityCount: planning.activeOpportunityCount,
    opportunityCount: planning.opportunityCount,
  };
}

const results = fixtures.map(runFixture);
const active = results.filter((item) => item.topOpportunity).length;
const metrics = {
  fixtureCount: results.length,
  activeFixtureRate: Number((active / results.length).toFixed(2)),
  uniqueTopCategories: [...new Set(results.map((item) => item.topOpportunity?.category).filter(Boolean))].length,
  uniqueQuestionTypes: [...new Set(results.map((item) => item.nextQuestionPlan?.questionType).filter(Boolean))].length,
  shadowModeOnly: true,
};

console.error("=== Evidence Opportunity Planning Validation ===");
console.error(JSON.stringify({ metrics, results }, null, 2));
