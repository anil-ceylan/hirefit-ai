import assert from "node:assert/strict";
import {
  adaptLegacyEvidence,
  buildDecisionCoherenceReport,
  evaluateDecisionCoherence,
  evaluateEvidenceSet,
  getContradictions,
  getEvidenceSummary,
  getMissingEvidence,
  getStrongestEvidence,
  getWeakestEvidence,
  normalizeEvidence,
} from "../index.js";

const now = new Date("2026-07-30T12:00:00.000Z");

function report(items, roleContext = "BUSINESS") {
  return evaluateEvidenceSet(items, { roleContext, lang: "EN", now });
}

const businessCaseEvidence = [
  {
    title: "Pricing business case",
    description: "Built a pricing business case with options, decision and 12% conversion impact.",
    source_type: "portfolio",
    role_context: "Strategy & Operations",
    occurred_at: "2026",
  },
];

const ownershipEvidence = [
  {
    title: "Founder ownership",
    description: "Founder and end-to-end owner of a startup that launched to 120 users.",
    source_type: "cv",
    role_context: "Strategy & Operations",
    occurred_at: "2026",
  },
];

const technicalEvidence = [
  {
    title: "Node API",
    description: "Built and deployed a Node API with tests.",
    source_type: "github",
    role_context: "Software",
    occurred_at: "2026",
  },
];

const lowConfidenceEvidence = [
  {
    title: "Strategy interest",
    description: "Interested in strategy.",
    source_type: "user_statement",
    role_context: "Strategy",
  },
];

const businessCaseReport = report(businessCaseEvidence);
const ownershipReport = report(ownershipEvidence);
const technicalReport = report(technicalEvidence, "SOFTWARE");
const lowConfidenceReport = report(lowConfidenceEvidence);
const emptyReport = report([]);

assert.ok(normalizeEvidence("Built project").id, "Public normalizeEvidence API must normalize a single item.");
assert.equal(normalizeEvidence(["A", "B"]).length, 2, "Public normalizeEvidence API must normalize lists.");
assert.ok(getEvidenceSummary(businessCaseReport).overallEvidenceQuality > 0, "Public summary API must expose evidence quality.");
assert.ok(getStrongestEvidence(businessCaseReport).length, "Public strongest evidence API must work.");
assert.ok(getWeakestEvidence(businessCaseReport).length, "Public weakest evidence API must work.");
assert.ok(Array.isArray(getMissingEvidence(businessCaseReport)), "Public missing evidence API must work.");
assert.ok(Array.isArray(getContradictions(ownershipReport)), "Public contradictions API must work.");

const legacyBefore = [{ claim: "Launched MVP for 100 users", source: { id: "cv", kind: "resume" } }];
const legacyCopy = structuredClone(legacyBefore);
const legacyAfter = adaptLegacyEvidence(legacyBefore);
assert.deepEqual(legacyBefore, legacyCopy, "Legacy adapter must not mutate source evidence.");
assert.equal(legacyAfter[0].source_type, "cv", "Legacy adapter must preserve source semantics.");

const matchingBusinessCase = evaluateDecisionCoherence({
  blocker: "Business Case Work",
  action: "Write one business case in problem, options, decision, result format.",
  roleContext: "Strategy & Operations",
  evidenceReport: businessCaseReport,
  candidateReason: "Pricing business case builds trust; business case detail should stay visible.",
});
assert.equal(matchingBusinessCase.useEvidenceReason, true, "Business case evidence should sharpen business case blocker.");

const businessBlockerOwnershipEvidence = evaluateDecisionCoherence({
  blocker: "Business Case Work",
  action: "Write one business case in problem, options, decision, result format.",
  roleContext: "Strategy & Operations",
  evidenceReport: ownershipReport,
  candidateReason: "Founder ownership builds trust but needs outcome proof.",
});
assert.equal(
  businessBlockerOwnershipEvidence.useEvidenceReason,
  false,
  "Business case blocker must not receive ownership explanation."
);

const ownershipBlockerOwnershipAction = evaluateDecisionCoherence({
  blocker: "Ownership proof",
  action: "Make founder ownership outcome visible.",
  roleContext: "Strategy & Operations",
  evidenceReport: ownershipReport,
  candidateReason: "Founder ownership needs a visible result.",
});
assert.equal(ownershipBlockerOwnershipAction.useEvidenceReason, true, "Ownership blocker and ownership action should align.");

const stakeholderWithTechnical = evaluateDecisionCoherence({
  blocker: "Stakeholder influence",
  action: "Add one stakeholder-impact example.",
  roleContext: "Strategy & Operations",
  evidenceReport: technicalReport,
  candidateReason: "Node API shows technical execution.",
});
assert.equal(stakeholderWithTechnical.useEvidenceReason, false, "Unrelated technical evidence must not replace stakeholder reason.");

const lowConfidence = evaluateDecisionCoherence({
  blocker: "Business Case Work",
  action: "Write one business case.",
  roleContext: "Strategy",
  evidenceReport: lowConfidenceReport,
  candidateReason: "Strategy interest indicates direction.",
});
assert.equal(lowConfidence.useEvidenceReason, false, "Low-confidence reports must fall back.");

const empty = evaluateDecisionCoherence({
  blocker: "Business Case Work",
  action: "Write one business case.",
  roleContext: "Strategy",
  evidenceReport: emptyReport,
  candidateReason: "Empty report.",
});
assert.equal(empty.useEvidenceReason, false, "Empty evidence set must fall back.");

const snapshotOnly = buildDecisionCoherenceReport({
  blocker: "Business Case Work",
  existingReason: "Recruiter needs one decision case.",
  action: "Write one business case.",
  roleContext: "Strategy",
  evidenceReport: emptyReport,
  candidateReason: "",
});
assert.equal(snapshotOnly.finalReason, "Recruiter needs one decision case.", "Legacy Snapshot-only data must preserve fallback reason.");

const competingWeaknesses = evaluateDecisionCoherence({
  blocker: "Stakeholder influence",
  action: "Add one stakeholder-impact example.",
  roleContext: "Strategy",
  evidenceReport: report([...businessCaseEvidence, ...ownershipEvidence]),
  candidateReason: "Pricing business case builds trust; stakeholder influence should be shown in the decision.",
});
assert.equal(competingWeaknesses.useEvidenceReason, true, "Competing evidence may be used when it names the selected blocker.");

const strongIrrelevant = evaluateDecisionCoherence({
  blocker: "Business Case Work",
  action: "Write one business case.",
  roleContext: "Strategy",
  evidenceReport: technicalReport,
  candidateReason: "Node API is strong evidence.",
});
assert.equal(strongIrrelevant.useEvidenceReason, false, "Strong but irrelevant evidence must fall back.");

const roleRelevantActionIrrelevant = evaluateDecisionCoherence({
  blocker: "Business Case Work",
  action: "Update LinkedIn headline.",
  roleContext: "Strategy",
  evidenceReport: businessCaseReport,
  candidateReason: "Pricing business case builds trust.",
});
assert.equal(roleRelevantActionIrrelevant.useEvidenceReason, false, "Role-relevant evidence must still align with the selected action.");

console.error("Evidence coherence tests: PASS");
