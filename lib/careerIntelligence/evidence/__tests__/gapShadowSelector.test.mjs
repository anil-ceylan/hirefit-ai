import assert from "node:assert/strict";
import {
  buildGapCandidates,
  compareGapSelections,
  evaluateEvidenceSet,
  evaluateGapCandidate,
  rankGapCandidates,
  selectBiggestGap,
} from "../index.js";

const now = new Date("2026-07-30T12:00:00.000Z");

function evidenceReport(items, roleContext = "Strategy & Operations") {
  return evaluateEvidenceSet(items, { roleContext, lang: "EN", now });
}

function snapshot({ gap = "Business Case Work", action = "Write one business case.", missingSignals = [gap], roleName = "Strategy & Operations Intern" } = {}) {
  return {
    gapDetails: {
      title: gap,
      whyItMatters: `${gap} limits recruiter credibility.`,
      evidenceMissing: `${gap} is not visible.`,
      action,
    },
    primaryRoleMatch: {
      roleName,
      roleFamily: "BUSINESS",
      missingSignals,
    },
  };
}

function shadow(profile, snap, report, context = {}) {
  const candidates = buildGapCandidates(profile, snap, report, context);
  const ranked = rankGapCandidates(candidates, {
    targetRole: snap?.primaryRoleMatch?.roleName,
    roleContext: snap?.primaryRoleMatch?.roleFamily,
    currentAction: snap?.gapDetails?.action,
    evidenceReport: report,
  });
  return {
    candidates,
    ranked,
    selected: selectBiggestGap(candidates, {
      targetRole: snap?.primaryRoleMatch?.roleName,
      roleContext: snap?.primaryRoleMatch?.roleFamily,
      currentAction: snap?.gapDetails?.action,
      evidenceReport: report,
    }),
  };
}

const strongBusinessImpact = evidenceReport([
  {
    title: "Workflow project",
    description: "Owned workflow redesign but no measurable business impact is stated.",
    source_type: "cv",
    role_context: "Strategy & Operations",
    occurred_at: "2026",
  },
]);

const strongOwnershipWeakOutcome = evidenceReport([
  {
    title: "Founder ownership",
    description: "Founder and end-to-end owner of a product.",
    source_type: "career_dna",
    role_context: "Product",
    occurred_at: "2026",
  },
]);

const stakeholderWeak = evidenceReport([
  {
    title: "Delivered operations workflow",
    description: "Shipped a workflow independently with 18% faster turnaround.",
    source_type: "cv",
    role_context: "Operations",
    occurred_at: "2026",
  },
]);

const genericSkills = evidenceReport([
  {
    title: "Communication and leadership",
    description: "Strong communication and leadership.",
    source_type: "user_statement",
    role_context: "Product",
  },
]);

const oldStrongRecentWeak = evidenceReport([
  {
    title: "Old SQL dashboard",
    description: "Built SQL dashboard supporting a business decision.",
    source_type: "portfolio",
    role_context: "Data Analyst",
    occurred_at: "2020",
  },
  {
    title: "Recent analytics interest",
    description: "Interested in analytics.",
    source_type: "career_dna",
    role_context: "Data Analyst",
    occurred_at: "2026",
  },
]);

const empty = evidenceReport([]);

const legacySnap = snapshot({ gap: "Business Case Work", action: "Write one business case." });
const legacyResult = shadow({}, legacySnap, empty);
assert.ok(legacyResult.candidates.length >= 1, "Legacy Snapshot-only profile must still create current-gap candidate.");
assert.equal(legacyResult.selected.insufficientConfidence, true, "Empty evidence set should be insufficient confidence.");

const original = snapshot({ gap: "Business Case Work" });
const clone = structuredClone(original);
buildGapCandidates({}, original, strongBusinessImpact);
assert.deepEqual(original, clone, "Gap candidate builder must not mutate source snapshot.");

const deterministicA = shadow({}, snapshot({ gap: "Business Case Work" }), strongBusinessImpact).ranked;
const deterministicB = shadow({}, snapshot({ gap: "Business Case Work" }), strongBusinessImpact).ranked;
assert.deepEqual(deterministicA, deterministicB, "Ranking must be deterministic.");

const tieCandidates = [
  { id: "b", category: "business_case", title: "B", severity: 70, confidence: 50, source: "missing_signal" },
  { id: "a", category: "business_case", title: "A", severity: 70, confidence: 50, source: "missing_signal" },
];
const tied = rankGapCandidates(tieCandidates, { targetRole: "Strategy", roleContext: "BUSINESS", currentAction: "Write one business case." });
assert.equal(tied[0].title, "A", "Tie-breaking must be stable by title after equal score/severity/source.");

const malformed = buildGapCandidates(null, { gapDetails: { title: null } }, null);
assert.ok(Array.isArray(malformed), "Malformed input must not throw.");

const targetWeightedBusiness = evaluateGapCandidate(
  { id: "x", category: "business_case", title: "Business Case Work", severity: 80, confidence: 60, source: "missing_signal" },
  { targetRole: "Strategy & Operations", roleContext: "BUSINESS", currentAction: "Write one business case." }
);
const targetWeightedSoftware = evaluateGapCandidate(
  { id: "x", category: "business_case", title: "Business Case Work", severity: 80, confidence: 60, source: "missing_signal" },
  { targetRole: "Software Engineer", roleContext: "SOFTWARE", currentAction: "Write one business case." }
);
assert.ok(targetWeightedBusiness.shadowScore > targetWeightedSoftware.shadowScore, "Target-role weighting must affect ranking.");

const actionable = evaluateGapCandidate(
  { id: "a", category: "business_case", title: "Business Case Work", severity: 70, confidence: 60, source: "missing_signal" },
  { targetRole: "Strategy", roleContext: "BUSINESS", currentAction: "Write one business case." }
);
const unactionable = evaluateGapCandidate(
  { id: "u", category: "business_case", title: "Business Case Work", severity: 70, confidence: 60, source: "missing_signal" },
  { targetRole: "Strategy", roleContext: "BUSINESS", currentAction: "Update LinkedIn headline." }
);
assert.ok(actionable.shadowScore > unactionable.shadowScore, "Actionability must affect ranking.");

const duplicateSnap = snapshot({ missingSignals: ["Business Case Work", "Case Study Proof", "Business Case Work"] });
const duplicates = buildGapCandidates({}, duplicateSnap, strongBusinessImpact);
const categories = duplicates.map((candidate) => candidate.category);
assert.equal(categories.length, new Set(categories).size, "Duplicate/overlapping gaps must be deduped by category.");

const contradictionResult = shadow({}, snapshot({ gap: "Measurable Impact Proof", action: "Add one measurable result." }), strongOwnershipWeakOutcome);
assert.ok(
  contradictionResult.ranked.some((candidate) => candidate.source === "contradiction"),
  "Contradiction signals must create candidates."
);

const noMeaningfulBlocker = shadow({}, snapshot({ gap: "Recent Evidence", action: "Update the date." }), evidenceReport([
  {
    title: "Launched product",
    description: "Owned and launched product for 500 users, increasing activation by 24%.",
    source_type: "portfolio",
    role_context: "Product",
    occurred_at: "2026",
  },
]));
assert.ok(noMeaningfulBlocker.selected, "Strong profile should still produce a shadow selection for comparison.");

const currentVsShadow = compareGapSelections(
  { title: "Business Case Work", whyItMatters: "Needs a business case." },
  shadow({}, snapshot({ gap: "Business Case Work" }), strongBusinessImpact).selected,
  { rankedCandidates: deterministicA }
);
assert.ok(
  ["exact_match", "category_match", "related_gap", "insufficient_shadow_confidence", "meaningful_disagreement"].includes(currentVsShadow.agreementType),
  "Comparison must produce a known agreement type."
);

const stakeholderUnrelated = shadow(
  {},
  snapshot({ gap: "Stakeholder Influence", action: "Add one stakeholder-impact example." }),
  evidenceReport([
    {
      title: "Strong technical repo",
      description: "Deployed a Node API with tests and public GitHub repo.",
      source_type: "github",
      role_context: "Software",
      occurred_at: "2026",
    },
  ], "Software")
);
assert.ok(stakeholderUnrelated.selected, "Unrelated evidence fixture must still rank for shadow comparison.");

const portfolioMissing = shadow(
  {},
  snapshot({ gap: "Portfolio Proof", action: "Publish one portfolio case." }),
  evidenceReport([{ title: "Project claim", description: "Built a project.", source_type: "user_statement", role_context: "Product" }], "Product")
);
assert.ok(portfolioMissing.ranked.some((candidate) => candidate.category === "portfolio_proof"), "Missing portfolio proof must be represented.");

const lowConfidence = shadow({}, snapshot({ gap: "Business Case Work" }), genericSkills);
assert.ok(lowConfidence.selected.insufficientConfidence, "Low confidence should mark shadow selection insufficient.");

const noTargetRole = shadow({ target_roles: [] }, snapshot({ roleName: "", gap: "Business Case Work" }), strongBusinessImpact);
assert.ok(noTargetRole.selected, "No target role must not crash selector.");

console.error("Gap shadow selector tests: PASS");
