import {
  buildGapCandidates,
  compareGapSelections,
  evaluateEvidenceSet,
  rankGapCandidates,
  selectBiggestGap,
} from "../lib/careerIntelligence/evidence/index.js";

const now = new Date("2026-07-30T12:00:00.000Z");

function report(items, roleContext = "Strategy & Operations") {
  return evaluateEvidenceSet(items, { roleContext, lang: "EN", now });
}

function snap({ gap, action, roleName = "Strategy & Operations Intern", roleFamily = "BUSINESS", missingSignals = [gap], confidence = "Medium" }) {
  return {
    gapDetails: {
      title: gap,
      whyItMatters: `${gap} is the current Snapshot blocker.`,
      evidenceMissing: `${gap} is not visible enough.`,
      action,
    },
    primaryRoleMatch: {
      roleName,
      roleFamily,
      confidence,
      missingSignals,
    },
  };
}

const fixtures = [
  {
    name: "clear business impact proof gap",
    snapshot: snap({ gap: "Business Case Work", action: "Write one business case in problem, options, decision, result format." }),
    evidence: report([{ title: "Ops project", description: "Owned operations workflow but no business impact metric is visible.", source_type: "cv", role_context: "Strategy & Operations", occurred_at: "2026" }]),
  },
  {
    name: "ownership strong outcomes weak",
    snapshot: snap({ gap: "Measurable Impact Proof", action: "Add one measurable result." }),
    evidence: report([{ title: "Founder ownership", description: "Founder and end-to-end owner of a startup.", source_type: "career_dna", role_context: "Product", occurred_at: "2026" }], "Product"),
  },
  {
    name: "execution strong stakeholder weak",
    snapshot: snap({ gap: "Stakeholder Influence", action: "Add one stakeholder-impact example." }),
    evidence: report([{ title: "Workflow delivery", description: "Shipped workflow that reduced turnaround by 18%.", source_type: "cv", role_context: "Operations", occurred_at: "2026" }], "Operations"),
  },
  {
    name: "generic skills target-role proof weak",
    snapshot: snap({ gap: "Role-Specific Skill Proof", action: "Create one target-role artifact." }),
    evidence: report([{ title: "Leadership", description: "Strong communication and leadership.", source_type: "user_statement", role_context: "Product" }], "Product"),
  },
  {
    name: "recent weak vs older strong",
    snapshot: snap({ gap: "Recent Evidence", action: "Clarify the current version of your strongest proof." }),
    evidence: report([
      { title: "Old dashboard", description: "Built a SQL dashboard that supported a business decision.", source_type: "portfolio", role_context: "Data Analyst", occurred_at: "2020" },
      { title: "Recent analytics interest", description: "Interested in analytics.", source_type: "career_dna", role_context: "Data Analyst", occurred_at: "2026" },
    ], "Data Analyst"),
  },
  {
    name: "multiple equally weak categories",
    snapshot: snap({ gap: "Business Case Work", action: "Write one business case." }),
    evidence: report([
      { title: "Project claim", description: "Built a project.", source_type: "user_statement", role_context: "Strategy" },
      { title: "Leadership claim", description: "Led work.", source_type: "user_statement", role_context: "Strategy" },
    ]),
  },
  {
    name: "empty evidence set",
    snapshot: snap({ gap: "Business Case Work", action: "Write one business case." }),
    evidence: report([]),
  },
  {
    name: "legacy snapshot only",
    snapshot: snap({ gap: "Case Study Proof", action: "Publish one portfolio case study." }),
    evidence: report([]),
  },
  {
    name: "contradictory evidence",
    snapshot: snap({ gap: "Measurable Impact Proof", action: "Add one measurable result." }),
    evidence: report([{ title: "Founder ownership", description: "Founder and end-to-end owner of a startup.", source_type: "career_dna", role_context: "Product", occurred_at: "2026" }], "Product"),
  },
  {
    name: "no target role",
    snapshot: snap({ gap: "Business Case Work", action: "Write one business case.", roleName: "", missingSignals: ["Business Case Work"] }),
    evidence: report([{ title: "Business case", description: "Drafted business case with no visible outcome.", source_type: "portfolio", role_context: "", occurred_at: "2026" }], ""),
  },
  {
    name: "low confidence role match",
    snapshot: snap({ gap: "Product Metrics", action: "Add one product metric.", roleName: "Product Manager", roleFamily: "PRODUCT", confidence: "Low" }),
    evidence: report([{ title: "Product interest", description: "Interested in product management.", source_type: "career_dna", role_context: "Product" }], "Product"),
  },
  {
    name: "strong unrelated category",
    snapshot: snap({ gap: "Business Case Work", action: "Write one business case.", roleName: "Strategy Analyst" }),
    evidence: report([{ title: "Node API", description: "Deployed Node API with tests and public GitHub repository.", source_type: "github", role_context: "Software", occurred_at: "2026" }], "Software"),
  },
  {
    name: "missing portfolio proof",
    snapshot: snap({ gap: "Portfolio Proof", action: "Publish one portfolio case." }),
    evidence: report([{ title: "Project claim", description: "Built a project.", source_type: "user_statement", role_context: "Product" }], "Product"),
  },
  {
    name: "strong profile no meaningful blocker",
    snapshot: snap({ gap: "Recent Evidence", action: "Keep strongest proof current.", roleName: "Product Manager", roleFamily: "PRODUCT" }),
    evidence: report([{ title: "Launched product", description: "Owned and launched product for 500 users, increasing activation by 24%.", source_type: "portfolio", role_context: "Product", occurred_at: "2026" }], "Product"),
  },
  {
    name: "continuity should remain preferred",
    snapshot: snap({ gap: "Business Case Work", action: "Write one business case." }),
    evidence: report([{ title: "Strategy project", description: "Built a business case with recommendation but no outcome yet.", source_type: "portfolio", role_context: "Strategy & Operations", occurred_at: "2026" }]),
  },
];

function runFixture(fixture) {
  const snapshot = fixture.snapshot;
  const context = {
    targetRole: snapshot.primaryRoleMatch?.roleName,
    roleContext: snapshot.primaryRoleMatch?.roleFamily,
    currentAction: snapshot.gapDetails?.action,
    evidenceReport: fixture.evidence,
  };
  const candidates = buildGapCandidates({}, snapshot, fixture.evidence, context);
  const ranked = rankGapCandidates(candidates, context);
  const selected = selectBiggestGap(candidates, context);
  const comparison = compareGapSelections(snapshot.gapDetails, selected, {
    rankedCandidates: ranked,
    currentConfidence: fixture.evidence?.confidenceScore,
  });
  const weeklyDecisionChainWouldChange = Boolean(
    selected &&
      comparison.agreementType !== "exact_match" &&
      comparison.agreementType !== "insufficient_shadow_confidence" &&
      comparison.agreementType !== "insufficient_data"
  );
  return {
    name: fixture.name,
    currentGap: snapshot.gapDetails.title,
    shadowGap: selected?.title || null,
    shadowCategory: selected?.category || null,
    agreementType: comparison.agreementType,
    categoryAgreement: comparison.categoryAgreement,
    confidence: selected?.confidence ?? 0,
    evidenceBasis: selected?.evidenceSupport || [],
    rankingFactors: selected?.rankingFactors || {},
    reasonForDifference: comparison.reasonForDifference,
    migrationRecommendation: comparison.migrationRecommendation,
    weeklyDecisionChainWouldChange,
    ranking: ranked.slice(0, 3).map((candidate) => ({
      title: candidate.title,
      category: candidate.category,
      score: candidate.shadowScore,
      confidence: candidate.confidence,
      source: candidate.source,
    })),
  };
}

const results = fixtures.map(runFixture);
const count = results.length;
const rate = (predicate) => Number((results.filter(predicate).length / count).toFixed(2));
const metrics = {
  fixtureCount: count,
  exactMatchRate: rate((row) => row.agreementType === "exact_match"),
  categoryMatchRate: rate((row) => row.agreementType === "category_match" || row.categoryAgreement),
  relatedGapRate: rate((row) => row.agreementType === "related_gap"),
  meaningfulDisagreementRate: rate((row) => row.agreementType === "meaningful_disagreement"),
  insufficientDataRate: rate((row) => row.agreementType === "insufficient_data" || row.agreementType === "insufficient_shadow_confidence"),
  averageShadowConfidence: Number((results.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / count).toFixed(1)),
  weeklyDecisionChainChangeCases: results.filter((row) => row.weeklyDecisionChainWouldChange).map((row) => row.name),
};

console.error("=== Gap Shadow Validation ===");
console.error(JSON.stringify({ metrics, results }, null, 2));
