import assert from "node:assert/strict";
import {
  adaptLegacyEvidence,
  evaluateEvidence,
  evaluateEvidenceSet,
  evidenceFromCareerProfile,
  hasActionableEvidenceReport,
  selectPrimaryEvidenceGap,
} from "../index.js";

const now = new Date("2026-07-30T12:00:00.000Z");

const weakVagueClaim = evaluateEvidence(
  {
    title: "Leadership",
    description: "Strong leader",
    source_type: "user_statement",
    role_context: "Product",
  },
  { now }
);

const strongQuantifiedResult = evaluateEvidence(
  {
    title: "Launched onboarding product",
    description: "Owned and shipped onboarding product for 240 users, reducing drop-off by 21%.",
    source_type: "cv",
    role_context: "Product",
    occurred_at: "2026",
  },
  { now }
);

assert.ok(
  strongQuantifiedResult.normalized_weight > weakVagueClaim.normalized_weight,
  "Strong quantified results must outrank vague claims."
);

const oldRelevant = evaluateEvidence(
  {
    title: "Built SQL dashboard",
    description: "Built a dashboard that supported pricing decisions.",
    source_type: "portfolio",
    role_context: "Data",
    occurred_at: "2019",
  },
  { now }
);

const recentWeak = evaluateEvidence(
  {
    title: "Interested in data",
    description: "Interested in analytics.",
    source_type: "career_dna",
    role_context: "Data",
    occurred_at: "2026",
  },
  { now }
);

assert.ok(
  oldRelevant.normalized_weight > recentWeak.normalized_weight,
  "Old but relevant evidence must beat recent weak interest."
);

const ownerNoOutcome = evaluateEvidence(
  {
    title: "Founder",
    description: "Founder and end-to-end owner of a startup.",
    source_type: "user_statement",
    role_context: "Product",
    occurred_at: "2026",
  },
  { now }
);

assert.ok(
  ownerNoOutcome.contradictions.includes("high_ownership_without_outcome"),
  "High ownership without outcome must be flagged."
);

const outcomeLowOwnership = evaluateEvidence(
  {
    title: "Campaign result",
    description: "Supported a campaign that increased signups by 18%.",
    source_type: "cv",
    role_context: "Marketing",
    occurred_at: "2025",
  },
  { now }
);

assert.ok(
  outcomeLowOwnership.normalized_weight >= 50,
  "Strong outcome with lower ownership should still count as moderate evidence."
);

const missingDates = evaluateEvidence(
  {
    title: "Portfolio case",
    description: "Published a portfolio case showing the problem, decision and result.",
    source_type: "portfolio",
    role_context: "Business",
  },
  { now }
);

assert.ok(
  missingDates.missing_fields.includes("occurred_at"),
  "Missing dates must be visible in missing_fields."
);

const missingRoleContext = evaluateEvidence(
  {
    title: "Built project",
    description: "Built a project with a public demo.",
    source_type: "github",
    occurred_at: "2025",
  },
  { now }
);

assert.ok(
  missingRoleContext.missing_fields.includes("role_context"),
  "Missing role context must be visible in missing_fields."
);

const legacy = adaptLegacyEvidence([
  {
    id: "ev_core",
    type: "shipped_product",
    claim: "Launched MVP used by 120 users.",
    source: { id: "cv_text", kind: "resume" },
    occurredYear: 2025,
    dimensions: ["ownership", "execution"],
  },
]);

assert.equal(legacy[0].source_type, "cv", "Core engine records must adapt to canonical source types.");

const productSet = evaluateEvidenceSet(
  [
    strongQuantifiedResult,
    oldRelevant,
    recentWeak,
    ownerNoOutcome,
    outcomeLowOwnership,
  ],
  { roleContext: "Product", now, lang: "EN" }
);

const financeSet = evaluateEvidenceSet(
  [strongQuantifiedResult, oldRelevant, recentWeak],
  { roleContext: "Finance", now, lang: "EN" }
);

assert.ok(productSet.evidenceItems.length === 5, "Multiple evidence items must evaluate as a set.");
assert.ok(productSet.roleSpecificEvidenceScore >= financeSet.roleSpecificEvidenceScore, "Role weighting must affect role-specific score.");
assert.ok(hasActionableEvidenceReport(productSet), "Evidence set should be actionable.");
assert.ok(selectPrimaryEvidenceGap(productSet), "Evidence set must produce a primary gap.");

const emptySet = evaluateEvidenceSet([], { roleContext: "Product", now, lang: "EN" });
assert.equal(emptySet.overallEvidenceQuality, 0, "Empty evidence set quality must be zero.");
assert.equal(emptySet.confidenceScore, 0, "Empty evidence set confidence must be zero.");

const profileEvidence = evidenceFromCareerProfile({
  basic_profile: { cvFileName: "resume.pdf" },
  target_roles: ["Strategy & Operations Intern"],
  career_snapshot: {
    strongestSignal: "Founder experience",
    primaryRoleMatch: {
      roleName: "Strategy & Operations Intern",
      roleFamily: "BUSINESS",
      strongSignals: ["Business case thinking"],
    },
  },
});

assert.ok(profileEvidence.length >= 2, "Career profile legacy adapter must create evidence rows.");

console.error("Evidence Intelligence Foundation tests: PASS");
