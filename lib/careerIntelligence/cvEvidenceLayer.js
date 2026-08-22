/**
 * Compatibility adapter for the shared Core Intelligence Layer.
 * Existing identity and snapshot modules still receive normalized dimensions,
 * while all evidence decisions now come from one evidence-first pipeline.
 */

import { scoreCareerDnaAnswers } from "../careerOnboarding/careerDna.js";
import { buildCoreIntelligence } from "./coreIntelligenceEngine.js";
import {
  EVIDENCE_DIMENSIONS,
  clampEvidence,
  emptyEvidence,
  normalizeTraitScoresTo100,
} from "./evidenceDimensions.js";

function inferTargetRole(profile = {}) {
  const goals = profile.career_goals || profile.goals || {};
  return goals.primaryRole || goals.targetRoles?.[0] || profile.target_roles?.[0] || "";
}

function inferRoleFamily(targetRole = "") {
  const role = String(targetRole || "").toLowerCase();
  if (/product|project_manager/.test(role)) return "PRODUCT";
  if (/operations|program|project/.test(role)) return "OPERATIONS";
  if (/data|analytics|bi_/.test(role)) return "DATA";
  if (/software|developer|engineer|full_stack|backend|frontend/.test(role)) return "SOFTWARE";
  if (/marketing|growth|gtm/.test(role)) return "MARKETING";
  if (/talent|human_resource|people|recruit/.test(role)) return "HR";
  if (/finance|financial|risk|fp&a|account/.test(role)) return "FINANCE";
  return "BUSINESS";
}

/**
 * Build normalized evidence from the full profile context.
 * `coreIntelligence` is internal and non-visual; `evidence` preserves the
 * established 0-100 dimension contract used by Identity Engine V3.
 */
export function buildCvEvidenceLayer({
  profile = {},
  dnaAnswers = null,
  readinessAnswers = null,
  cvText = "",
  roleFamily = "",
  targetRole = "",
  lang = "TR",
  config = {},
} = {}) {
  const dna = profile.career_dna || {};
  const answers = dnaAnswers || dna.answers || {};
  const traitRaw = dna.traitScores || dna.scores || scoreCareerDnaAnswers(answers, lang);
  const traitNorm = normalizeTraitScoresTo100(traitRaw);
  const resolvedTargetRole = targetRole || inferTargetRole(profile);
  const resolvedFamily = roleFamily || inferRoleFamily(resolvedTargetRole);
  const profileWithInputs = {
    ...profile,
    career_dna: { ...dna, answers, traitScores: traitRaw },
    career_readiness: {
      ...(profile.career_readiness || {}),
      ...(readinessAnswers ? { benchmarks: readinessAnswers } : {}),
    },
  };
  const coreIntelligence = buildCoreIntelligence({
    profile: profileWithInputs,
    cvText,
    targetRole: resolvedTargetRole,
    roleFamily: resolvedFamily,
    lang,
    config,
  });
  const evidence = {
    ...emptyEvidence(),
    ...coreIntelligence.evidence.byDimension,
  };
  const sources = coreIntelligence.evidence.sourceIds;
  return { evidence, sources, traitNorm, coreIntelligence };
}

export function rankEvidenceDimensions(evidence, n = 5) {
  return Object.entries(evidence || {})
    .filter(([key]) => EVIDENCE_DIMENSIONS.includes(key))
    .map(([key, score]) => ({ key, score: clampEvidence(score) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
