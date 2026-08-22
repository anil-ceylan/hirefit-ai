/**
 * Identity Engine V3 validation — 50 synthetic personas.
 * Run: node scripts/validate-identity-v3.mjs
 */

import { scoreCareerDnaAnswers, resolveCareerArchetype } from "../lib/careerOnboarding/careerDna.js";
import { buildIdentityEngineV3, resolveRankedArchetypes } from "../lib/careerIntelligence/identityEngineV3.js";
import { buildCvEvidenceLayer } from "../lib/careerIntelligence/cvEvidenceLayer.js";
import { detectRoleFamiliesFromProfile } from "../lib/careerOnboarding/careerSnapshot.js";
import { buildWeightedFitFoundation } from "../lib/careerOnboarding/weightedFitEngine.js";

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
];

const INDUSTRIES = [
  ["technology"],
  ["finance"],
  ["consulting"],
  ["marketing"],
  ["entrepreneurship", "ai"],
  ["healthcare"],
  ["ecommerce"],
  ["gaming"],
];

const READINESS_PRESETS = [
  { english: "fluent_pro", network: "50_100", experience: "internship", projects: "portfolio", leadership: "project_lead" },
  { english: "interview", network: "5_20", experience: "new_graduate", projects: "coursework", leadership: "none" },
  { english: "presentation", network: "20_50", experience: "freelance", projects: "hackathon", leadership: "club_lead" },
  { english: "conversational", network: "0_5", experience: "intern", projects: "personal", leadership: "team_member" },
  { english: "fluent_pro", network: "100_plus", experience: "full_time", projects: "production", leadership: "founder_cofounder" },
];

function randomAnswers(seed) {
  const answers = {};
  for (let i = 1; i <= 10; i++) {
    answers[`likert_${i}`] = ((seed * 17 + i * 3) % 5) + 1;
  }
  return answers;
}

/** Role-aligned DNA presets — likert_1..10 values (1–5) for realistic trait spread */
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
  const industries = INDUSTRIES[i % INDUSTRIES.length];
  const readiness = READINESS_PRESETS[i % READINESS_PRESETS.length];
  const answers = roleAlignedAnswers(role, i);
  const dept =
    i % 5 === 0
      ? "Computer Engineering"
      : i % 5 === 1
        ? "Industrial Engineering"
        : i % 5 === 2
          ? "Economics"
          : i % 5 === 3
            ? "Business Administration"
            : "Psychology";

  const cvSnippets = [
    "",
    "Led a startup MVP and shipped product roadmap features.",
    "SQL Python data analysis internship at fintech.",
    "Growth marketing campaigns with measurable ROAS.",
    "Software engineer intern building React APIs.",
    "Founder co-founder venture studio project.",
  ];

  return {
    id: i,
    dnaAnswers: answers,
    readinessAnswers: readiness,
    profile: {
      basic_profile: {
        department: dept,
        degree: dept,
        experienceLevel: i % 2 === 0 ? "entry" : "intern",
        leadershipRole: i % 7 === 0 ? "Founder" : "",
      },
      career_goals: {
        primaryRole: role,
        targetRoles: [role],
        industries,
      },
      cvText: cvSnippets[i % cvSnippets.length],
    },
  };
}

function uniqueCount(arr) {
  return new Set(arr).size;
}

function jaccardDistinct(strings) {
  const set = new Set(strings.map((s) => s.toLowerCase().trim()));
  return set.size;
}

const personas = Array.from({ length: 50 }, (_, i) => syntheticPersona(i));
const identityTitles = [];
const archetypeIds = [];
const roleFamilies = [];
const explanations = [];
const evidenceSignatures = [];

for (const p of personas) {
  const traitScores = scoreCareerDnaAnswers(p.dnaAnswers, "EN");
  const archetype = resolveCareerArchetype(traitScores);
  archetypeIds.push(archetype.id);

  const profile = {
    ...p.profile,
    career_dna: { traitScores, answers: p.dnaAnswers },
    career_readiness: { benchmarks: p.readinessAnswers },
  };

  const family = detectRoleFamiliesFromProfile(profile, profile.career_goals);
  roleFamilies.push(family.primary);

  const identity = buildIdentityEngineV3({
    profile,
    roleFamily: family,
    dnaAnswers: p.dnaAnswers,
    readinessAnswers: p.readinessAnswers,
    cvText: p.profile.cvText,
    lang: "EN",
  });

  identityTitles.push(identity.title);
  explanations.push(identity.explanation);

  const { evidence } = buildCvEvidenceLayer({
    profile,
    dnaAnswers: p.dnaAnswers,
    readinessAnswers: p.readinessAnswers,
    cvText: p.profile.cvText,
    lang: "EN",
  });
  const top3 = Object.entries(evidence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k)
    .join("|");
  evidenceSignatures.push(top3);

  buildWeightedFitFoundation(profile, "EN");
}

const metrics = {
  personas: personas.length,
  uniqueArchetypes: uniqueCount(archetypeIds),
  uniqueIdentityTitles: jaccardDistinct(identityTitles),
  uniqueRoleFamilies: uniqueCount(roleFamilies),
  uniqueExplanationPrefixes: uniqueCount(explanations.map((e) => e.slice(0, 80))),
  uniqueEvidenceSignatures: uniqueCount(evidenceSignatures),
  identityCollapseRate: 1 - jaccardDistinct(identityTitles) / personas.length,
  archetypeCollapseRate: 1 - uniqueCount(archetypeIds) / personas.length,
};

console.log("=== Identity Engine V3 Validation (50 personas) ===\n");
console.log(JSON.stringify(metrics, null, 2));
console.log("\nSample identities:");
identityTitles.slice(0, 12).forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

const pass = metrics.uniqueIdentityTitles >= 15;
console.log(`\nGoal (15+ identity combinations): ${pass ? "PASS" : "FAIL"} (${metrics.uniqueIdentityTitles} unique)`);

if (!pass) process.exit(1);
