/**
 * Identity Engine V3.1 audit — signal rebalancing validation.
 * Run: node scripts/validate-identity-v31.mjs
 */

import { scoreCareerDnaAnswers } from "../lib/careerOnboarding/careerDna.js";
import { buildIdentityEngineV3 } from "../lib/careerIntelligence/identityEngineV3.js";
import { buildCvEvidenceLayer } from "../lib/careerIntelligence/cvEvidenceLayer.js";
import { detectRoleFamiliesFromProfile } from "../lib/careerOnboarding/careerSnapshot.js";
import { buildRoleMatchExplanation } from "../lib/careerIntelligence/roleMatchEvidence.js";

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

const ROLE_DNA_PRESETS = {
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

function roleAlignedAnswers(role, variant = 0) {
  const preset = ROLE_DNA_PRESETS[role] || ROLE_DNA_PRESETS.business_analyst;
  const answers = {};
  for (let i = 0; i < 10; i++) {
    const base = preset[i];
    const jitter = ((variant + i) % 3) - 1;
    answers[`likert_${i + 1}`] = Math.max(1, Math.min(5, base + jitter));
  }
  return answers;
}

function syntheticPersona(i) {
  const role = ROLES[i % ROLES.length];
  const answers = roleAlignedAnswers(role, i);
  const isFounderCase = i % 7 === 0;
  return {
    id: i,
    dnaAnswers: answers,
    readinessAnswers: {
      english: "fluent_pro",
      network: isFounderCase ? "100_plus" : "50_100",
      experience: "internship",
      projects: "portfolio",
      leadership: isFounderCase ? "founder_cofounder" : "project_lead",
    },
    profile: {
      basic_profile: {
        department: i % 4 === 0 ? "Psychology" : i % 4 === 1 ? "Computer Engineering" : "Business Administration",
        leadershipRole: isFounderCase ? "Founder" : "",
      },
      career_goals: {
        primaryRole: isFounderCase ? "product_manager" : role,
        targetRoles: isFounderCase ? ["product_manager", "project_manager", "founder"] : [role],
        industries: isFounderCase ? ["technology", "ai", "entrepreneurship"] : [["technology"], ["finance"], ["marketing"]][i % 3],
      },
    },
  };
}

function uniqueCount(arr) {
  return new Set(arr).size;
}

function aggregateSignalContributions(results) {
  const totals = {};
  let count = 0;
  for (const r of results) {
    const top = r.debugReport?.selected?.domain?.topContributors || [];
    for (const row of top.slice(0, 3)) {
      totals[row.signal] = (totals[row.signal] || 0) + row.contributionPct;
    }
    count += 1;
  }
  return Object.entries(totals)
    .map(([signal, sum]) => ({ signal, avgPct: Math.round(sum / Math.max(1, count)) }))
    .sort((a, b) => b.avgPct - a.avgPct);
}

const personas = Array.from({ length: 50 }, (_, i) => syntheticPersona(i));
const results = [];
const collapseCases = [];

for (const p of personas) {
  const traitScores = scoreCareerDnaAnswers(p.dnaAnswers, "EN");
  const profile = {
    ...p.profile,
    career_dna: { traitScores, answers: p.dnaAnswers },
    career_readiness: { benchmarks: p.readinessAnswers },
  };
  const family = detectRoleFamiliesFromProfile(profile, profile.career_goals);
  const identity = buildIdentityEngineV3({
    profile,
    roleFamily: family,
    dnaAnswers: p.dnaAnswers,
    readinessAnswers: p.readinessAnswers,
    lang: "EN",
  });
  const pmExplain = buildRoleMatchExplanation({
    roleName: "Product Manager",
    family: "PRODUCT",
    evidence: identity.evidence,
    lang: "EN",
  });

  results.push({ ...identity, roleFamily: family.primary, pmExplain, personaId: p.id });

  const isFounderProduct =
    profile.career_goals.targetRoles?.includes("product_manager") &&
    (profile.basic_profile.leadershipRole === "Founder" ||
      p.readinessAnswers.leadership === "founder_cofounder");

  if (isFounderProduct && /People Operator \+ Leader|People Operator/i.test(identity.title)) {
    collapseCases.push({ id: p.id, title: identity.title, groups: identity.debugReport?.signalGroups });
  }
}

const identityTitles = results.map((r) => r.title);
const roleFamilies = results.map((r) => r.roleFamily);
const signalAgg = aggregateSignalContributions(results);

const founderProductCase = {
  dnaAnswers: roleAlignedAnswers("founder", 0),
  readinessAnswers: { english: "fluent_pro", network: "100_plus", experience: "internship", projects: "portfolio", leadership: "founder_cofounder" },
  profile: {
    basic_profile: { department: "Psychology", leadershipRole: "Founder" },
    career_goals: {
      primaryRole: "product_manager",
      targetRoles: ["product_manager", "project_manager", "founder"],
      industries: ["technology", "ai", "entrepreneurship"],
    },
  },
};

const fpTrait = scoreCareerDnaAnswers(founderProductCase.dnaAnswers, "EN");
const fpProfile = {
  ...founderProductCase.profile,
  career_dna: { traitScores: fpTrait, answers: founderProductCase.dnaAnswers },
  career_readiness: { benchmarks: founderProductCase.readinessAnswers },
};
const fpFamily = detectRoleFamiliesFromProfile(fpProfile, fpProfile.career_goals);
const fpIdentity = buildIdentityEngineV3({
  profile: fpProfile,
  roleFamily: fpFamily,
  dnaAnswers: founderProductCase.dnaAnswers,
  readinessAnswers: founderProductCase.readinessAnswers,
  lang: "EN",
});
const fpPmExplain = buildRoleMatchExplanation({
  roleName: "Product Manager",
  family: "PRODUCT",
  evidence: fpIdentity.evidence,
  lang: "EN",
});

const metrics = {
  personas: personas.length,
  uniqueIdentityTitles: uniqueCount(identityTitles),
  uniqueRoleFamilies: uniqueCount(roleFamilies),
  identityCollapseRate: 1 - uniqueCount(identityTitles) / personas.length,
  founderProductCollapseCases: collapseCases.length,
  topContributingSignals: signalAgg.slice(0, 8),
  signalGroupsAvg: {
    founder: Math.round(results.reduce((s, r) => s + (r.debugReport?.signalGroups?.founder || 0), 0) / results.length),
    product: Math.round(results.reduce((s, r) => s + (r.debugReport?.signalGroups?.product || 0), 0) / results.length),
    building: Math.round(results.reduce((s, r) => s + (r.debugReport?.signalGroups?.building || 0), 0) / results.length),
    people: Math.round(results.reduce((s, r) => s + (r.debugReport?.signalGroups?.people || 0), 0) / results.length),
  },
};

console.log("=== Identity Engine V3.1 Audit ===\n");
console.log(JSON.stringify(metrics, null, 2));
console.log("\n--- Founder + Product + PM + AI + Tech + Startup (user scenario) ---");
console.log("Identity:", fpIdentity.title);
console.log("Domain contributors:", fpIdentity.debugReport?.selected?.domain?.topContributors?.slice(0, 4));
console.log("Core contributors:", fpIdentity.debugReport?.selected?.core?.topContributors?.slice(0, 4));
console.log("Signal groups:", fpIdentity.debugReport?.signalGroups);
console.log("PM match:", fpPmExplain);
console.log("\nSample identities:", identityTitles.slice(0, 10).join(" | "));

if (collapseCases.length) {
  console.log("\nCollapse cases:", collapseCases);
}

const pass =
  !/People Operator \+ Leader/i.test(fpIdentity.title) &&
  /Builder|Strategist|Founder|Operator|Innovator/i.test(fpIdentity.title) &&
  metrics.founderProductCollapseCases === 0;

console.log(`\nSuccess criteria: ${pass ? "PASS" : "FAIL"}`);
if (!pass) process.exit(1);
