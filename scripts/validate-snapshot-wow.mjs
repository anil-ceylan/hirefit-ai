/**
 * Career Snapshot WOW validation — 30 synthetic personas.
 * Run: node scripts/validate-snapshot-wow.mjs
 */

import { scoreCareerDnaAnswers } from "../lib/careerOnboarding/careerDna.js";
import { buildCareerSnapshot } from "../lib/careerOnboarding/careerSnapshot.js";
import { isGenericExplanation } from "../lib/careerOnboarding/snapshotWow.js";

const ROLES = [
  "product_manager",
  "software_engineer",
  "data_analyst",
  "financial_analyst",
  "operations_analyst",
  "growth_manager",
  "business_analyst",
  "strategy_analyst",
  "ui_ux_designer",
  "founder",
  "project_manager",
  "talent_acquisition",
];

const ROLE_DNA = {
  product_manager: [4, 4, 3, 4, 4, 4, 4, 3, 4, 5],
  software_engineer: [3, 2, 4, 3, 3, 3, 2, 5, 5, 5],
  data_analyst: [3, 2, 5, 2, 2, 4, 3, 5, 4, 4],
  financial_analyst: [2, 2, 5, 2, 2, 5, 3, 5, 4, 4],
  operations_analyst: [3, 3, 3, 2, 2, 4, 4, 4, 4, 5],
  growth_manager: [4, 3, 3, 4, 4, 3, 5, 3, 3, 4],
  business_analyst: [3, 3, 4, 3, 2, 4, 4, 4, 3, 4],
  strategy_analyst: [4, 3, 5, 3, 3, 5, 4, 4, 3, 3],
  ui_ux_designer: [4, 3, 2, 5, 3, 3, 5, 3, 4, 4],
  founder: [5, 5, 3, 5, 5, 4, 4, 3, 5, 5],
  project_manager: [3, 4, 3, 3, 3, 4, 4, 4, 4, 5],
  talent_acquisition: [3, 4, 2, 3, 2, 3, 5, 3, 3, 3],
};

function persona(i) {
  const role = ROLES[i % ROLES.length];
  const preset = ROLE_DNA[role] || ROLE_DNA.business_analyst;
  const answers = {};
  for (let j = 0; j < 10; j++) {
    const jitter = ((i + j) % 3) - 1;
    answers[`likert_${j + 1}`] = Math.max(1, Math.min(5, preset[j] + jitter));
  }
  const isFounder = i % 5 === 0;
  return {
    basic_profile: {
      department: i % 3 === 0 ? "Psychology" : i % 3 === 1 ? "Computer Engineering" : "Economics",
      leadershipRole: isFounder ? "Founder" : "",
    },
    career_goals: {
      primaryRole: isFounder ? "product_manager" : role,
      targetRoles: isFounder ? ["product_manager", "project_manager", "founder"] : [role],
      industries: isFounder ? ["technology", "ai", "entrepreneurship"] : [["technology"], ["finance"], ["marketing"]][i % 3],
    },
    career_dna: { traitScores: scoreCareerDnaAnswers(answers, "EN"), answers },
    career_readiness: {
      benchmarks: {
        english: "fluent_pro",
        network: i % 2 ? "100_plus" : "50_100",
        experience: "internship",
        projects: "portfolio",
        leadership: isFounder ? "founder_cofounder" : "project_lead",
      },
      score: 48 + (i % 20),
    },
  };
}

const results = [];
let genericCount = 0;
const recruiterReasons = new Set();
const identityNarratives = new Set();
const growthScores = [];

for (let i = 0; i < 30; i++) {
  const profile = persona(i);
  const snap = buildCareerSnapshot(profile, "EN");
  results.push(snap);

  const texts = [
    snap.whyThisRole?.text,
    snap.whyThisRole?.closing,
    snap.identityWow?.narrative,
    snap.recruiterView?.recruiterConfidence?.reason,
    snap.careerOsHome?.topRole?.why,
  ];
  for (const t of texts) {
    if (isGenericExplanation(t)) genericCount += 1;
  }

  if (snap.recruiterView?.recruiterConfidence?.reason) {
    recruiterReasons.add(snap.recruiterView.recruiterConfidence.reason.slice(0, 60));
  }
  if (snap.identityWow?.narrative) identityNarratives.add(snap.identityWow.narrative);
  if (snap.growthPotential?.score != null) growthScores.push(snap.growthPotential.score);
}

const identityTitles = new Set(results.map((r) => r.careerIdentityTitle));
const roleFamilies = new Set(results.map((r) => r.roleFamily?.primary));
const readinessVsGrowth = results.filter(
  (r) => (r.readinessScore ?? 0) < 60 && (r.growthPotential?.score ?? 0) >= 75
).length;

const metrics = {
  personas: 30,
  uniqueIdentities: identityTitles.size,
  uniqueRoleFamilies: roleFamilies.size,
  uniqueIdentityNarratives: identityNarratives.size,
  uniqueRecruiterReasons: recruiterReasons.size,
  growthPotential: {
    min: Math.min(...growthScores),
    max: Math.max(...growthScores),
    avg: Math.round(growthScores.reduce((a, b) => a + b, 0) / growthScores.length),
  },
  highGrowthLowReadiness: readinessVsGrowth,
  genericExplanationHits: genericCount,
};

console.log("=== Career Snapshot WOW Validation (30 personas) ===\n");
console.log(JSON.stringify(metrics, null, 2));
console.log("\nSample identity narrative:", [...identityNarratives][0]);
console.log("Sample whyThisRole:", results[0]?.whyThisRole?.text?.slice(0, 120) + "...");
console.log("Sample recruiter reason:", results[0]?.recruiterView?.recruiterConfidence?.reason);

const pass = genericCount === 0;
console.log(`\nGeneric explanations: ${pass ? "PASS (0)" : `FAIL (${genericCount})`}`);
if (!pass) process.exit(1);
