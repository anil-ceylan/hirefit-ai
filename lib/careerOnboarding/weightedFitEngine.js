import { getRoleLabel } from "./industries.js";
import { normalizeTraitScoresTo100 } from "../careerIntelligence/evidenceDimensions.js";

function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ROLE_WEIGHT_PRESETS = {
  product_manager: {
    productThinking: 25,
    leadership: 20,
    analytics: 18,
    communication: 15,
    execution: 12,
    other: 10,
  },
  product_analyst: {
    analytics: 26,
    productThinking: 20,
    execution: 16,
    communication: 14,
    domainLearning: 12,
    other: 12,
  },
  growth_associate: {
    growthThinking: 24,
    communication: 18,
    analytics: 18,
    execution: 16,
    creativity: 12,
    other: 12,
  },
  business_analyst: {
    analytics: 24,
    structuredThinking: 22,
    communication: 16,
    execution: 16,
    stakeholderWork: 12,
    other: 10,
  },
  strategy_operations: {
    structuredThinking: 24,
    execution: 20,
    analytics: 18,
    leadership: 16,
    communication: 12,
    other: 10,
  },
};

function roleWeightsFor(roleId) {
  const key = norm(roleId).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (ROLE_WEIGHT_PRESETS[key]) return ROLE_WEIGHT_PRESETS[key];
  if (/product/.test(key)) return ROLE_WEIGHT_PRESETS.product_manager;
  if (/growth|marketing|gtm/.test(key)) return ROLE_WEIGHT_PRESETS.growth_associate;
  if (/analysis|analyst|data|veri/.test(key)) return ROLE_WEIGHT_PRESETS.business_analyst;
  if (/strategy|operations|operasyon/.test(key)) return ROLE_WEIGHT_PRESETS.strategy_operations;
  return {
    roleClarity: 20,
    execution: 18,
    communication: 16,
    learningSpeed: 16,
    evidence: 15,
    other: 15,
  };
}

function humanRoleLabel(id, lang) {
  const label = getRoleLabel(id, lang);
  if (label && label !== id) return label;
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function companyWeightsFor(goals = {}) {
  const types = goals.companyStages || goals.companyTypes || [];
  const sizes = goals.companySizes || [];
  const wantsStartup = types.some((x) => /startup|early|scale/i.test(String(x))) || sizes.some((x) => /startup|1-10|11-50/i.test(String(x)));
  const wantsCorporate = types.some((x) => /corporate|enterprise|kurumsal/i.test(String(x))) || sizes.some((x) => /500|1000|enterprise/i.test(String(x)));
  if (wantsStartup) {
    return {
      ownership: 24,
      ambiguityTolerance: 20,
      executionSpeed: 18,
      productSense: 16,
      communication: 12,
      other: 10,
    };
  }
  if (wantsCorporate) {
    return {
      roleClarity: 22,
      repeatability: 20,
      stakeholderWork: 18,
      analyticalProof: 16,
      communication: 14,
      other: 10,
    };
  }
  return {
    roleClarity: 20,
    evidenceQuality: 20,
    execution: 18,
    learningSpeed: 16,
    communication: 14,
    other: 12,
  };
}

function candidateSignalsFromProfile(profile = {}) {
  const basic = profile.basic_profile || {};
  const goals = profile.career_goals || {};
  const dna = profile.career_dna || {};
  const readiness = profile.career_readiness || {};
  const pillars = Array.isArray(readiness.pillars) ? readiness.pillars : [];
  const pillarScore = (key, fallback = 50) => {
    const row = pillars.find((p) => p.key === key);
    return clamp(row?.score ?? fallback);
  };
  const dnaScores = dna.scores || dna.traitScores || {};
  const traitNorm = normalizeTraitScoresTo100(dnaScores);
  const hasCv =
    Boolean(readiness.hasCv) ||
    Boolean(profile.cvExists) ||
    Boolean(basic.cvUploaded) ||
    basic.cvExists ||
    basic.cvStatus === "current";
  const experienceSignalCount = (basic.experienceSignals || []).filter((signal) => signal !== "none").length;
  const leadershipSignalCount = (basic.leadershipSignals || []).filter((signal) => signal !== "none").length;

  return {
    experience: clamp(pillarScore("experience", 45) + Math.min(8, Math.max(0, experienceSignalCount - 1) * 2)),
    projects: pillarScore("projects", clamp(traitNorm.execution * 0.45 + traitNorm.creativity * 0.35 + 35)),
    leadership: clamp(
      pillarScore("leadership", clamp(traitNorm.leadership * 0.55 + traitNorm.communication * 0.25 + 34)) +
      Math.min(8, Math.max(0, leadershipSignalCount - 1) * 2)
    ),
    english: pillarScore("english", 45),
    networking: pillarScore("network", goals.companyTypes?.length ? 55 : 38),
    cvStatus: hasCv ? 78 : 42,
    roleClarity: goals.primaryRole ? 72 : goals.targetRoles?.length ? 58 : 40,
  };
}

export function buildWeightedFitFoundation(profile = {}, lang = "TR") {
  const goals = profile.career_goals || {};
  const targetRoles = [
    goals.primaryRole,
    goals.secondaryRole,
    goals.tertiaryRole,
    ...(goals.targetRoles || []),
    ...(profile.best_fit_roles || []),
  ].filter(Boolean);
  const uniqueRoles = [...new Set(targetRoles)].slice(0, 3);
  const roleWeights = {};
  for (const roleId of uniqueRoles.length ? uniqueRoles : ["product_manager"]) {
    const label = humanRoleLabel(roleId, lang);
    roleWeights[label] = roleWeightsFor(roleId);
  }
  return {
    version: "weighted-fit-foundation-v1",
    roleWeights,
    companyWeights: companyWeightsFor(goals),
    candidateSignals: candidateSignalsFromProfile(profile),
    futureFormula: "Fit Score = Role Weight * Company Weight * Candidate Weight",
  };
}
