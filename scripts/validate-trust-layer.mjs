/**
 * Trust Layer V1 validation — 30 synthetic personas.
 * Run: node scripts/validate-trust-layer.mjs
 */

import { scoreCareerDnaAnswers } from "../lib/careerOnboarding/careerDna.js";
import { buildCareerPreview } from "../lib/careerOnboarding/careerSnapshot.js";
import { isGenericExplanation } from "../lib/careerOnboarding/trustLayer.js";

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

const FAMILY_BLEED = [
  { family: "FINANCE", bad: /product manager|roadmap|startup preference|product-oriented/i },
  { family: "HR", bad: /product manager|roadmap|sql query|financial model/i },
  { family: "SOFTWARE", bad: /talent acquisition|recruitment pipeline|financial model/i },
  { family: "PRODUCT", bad: /financial model|interview scorecard|sql query/i },
];

function persona(i) {
  const role = ROLES[i % ROLES.length];
  const preset = ROLE_DNA[role] || ROLE_DNA.business_analyst;
  const answers = {};
  for (let j = 0; j < 10; j++) {
    const jitter = ((i + j) % 3) - 1;
    answers[`likert_${j + 1}`] = Math.max(1, Math.min(5, preset[j] + jitter));
  }
  const isFounder = i % 5 === 0;
  const hasCv = i % 4 !== 0;
  return {
    basic: {
      department: i % 3 === 0 ? "Psychology" : i % 3 === 1 ? "Computer Engineering" : "Economics",
      leadershipRole: isFounder ? "Founder" : "",
      cvExists: hasCv,
    },
    goals: {
      primaryRole: isFounder ? "product_manager" : role,
      targetRoles: isFounder ? ["product_manager", "project_manager", "founder"] : [role],
      industries: isFounder
        ? ["technology", "ai", "entrepreneurship"]
        : [["technology"], ["finance"], ["marketing"]][i % 3],
    },
    dnaAnswers: answers,
    readinessAnswers: {
      english: "fluent_pro",
      network: i % 2 ? "100_plus" : "50_100",
      experience: hasCv ? "internship" : "",
      projects: i % 3 ? "portfolio" : "",
      leadership: isFounder ? "founder_cofounder" : "project_lead",
    },
    cv: { cvExists: hasCv },
    lang: "EN",
  };
}

function familyForRole(roleId) {
  if (/product|founder|ui_ux/.test(roleId)) return "PRODUCT";
  if (/software/.test(roleId)) return "SOFTWARE";
  if (/data/.test(roleId)) return "DATA";
  if (/financial/.test(roleId)) return "FINANCE";
  if (/talent|hr/.test(roleId)) return "HR";
  if (/growth|marketing/.test(roleId)) return "MARKETING";
  if (/operations|project/.test(roleId)) return "OPERATIONS";
  return "BUSINESS";
}

const results = [];
let genericCount = 0;
let familyBleedCount = 0;
const predictionClosings = new Set();
const roleExplanations = new Set();
const gapExplanations = new Set();
const confidenceReasons = new Set();

for (let i = 0; i < 30; i++) {
  const input = persona(i);
  const preview = buildCareerPreview(input);
  results.push(preview);
  const trust = preview.trustLayer;
  if (!trust) continue;

  const texts = [
    trust.whyThisPrediction?.closing,
    trust.whyThisPrediction?.intro,
    ...(trust.whyThisPrediction?.bullets || []),
    trust.whatIncreasedMatch?.text,
    trust.whatIncreasedMatch?.closing,
    ...(trust.whatIncreasedMatch?.bullets || []),
    trust.gapTrust?.whyItMatters,
    trust.gapTrust?.fastestProof,
    ...(trust.gapTrust?.missingProof || []),
    ...(trust.confidenceTrust?.reasons || []),
    trust.confidenceTrust?.footer,
    ...(trust.signalBreakdown?.rows || []).map((r) => `${r.label} ${r.level}`),
  ];

  for (const t of texts) {
    if (isGenericExplanation(t)) genericCount += 1;
  }

  if (trust.whyThisPrediction?.closing) predictionClosings.add(trust.whyThisPrediction.closing);
  if (trust.whatIncreasedMatch?.text) roleExplanations.add(trust.whatIncreasedMatch.text);
  if (trust.gapTrust?.whyItMatters) gapExplanations.add(trust.gapTrust.whyItMatters);
  for (const r of trust.confidenceTrust?.reasons || []) confidenceReasons.add(r);

  const roleId = input.goals.primaryRole;
  const family = familyForRole(roleId);
  const roleText = [
    trust.whatIncreasedMatch?.text,
    trust.whatIncreasedMatch?.closing,
    ...(trust.whatIncreasedMatch?.bullets || []),
  ].join(" ");
  const bleedRule = FAMILY_BLEED.find((b) => b.family === family);
  if (bleedRule && bleedRule.bad.test(roleText)) familyBleedCount += 1;
}

const metrics = {
  personas: 30,
  uniquePredictionClosings: predictionClosings.size,
  uniqueRoleExplanations: roleExplanations.size,
  uniqueGapExplanations: gapExplanations.size,
  uniqueConfidenceReasons: confidenceReasons.size,
  genericExplanationHits: genericCount,
  familyBleedHits: familyBleedCount,
};

console.log("=== Trust Layer V1 Validation (30 personas) ===\n");
console.log(JSON.stringify(metrics, null, 2));
console.log("\nSample whyThisPrediction:", results[0]?.trustLayer?.whyThisPrediction);
console.log("Sample whatIncreasedMatch:", results[0]?.trustLayer?.whatIncreasedMatch?.text?.slice(0, 140));
console.log("Sample gapTrust:", results[0]?.trustLayer?.gapTrust);

const pass = genericCount === 0 && familyBleedCount === 0;
console.log(`\nGeneric explanations: ${genericCount === 0 ? "PASS (0)" : `FAIL (${genericCount})`}`);
console.log(`Family bleed: ${familyBleedCount === 0 ? "PASS (0)" : `FAIL (${familyBleedCount})`}`);
if (!pass) process.exit(1);
