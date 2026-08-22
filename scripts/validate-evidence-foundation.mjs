import {
  buildDecisionCoherenceReport,
  evaluateEvidenceSet,
  evidenceFromCareerProfile,
  selectPrimaryEvidenceGap,
} from "../lib/careerIntelligence/evidence/index.js";

const profile = {
  target_roles: ["Strategy & Operations Intern"],
  basic_profile: {
    cvFileName: "anil-cv.pdf",
    cvStatus: "uploaded",
  },
  career_snapshot: {
    gapDetails: {
      title: "Business Case Work",
      whyItMatters: "Recruiter needs one decision case with visible business impact.",
      action: "Write one business case in problem, options, decision, result format.",
    },
    strongestSignal: "Founder experience",
    primaryRoleMatch: {
      roleName: "Strategy & Operations Intern",
      roleFamily: "BUSINESS",
      strongSignals: ["Founder / builder ownership", "Technology and strategy focus"],
      missingSignals: ["Business Case Work", "Stakeholder impact"],
    },
  },
};

const oldDashboardDecision = {
  blocker: profile.career_snapshot.gapDetails.title,
  why: profile.career_snapshot.gapDetails.whyItMatters,
  action: profile.career_snapshot.gapDetails.action,
};

const evidenceItems = evidenceFromCareerProfile(profile, { lang: "EN" });
const report = evaluateEvidenceSet(evidenceItems, {
  roleContext: "BUSINESS",
  lang: "EN",
  now: new Date("2026-07-30T12:00:00.000Z"),
});
const gap = selectPrimaryEvidenceGap(report);
const candidateEvidenceReason = report.explanationText;
const coherence = buildDecisionCoherenceReport({
  blocker: oldDashboardDecision.blocker,
  existingReason: oldDashboardDecision.why,
  action: oldDashboardDecision.action,
  roleContext: "BUSINESS",
  evidenceReport: report,
  candidateReason: candidateEvidenceReason,
  fallbackReason: oldDashboardDecision.why,
});

const newDashboardDecision = {
  blocker: profile.career_snapshot.gapDetails.title,
  why: coherence.finalReason,
  action: profile.career_snapshot.gapDetails.action || gap?.action,
};

console.error("=== Evidence Foundation Consumer Drift ===");
console.error(JSON.stringify({
  oldDashboardDecision,
  newDashboardDecision,
  scores: {
    overallEvidenceQuality: report.overallEvidenceQuality,
    confidenceScore: report.confidenceScore,
    roleSpecificEvidenceScore: report.roleSpecificEvidenceScore,
  },
  strongestEvidence: report.strongestEvidence.map((item) => item.title),
  weakestEvidence: report.weakestEvidence.map((item) => item.title),
  contradictions: report.contradictionFlags,
  coherence,
}, null, 2));
