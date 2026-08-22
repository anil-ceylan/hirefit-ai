import { detectEvidenceCategories } from "./evidenceCoherence.js";
import {
  buildGapCandidates,
  categoryForGap,
  CATEGORY_LABELS,
  RELATED_CATEGORIES,
} from "./gapShadowSelector.js";
import { evaluateEvidenceSet } from "./evaluateEvidenceSet.js";
import { clampScore } from "./evidenceTypes.js";

const OPPORTUNITY_WEIGHTS = Object.freeze({
  decisionQualityGain: 0.2,
  recruiterCredibilityGain: 0.18,
  confidenceRecovery: 0.16,
  roleRelevance: 0.14,
  evidenceWeakness: 0.12,
  existingCoverage: 0.08,
  userEffort: 0.06,
  redundancyRisk: 0.04,
  freshness: 0.02,
});

const CATEGORY_TO_QUESTION_TYPES = Object.freeze({
  measurable_impact: ["metric_quantification", "outcome_detail"],
  ownership: ["ownership_scope", "decision_responsibility"],
  stakeholder_influence: ["stakeholder_context", "cross_functional_example"],
  business_case: ["business_case_structure", "decision_rationale"],
  role_specific_skill: ["role_artifact", "skill_proof"],
  execution: ["execution_detail", "delivery_scope"],
  leadership: ["leadership_scope", "team_context"],
  communication: ["message_clarity", "audience_context"],
  credibility: ["source_verification", "proof_link"],
  recency: ["timeline_context", "current_relevance"],
  portfolio_proof: ["artifact_link", "portfolio_context"],
});

const CATEGORY_DEFAULTS = Object.freeze({
  measurable_impact: {
    missingEvidence: "A measurable result or business impact metric",
    blockingDecision: "Recruiter cannot judge whether the work produced business value.",
    effort: 38,
  },
  ownership: {
    missingEvidence: "Clear ownership scope",
    blockingDecision: "Recruiter cannot tell whether the candidate owned the work or only supported it.",
    effort: 28,
  },
  stakeholder_influence: {
    missingEvidence: "Stakeholder or cross-functional evidence",
    blockingDecision: "Hiring team cannot see whether the candidate can work through other people.",
    effort: 34,
  },
  business_case: {
    missingEvidence: "Structured business case evidence",
    blockingDecision: "Hiring team cannot see decision quality under ambiguity.",
    effort: 55,
  },
  role_specific_skill: {
    missingEvidence: "Target-role artifact or skill proof",
    blockingDecision: "Recruiter cannot connect the profile to the day-to-day role requirements.",
    effort: 50,
  },
  execution: {
    missingEvidence: "Delivery detail",
    blockingDecision: "Recruiter cannot see what was actually shipped or completed.",
    effort: 32,
  },
  leadership: {
    missingEvidence: "Team or leadership scope",
    blockingDecision: "Recruiter cannot verify leadership beyond the claim.",
    effort: 34,
  },
  communication: {
    missingEvidence: "Audience and message context",
    blockingDecision: "Recruiter cannot see whether communication changed a decision.",
    effort: 24,
  },
  credibility: {
    missingEvidence: "A verifiable source",
    blockingDecision: "Recruiter has to trust a self-reported claim without proof.",
    effort: 42,
  },
  recency: {
    missingEvidence: "Current timeline context",
    blockingDecision: "Recruiter cannot tell whether the evidence still reflects current ability.",
    effort: 18,
  },
  portfolio_proof: {
    missingEvidence: "A visible artifact, link, or case study",
    blockingDecision: "Hiring manager cannot inspect the work behind the claim.",
    effort: 65,
  },
});

const ROLE_RELEVANT_CATEGORIES = Object.freeze({
  product: ["ownership", "measurable_impact", "portfolio_proof", "role_specific_skill", "execution", "stakeholder_influence"],
  strategy: ["business_case", "measurable_impact", "stakeholder_influence", "communication", "execution"],
  operations: ["execution", "stakeholder_influence", "measurable_impact", "ownership", "business_case"],
  business: ["business_case", "measurable_impact", "communication", "stakeholder_influence", "role_specific_skill"],
  data: ["role_specific_skill", "measurable_impact", "portfolio_proof", "credibility", "recency"],
  analytics: ["role_specific_skill", "measurable_impact", "portfolio_proof", "credibility", "recency"],
  software: ["role_specific_skill", "portfolio_proof", "execution", "credibility", "ownership"],
  marketing: ["measurable_impact", "communication", "portfolio_proof", "execution", "business_case"],
  growth: ["measurable_impact", "communication", "portfolio_proof", "execution", "business_case"],
  hr: ["stakeholder_influence", "communication", "leadership", "execution", "credibility"],
  finance: ["role_specific_skill", "business_case", "measurable_impact", "credibility", "recency"],
});

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/&-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === "") return [];
  return [value];
}

function compact(value, max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function stableId(parts) {
  return parts
    .map((part) => norm(part).replace(/\s+/g, "_").slice(0, 60))
    .filter(Boolean)
    .join(":") || "opportunity";
}

function numericFactor(item, factor) {
  return clampScore(item?.quality_breakdown?.factors?.[factor] ?? 0);
}

function textFor(item) {
  return `${item?.type || ""} ${item?.title || ""} ${item?.description || ""} ${(item?.skills || []).join(" ")} ${(item?.domains || []).join(" ")}`;
}

function hasMetricEvidence(item) {
  return asArray(item?.metrics).length > 0 || /\b\d+(\.\d+)?\s?%|\b\d+\s?(users?|customers?|clients?|hours?|days?|weeks?|revenue|tl|usd|eur|kpi|projects?)\b/i.test(textFor(item));
}

function hasArtifactEvidence(item) {
  const source = norm(`${item?.source || ""} ${item?.source_type || ""}`);
  return /portfolio|github|repo|demo|case study|link/.test(`${source} ${textFor(item)}`);
}

function hasOwnershipScope(item) {
  return /end to end|founder|owned|primary owner|managed|decision owner|accountable|responsible for|sahip|kurucu|yonett/.test(norm(textFor(item)));
}

function roleRelevance(category, roleContext = "") {
  const text = norm(roleContext);
  if (!text) return 46;
  const matchingFamily = Object.entries(ROLE_RELEVANT_CATEGORIES).find(([key]) => text.includes(key));
  if (!matchingFamily) return 58;
  const [, categories] = matchingFamily;
  if (categories.includes(category)) return 90;
  if (categories.some((item) => (RELATED_CATEGORIES[item] || []).includes(category))) return 68;
  return 36;
}

function existingCoverageFor(category, report) {
  const items = asArray(report?.evidenceItems);
  if (!items.length) return 0;
  const categoryItems = items.filter((item) => {
    const detected = detectEvidenceCategories(textFor(item));
    return detected.includes(category) || categoryForGap(textFor(item)) === category;
  });
  if (!categoryItems.length) return 0;
  return clampScore(Math.max(...categoryItems.map((item) => item.normalized_weight ?? 0)));
}

function evidenceWeaknessFor(category, report) {
  const coverage = existingCoverageFor(category, report);
  return clampScore(100 - coverage);
}

function effortBand(minutes) {
  const value = clampScore(minutes, 0, 180);
  if (value <= 25) return "low";
  if (value <= 55) return "medium";
  return "high";
}

function makeOpportunity({
  category,
  source,
  reason,
  missingEvidence,
  blockingDecision,
  currentEvidenceStrength,
  decisionImpact,
  recruiterImpact,
  confidenceGainPotential,
  roleRelevance,
  estimatedUserEffort,
  recommendedQuestionTypes,
  status = "active",
  evidenceIds = [],
} = {}) {
  const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.credibility;
  const title = CATEGORY_LABELS[category] || missingEvidence || "Evidence Opportunity";
  const effortMinutes = Number.isFinite(Number(estimatedUserEffort)) ? Number(estimatedUserEffort) : defaults.effort;
  return {
    id: stableId(["evidence_opportunity", source, category, missingEvidence || title]),
    category,
    title,
    priority: 0,
    confidenceGainPotential: clampScore(confidenceGainPotential ?? 50),
    decisionImpact: clampScore(decisionImpact ?? 50),
    recruiterImpact: clampScore(recruiterImpact ?? 50),
    roleRelevance: clampScore(roleRelevance ?? 50),
    estimatedUserEffort: {
      minutes: clampScore(effortMinutes, 5, 180),
      band: effortBand(effortMinutes),
    },
    currentEvidenceStrength: clampScore(currentEvidenceStrength ?? 0),
    missingEvidence: compact(missingEvidence || defaults.missingEvidence, 160),
    recommendedQuestionTypes: asArray(recommendedQuestionTypes || CATEGORY_TO_QUESTION_TYPES[category]).slice(0, 3),
    blockingDecision: compact(blockingDecision || defaults.blockingDecision, 180),
    reason: compact(reason || defaults.blockingDecision, 200),
    status,
    source: source || "deterministic_rule",
    evidenceIds: asArray(evidenceIds).slice(0, 6),
  };
}

function opportunityFromItem(category, item, report, context, overrides = {}) {
  const currentStrength = existingCoverageFor(category, report);
  const relevance = roleRelevance(category, context.roleContext || context.targetRole);
  const evidenceWeakness = evidenceWeaknessFor(category, report);
  return makeOpportunity({
    category,
    source: overrides.source,
    reason: overrides.reason,
    missingEvidence: overrides.missingEvidence,
    blockingDecision: overrides.blockingDecision,
    currentEvidenceStrength: currentStrength,
    decisionImpact: clampScore(evidenceWeakness * 0.54 + relevance * 0.46),
    recruiterImpact: clampScore((100 - (report?.confidenceScore ?? 0)) * 0.42 + evidenceWeakness * 0.32 + relevance * 0.26),
    confidenceGainPotential: clampScore((100 - (report?.confidenceScore ?? 0)) * 0.46 + evidenceWeakness * 0.34 + relevance * 0.2),
    roleRelevance: relevance,
    estimatedUserEffort: overrides.estimatedUserEffort,
    recommendedQuestionTypes: overrides.recommendedQuestionTypes,
    evidenceIds: [item?.id].filter(Boolean),
    status: overrides.status,
  });
}

function discoverPartialEvidenceOpportunities(report, context) {
  const opportunities = [];
  for (const item of asArray(report?.evidenceItems)) {
    const text = textFor(item);
    const normalized = norm(text);
    const categories = detectEvidenceCategories(text);

    if (
      (/impact|business|customer|user|revenue|workflow|growth|result|outcome|kpi/.test(normalized) || categories.includes("measurable_impact")) &&
      (!hasMetricEvidence(item) || numericFactor(item, "measurable_outcome") < 62)
    ) {
      opportunities.push(opportunityFromItem("measurable_impact", item, report, context, {
        source: "business_impact_without_metric",
        missingEvidence: "A number, before-after result, or business impact metric",
        reason: `${item.title} points toward impact, but the measurable result is not visible.`,
        recommendedQuestionTypes: ["metric_quantification", "outcome_detail"],
        estimatedUserEffort: 35,
      }));
    }

    if (
      (/lead|leadership|managed|team|lider|yonet/.test(normalized) || categories.includes("leadership")) &&
      !hasOwnershipScope(item)
    ) {
      opportunities.push(opportunityFromItem("ownership", item, report, context, {
        source: "leadership_without_ownership",
        missingEvidence: "Who owned the decision, scope, and result",
        reason: `${item.title} suggests leadership, but ownership scope is not clear.`,
        recommendedQuestionTypes: ["ownership_scope", "decision_responsibility"],
        estimatedUserEffort: 25,
      }));
    }

    if (
      (/project|case|dashboard|analysis|built|created|developed|proje|vaka/.test(normalized) || categories.includes("role_specific_skill")) &&
      !hasArtifactEvidence(item)
    ) {
      opportunities.push(opportunityFromItem("portfolio_proof", item, report, context, {
        source: "project_without_artifact",
        missingEvidence: "A visible artifact, portfolio link, GitHub repo, or case study",
        reason: `${item.title} is project-shaped evidence, but the work cannot be inspected yet.`,
        recommendedQuestionTypes: ["artifact_link", "portfolio_context"],
        estimatedUserEffort: 60,
      }));
    }

    if (
      (/intern|internship|staj/.test(normalized)) &&
      !/stakeholder|cross-functional|client|customer|team|paydas/.test(normalized)
    ) {
      opportunities.push(opportunityFromItem("stakeholder_influence", item, report, context, {
        source: "internship_without_stakeholder",
        missingEvidence: "Which stakeholders, teams, or users the internship work affected",
        reason: `${item.title} gives internship evidence, but the stakeholder context is missing.`,
        recommendedQuestionTypes: ["stakeholder_context", "cross_functional_example"],
        estimatedUserEffort: 30,
      }));
    }
  }
  return opportunities;
}

function discoverGapBasedOpportunities(profile, snapshot, report, context) {
  const candidates = buildGapCandidates(profile, snapshot, report, context);
  return candidates.map((candidate) => {
    const relevance = roleRelevance(candidate.category, context.roleContext || context.targetRole || candidate.targetRole);
    const currentStrength = existingCoverageFor(candidate.category, report);
    return makeOpportunity({
      category: candidate.category,
      source: `gap_shadow:${candidate.source}`,
      reason: candidate.explanation || candidate.description,
      missingEvidence: candidate.missingEvidence || candidate.title,
      blockingDecision: candidate.description || CATEGORY_DEFAULTS[candidate.category]?.blockingDecision,
      currentEvidenceStrength: currentStrength,
      decisionImpact: clampScore((candidate.severity ?? 50) * 0.6 + relevance * 0.4),
      recruiterImpact: clampScore((candidate.severity ?? 50) * 0.45 + (100 - (report?.confidenceScore ?? 0)) * 0.35 + relevance * 0.2),
      confidenceGainPotential: clampScore((100 - (report?.confidenceScore ?? 0)) * 0.38 + (candidate.severity ?? 50) * 0.4 + relevance * 0.22),
      roleRelevance: relevance,
      estimatedUserEffort: CATEGORY_DEFAULTS[candidate.category]?.effort,
      recommendedQuestionTypes: CATEGORY_TO_QUESTION_TYPES[candidate.category],
      evidenceIds: candidate.evidenceSupport,
      status: candidate.confidence < 18 ? "low_confidence" : "active",
    });
  });
}

function discoverMissingFieldOpportunities(report, context) {
  return asArray(report?.missingEvidenceFields).flatMap((gap) => {
    const category = gap.field === "occurred_at"
      ? "recency"
      : gap.field === "role_context"
        ? "role_specific_skill"
        : gap.field === "source_type"
          ? "credibility"
          : "portfolio_proof";
    const relevance = roleRelevance(category, context.roleContext || context.targetRole);
    return [makeOpportunity({
      category,
      source: `missing_field:${gap.field}`,
      reason: `${gap.label || gap.field} is missing across ${gap.count || 1} evidence item(s).`,
      missingEvidence: gap.label || gap.field,
      currentEvidenceStrength: existingCoverageFor(category, report),
      decisionImpact: clampScore(48 + Math.min(24, Number(gap.count || 1) * 6)),
      recruiterImpact: clampScore(44 + Math.min(28, Number(gap.count || 1) * 7)),
      confidenceGainPotential: clampScore(42 + Math.min(30, Number(gap.count || 1) * 8)),
      roleRelevance: relevance,
      estimatedUserEffort: CATEGORY_DEFAULTS[category]?.effort,
      recommendedQuestionTypes: CATEGORY_TO_QUESTION_TYPES[category],
    })];
  });
}

function discoverContradictionOpportunities(report, context) {
  return asArray(report?.contradictionFlags).map((flag) => {
    const category = flag.id === "high_ownership_without_outcome" ? "measurable_impact" : "credibility";
    return makeOpportunity({
      category,
      source: `contradiction:${flag.id}`,
      reason: `Contradiction flag ${flag.id} needs resolution before this evidence can be trusted.`,
      missingEvidence: CATEGORY_DEFAULTS[category]?.missingEvidence,
      blockingDecision: "Recruiter confidence drops when a strong claim has weak supporting proof.",
      currentEvidenceStrength: existingCoverageFor(category, report),
      decisionImpact: 86,
      recruiterImpact: 88,
      confidenceGainPotential: 84,
      roleRelevance: roleRelevance(category, context.roleContext || context.targetRole),
      estimatedUserEffort: CATEGORY_DEFAULTS[category]?.effort,
      recommendedQuestionTypes: ["contradiction_resolution", ...(CATEGORY_TO_QUESTION_TYPES[category] || [])].slice(0, 3),
      evidenceIds: [flag.evidenceId].filter(Boolean),
    });
  });
}

function dedupeOpportunities(opportunities) {
  const byKey = new Map();
  for (const opportunity of opportunities.filter(Boolean)) {
    const key = `${opportunity.category}:${norm(opportunity.missingEvidence).slice(0, 80)}`;
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, opportunity);
      continue;
    }
    const winner = (opportunity.decisionImpact + opportunity.recruiterImpact) >= (previous.decisionImpact + previous.recruiterImpact)
      ? opportunity
      : previous;
    byKey.set(key, {
      ...winner,
      confidenceGainPotential: Math.max(previous.confidenceGainPotential, opportunity.confidenceGainPotential),
      decisionImpact: Math.max(previous.decisionImpact, opportunity.decisionImpact),
      recruiterImpact: Math.max(previous.recruiterImpact, opportunity.recruiterImpact),
      roleRelevance: Math.max(previous.roleRelevance, opportunity.roleRelevance),
      evidenceIds: [...new Set([...asArray(previous.evidenceIds), ...asArray(opportunity.evidenceIds)])].slice(0, 6),
      source: previous.source === winner.source ? winner.source : `${winner.source}+deduped`,
    });
  }
  return [...byKey.values()];
}

function redundancyRisk(opportunity, report) {
  const coverage = existingCoverageFor(opportunity.category, report);
  if (coverage >= 78) return 86;
  if (coverage >= 62) return 54;
  return 18;
}

function freshnessScore(opportunity, report) {
  const ids = new Set(asArray(opportunity.evidenceIds));
  const linked = asArray(report?.evidenceItems).filter((item) => ids.has(item.id));
  if (!linked.length) return 50;
  const recency = Math.max(...linked.map((item) => numericFactor(item, "recency")));
  return clampScore(recency);
}

export function evaluateEvidenceOpportunity(opportunity, { evidenceReport = null } = {}) {
  const existingCoverage = existingCoverageFor(opportunity?.category, evidenceReport);
  const redundancy = redundancyRisk(opportunity, evidenceReport);
  const effortScore = clampScore(100 - Number(opportunity?.estimatedUserEffort?.minutes ?? 45) * 0.9);
  const factors = {
    decisionQualityGain: clampScore(opportunity?.decisionImpact),
    recruiterCredibilityGain: clampScore(opportunity?.recruiterImpact),
    confidenceRecovery: clampScore(opportunity?.confidenceGainPotential),
    roleRelevance: clampScore(opportunity?.roleRelevance),
    evidenceWeakness: evidenceWeaknessFor(opportunity?.category, evidenceReport),
    existingCoverage: clampScore(100 - existingCoverage),
    userEffort: effortScore,
    redundancyRisk: clampScore(100 - redundancy),
    freshness: freshnessScore(opportunity, evidenceReport),
  };
  const priority = clampScore(
    Object.entries(OPPORTUNITY_WEIGHTS).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0)
  );
  const redundant = redundancy >= 78 && factors.evidenceWeakness <= 28;
  return {
    ...opportunity,
    priority,
    status: redundant ? "answered" : opportunity?.status || "active",
    rankingFactors: factors,
  };
}

export function rankEvidenceOpportunities(opportunities = [], context = {}) {
  return asArray(opportunities)
    .map((opportunity) => evaluateEvidenceOpportunity(opportunity, context))
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "active") return -1;
        if (b.status === "active") return 1;
      }
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.decisionImpact !== a.decisionImpact) return b.decisionImpact - a.decisionImpact;
      return String(a.id).localeCompare(String(b.id));
    });
}

export function discoverEvidenceOpportunities({
  profile = {},
  snapshot = {},
  evidenceReport = null,
  context = {},
} = {}) {
  const safeProfile = profile || {};
  const safeSnapshot = snapshot || {};
  const match = safeSnapshot?.primaryRoleMatch || safeSnapshot?.topRoleMatches?.[0] || safeSnapshot?.roleMatches?.[0] || {};
  const ctx = {
    targetRole: context.targetRole || match.roleName || safeSnapshot.targetRole || safeProfile.target_roles?.[0] || "",
    roleContext: context.roleContext || match.roleFamily || match.roleName || "",
    currentAction: context.currentAction || safeSnapshot.gapDetails?.action || safeSnapshot.suggestedNextMove || "",
  };
  return dedupeOpportunities([
    ...discoverPartialEvidenceOpportunities(evidenceReport, ctx),
    ...discoverGapBasedOpportunities(safeProfile, safeSnapshot, evidenceReport, ctx),
    ...discoverMissingFieldOpportunities(evidenceReport, ctx),
    ...discoverContradictionOpportunities(evidenceReport, ctx),
  ]);
}

export function buildEvidenceOpportunities({
  profile = {},
  snapshot = {},
  evidenceItems = null,
  evidenceReport = null,
  context = {},
} = {}) {
  const safeProfile = profile || {};
  const safeSnapshot = snapshot || {};
  const report = evidenceReport || evaluateEvidenceSet(asArray(evidenceItems), {
    roleContext: context.roleContext || context.targetRole || "",
    lang: context.lang || "EN",
    now: context.now,
  });
  const opportunities = discoverEvidenceOpportunities({ profile: safeProfile, snapshot: safeSnapshot, evidenceReport: report, context });
  return rankEvidenceOpportunities(opportunities, { ...context, evidenceReport: report });
}

export function selectNextEvidenceOpportunity(opportunities = [], context = {}) {
  const ranked = rankEvidenceOpportunities(opportunities, context);
  return ranked.find((opportunity) => opportunity.status === "active" && opportunity.priority >= 35) || null;
}

export function buildQuestionPlan(opportunity, context = {}) {
  if (!opportunity || opportunity.status !== "active") return null;
  const questionType = opportunity.recommendedQuestionTypes?.[0] || CATEGORY_TO_QUESTION_TYPES[opportunity.category]?.[0] || "evidence_detail";
  return {
    id: stableId(["question_plan", opportunity.id, questionType]),
    opportunityId: opportunity.id,
    category: opportunity.category,
    questionType,
    goal: compact(`Collect ${opportunity.missingEvidence}.`, 140),
    expectedEvidence: compact(opportunity.missingEvidence, 140),
    expectedConfidenceGain: opportunity.confidenceGainPotential,
    requiredContext: {
      targetRole: context.targetRole || "",
      roleContext: context.roleContext || "",
      evidenceIds: asArray(opportunity.evidenceIds),
    },
    blockingReason: compact(opportunity.blockingDecision, 180),
    possibleFollowUps: asArray(opportunity.recommendedQuestionTypes)
      .filter((type) => type !== questionType)
      .slice(0, 2)
      .map((type) => ({
        questionType: type,
        goal: compact(`Clarify ${opportunity.missingEvidence}.`, 120),
      })),
    completionCriteria: [
      "Answer references one concrete example",
      "Answer connects the example to the target role",
      opportunity.category === "measurable_impact" ? "Answer includes a metric or before-after result" : null,
      opportunity.category === "portfolio_proof" ? "Answer includes an artifact, link, or inspectable work sample" : null,
      opportunity.category === "stakeholder_influence" ? "Answer names the affected stakeholder, team, customer, or user group" : null,
    ].filter(Boolean),
  };
}

export function buildQuestionPlans(opportunities = [], context = {}) {
  return rankEvidenceOpportunities(opportunities, context)
    .map((opportunity) => buildQuestionPlan(opportunity, context))
    .filter(Boolean);
}

export function selectNextQuestionPlan(opportunities = [], context = {}) {
  return buildQuestionPlans(opportunities, context)[0] || null;
}

export function buildOpportunityPlanningReport(input = {}) {
  const opportunities = buildEvidenceOpportunities(input);
  const context = input.context || {};
  const questionPlans = buildQuestionPlans(opportunities, context);
  return {
    mode: "shadow",
    opportunityCount: opportunities.length,
    activeOpportunityCount: opportunities.filter((item) => item.status === "active").length,
    topOpportunity: opportunities.find((item) => item.status === "active") || null,
    opportunities,
    nextQuestionPlan: questionPlans[0] || null,
    questionPlans,
    rankingWeights: OPPORTUNITY_WEIGHTS,
  };
}

export {
  OPPORTUNITY_WEIGHTS,
  CATEGORY_TO_QUESTION_TYPES,
  CATEGORY_DEFAULTS,
};
