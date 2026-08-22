import assert from "node:assert/strict";
import {
  buildCoreIntelligence,
  evaluateEvidenceForRole,
} from "../lib/careerIntelligence/coreIntelligenceEngine.js";

const titleOnly = {
  basic_profile: { leadershipRole: "Founder" },
  career_goals: { primaryRole: "product_manager", targetRoles: ["product_manager"] },
  career_readiness: { benchmarks: { leadership: "founder_cofounder", projects: "none", experience: "none" } },
};

const builderWithProof = {
  basic_profile: {
    leadershipRole: "Founder",
    portfolioUrl: "https://example.com/case",
  },
  career_goals: { primaryRole: "product_manager", targetRoles: ["product_manager"] },
  cvText: [
    "Founded and launched a live onboarding product used by 240 users.",
    "Interviewed 18 users and changed the onboarding roadmap from their feedback.",
    "Worked cross-functionally with engineering and design to ship the release.",
    "Reduced onboarding drop-off by 21% after two product iterations.",
  ].join("\n"),
};

const titleCore = buildCoreIntelligence({ profile: titleOnly, roleFamily: "PRODUCT", targetRole: "product_manager", lang: "EN" });
const builderCore = buildCoreIntelligence({ profile: builderWithProof, roleFamily: "PRODUCT", targetRole: "product_manager", lang: "EN" });

assert.ok(
  builderCore.confidence.score > titleCore.confidence.score,
  "Shipped and measured proof must outrank a founder title."
);
assert.ok(
  titleCore.conflicts.some((conflict) => conflict.id === "founder_without_execution"),
  "A founder title without execution must create a conflict."
);
assert.ok(
  !builderCore.conflicts.some((conflict) => conflict.id === "founder_without_execution"),
  "Execution proof must resolve founder-title inflation."
);

const duplicatedProfile = {
  ...builderWithProof,
  cvText: `${builderWithProof.cvText}\n${builderWithProof.cvText}`,
};
const duplicatedCore = buildCoreIntelligence({ profile: duplicatedProfile, roleFamily: "PRODUCT", targetRole: "product_manager", lang: "EN" });
assert.equal(
  duplicatedCore.confidence.score,
  builderCore.confidence.score,
  "Repeated wording must not increase confidence."
);

const technicalProfile = {
  basic_profile: { githubUrl: "https://github.com/example" },
  cvText: "Built and deployed a Node API with automated tests and documented the repository on GitHub.",
};
const technicalCore = buildCoreIntelligence({ profile: technicalProfile, roleFamily: "SOFTWARE", targetRole: "software_engineer", lang: "EN" });
const softwareEvaluation = evaluateEvidenceForRole(technicalCore, { roleFamily: "SOFTWARE", targetRole: "software_engineer", lang: "EN" });
const businessEvaluation = evaluateEvidenceForRole(technicalCore, { roleFamily: "BUSINESS", targetRole: "strategy_analyst", lang: "EN" });
assert.ok(
  softwareEvaluation.evidenceQuality > businessEvaluation.evidenceQuality,
  "Technical proof must carry more influence in a software context."
);

assert.ok(
  titleCore.recommendation?.closesEvidenceGap,
  "A weak profile must receive one evidence-gap recommendation."
);
assert.ok(
  titleCore.recommendation?.action,
  "The recommendation must specify the proof to create."
);

const report = {
  titleOnly: {
    confidence: titleCore.confidence,
    conflicts: titleCore.conflicts.map((conflict) => conflict.id),
    opportunity: titleCore.opportunity,
  },
  builderWithProof: {
    confidence: builderCore.confidence,
    graph: builderCore.graph.metrics,
    strongestEvidence: builderCore.recruiterReasoning.strongestEvidence,
  },
  contextualWeighting: {
    softwareEvidenceQuality: softwareEvaluation.evidenceQuality,
    businessEvidenceQuality: businessEvaluation.evidenceQuality,
  },
  duplicateGuard: {
    originalConfidence: builderCore.confidence.score,
    repeatedConfidence: duplicatedCore.confidence.score,
  },
};

console.error("=== Core Intelligence V2 Validation ===");
console.error(JSON.stringify(report, null, 2));
console.error("\nCore intelligence validation: PASS");
