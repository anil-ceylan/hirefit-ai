import {
  detectEvidenceCategories,
  EVIDENCE_COHERENCE_CATEGORIES,
} from "./evidenceCoherence.js";
import { clampScore } from "./evidenceTypes.js";

const CATEGORY_LABELS = Object.freeze({
  measurable_impact: "Measurable Impact Proof",
  ownership: "Ownership Proof",
  stakeholder_influence: "Stakeholder Influence",
  business_case: "Business Case Work",
  role_specific_skill: "Role-Specific Skill Proof",
  execution: "Execution Proof",
  leadership: "Leadership Proof",
  communication: "Communication Proof",
  credibility: "Evidence Credibility",
  recency: "Recent Evidence",
  portfolio_proof: "Portfolio Proof",
});

const RELATED_CATEGORIES = Object.freeze({
  measurable_impact: ["business_case", "execution", "portfolio_proof"],
  ownership: ["execution", "leadership"],
  stakeholder_influence: ["communication", "leadership", "execution"],
  business_case: ["measurable_impact", "stakeholder_influence", "portfolio_proof"],
  role_specific_skill: ["portfolio_proof", "execution", "credibility"],
  execution: ["ownership", "measurable_impact", "portfolio_proof"],
  leadership: ["ownership", "stakeholder_influence"],
  communication: ["stakeholder_influence", "credibility"],
  credibility: ["portfolio_proof", "recency"],
  recency: ["credibility"],
  portfolio_proof: ["credibility", "role_specific_skill", "business_case"],
});

const SOURCE_PRIORITY = Object.freeze({
  evidence_opportunity: 95,
  contradiction: 90,
  current_gap: 86,
  missing_signal: 78,
  weak_evidence: 64,
  missing_field: 54,
  fallback: 30,
});

const RANKING_WEIGHTS = Object.freeze({
  targetRoleRelevance: 0.2,
  evidenceWeakness: 0.18,
  missingEvidenceSeverity: 0.18,
  recruiterImpact: 0.16,
  readinessImpact: 0.1,
  actionability: 0.1,
  confidence: 0.06,
  contradictionRisk: 0.02,
});

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ğüşıöçİĞÜŞÖÇ\s/&-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === "") return [];
  return [value];
}

function compact(value, max = 260) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

export function categoryForGap(input = "") {
  const text = norm(input);
  if (/portfolio|github|demo|repo|case study|portfoy|portföy|public link/.test(text)) return "portfolio_proof";
  if (/business case|case work|strategy case|vaka|is vakasi|iş vakası/.test(text)) return "business_case";
  if (/stakeholder|paydas/.test(text)) return "stakeholder_influence";
  if (/metric|kpi|outcome|impact|sonuc|etki/.test(text)) return "measurable_impact";
  if (/sql|dashboard|model|roadmap|prd|backlog|skill|beceri/.test(text)) return "role_specific_skill";
  if (/lead|lider|manage/.test(text)) return "leadership";
  if (/communication|iletisim|story|headline/.test(text)) return "communication";
  if (/recent|date|tarih|guncel/.test(text)) return "recency";
  if (/execution|process|workflow|ship|launch|deploy|surec|teslim/.test(text)) return "execution";
  const detected = detectEvidenceCategories(text).filter((category) => category !== "credibility");
  if (detected.length) return detected[0];
  if (/cv|verified|source|kanit|proof|evidence/.test(text)) return "credibility";
  return "credibility";
}

function confidenceFromReport(report) {
  return clampScore(report?.confidenceScore ?? 0);
}

function scoreFromWeakEvidence(item) {
  const weight = Number(item?.normalized_weight);
  if (!Number.isFinite(weight)) return 50;
  return clampScore(100 - weight);
}

function actionabilityFor(category, action = "") {
  const categories = detectEvidenceCategories(action);
  if (categories.includes(category)) return 92;
  if ((RELATED_CATEGORIES[category] || []).some((item) => categories.includes(item))) return 72;
  if (action) return 46;
  return 24;
}

function roleRelevanceFor(category, targetRole = "", roleContext = "") {
  const text = norm(`${targetRole} ${roleContext}`);
  if (!text) return 42;
  if (/product/.test(text)) {
    if (["ownership", "measurable_impact", "portfolio_proof", "role_specific_skill", "execution"].includes(category)) return 84;
  }
  if (/strategy|business|consult|operations|ops/.test(text)) {
    if (["business_case", "stakeholder_influence", "measurable_impact", "execution", "communication"].includes(category)) return 88;
  }
  if (/data|analytics|analyst/.test(text)) {
    if (["role_specific_skill", "measurable_impact", "portfolio_proof", "credibility"].includes(category)) return 88;
  }
  if (/software|engineer|developer/.test(text)) {
    if (["role_specific_skill", "portfolio_proof", "execution", "credibility"].includes(category)) return 88;
  }
  if (/marketing|growth/.test(text)) {
    if (["measurable_impact", "portfolio_proof", "communication", "execution"].includes(category)) return 84;
  }
  if (/hr|people|talent/.test(text)) {
    if (["stakeholder_influence", "communication", "leadership", "execution"].includes(category)) return 84;
  }
  if (/finance|financial/.test(text)) {
    if (["role_specific_skill", "business_case", "measurable_impact", "credibility"].includes(category)) return 88;
  }
  return 58;
}

function severityFromSource(source, category, report) {
  const contradictionBoost = (report?.contradictionFlags || []).length && ["ownership", "credibility"].includes(category) ? 14 : 0;
  const base = {
    evidence_opportunity: 88,
    current_gap: 76,
    missing_signal: 74,
    contradiction: 84,
    weak_evidence: 62,
    missing_field: 52,
    fallback: 34,
  }[source] || 50;
  return clampScore(base + contradictionBoost);
}

function recruiterImpactFor(category, report) {
  const confidence = confidenceFromReport(report);
  const confidenceGap = 100 - confidence;
  const categoryImpact = {
    measurable_impact: 92,
    business_case: 88,
    stakeholder_influence: 84,
    portfolio_proof: 82,
    role_specific_skill: 80,
    ownership: 78,
    execution: 76,
    credibility: 74,
    leadership: 68,
    communication: 64,
    recency: 48,
  }[category] || 60;
  return clampScore(categoryImpact * 0.65 + confidenceGap * 0.35);
}

function readinessImpactFor(category) {
  return {
    measurable_impact: 84,
    business_case: 82,
    role_specific_skill: 78,
    portfolio_proof: 76,
    execution: 74,
    stakeholder_influence: 70,
    ownership: 68,
    credibility: 62,
    leadership: 58,
    communication: 56,
    recency: 42,
  }[category] || 55;
}

function candidateId(category, title, source) {
  return `${source}:${category}:${norm(title).replace(/\s+/g, "_").slice(0, 80)}`;
}

function makeCandidate({
  category,
  title,
  description = "",
  targetRole = "",
  severity = 50,
  confidence = 50,
  evidenceSupport = [],
  missingEvidence = "",
  affectedMetrics = [],
  recommendedActionType = "",
  explanation = "",
  source = "fallback",
} = {}) {
  const resolvedCategory = category || categoryForGap(`${title} ${description} ${missingEvidence}`);
  const resolvedTitle = title || CATEGORY_LABELS[resolvedCategory] || "Evidence Gap";
  return {
    id: candidateId(resolvedCategory, resolvedTitle, source),
    category: resolvedCategory,
    title: compact(resolvedTitle, 120),
    description: compact(description || missingEvidence || resolvedTitle),
    targetRole: compact(targetRole, 120),
    severity: clampScore(severity),
    confidence: clampScore(confidence),
    evidenceSupport: asArray(evidenceSupport).map((item) => compact(item, 120)).slice(0, 5),
    missingEvidence: compact(missingEvidence || description || resolvedTitle),
    affectedMetrics: asArray(affectedMetrics).map((item) => compact(item, 80)).slice(0, 5),
    recommendedActionType: compact(recommendedActionType || resolvedCategory, 80),
    explanation: compact(explanation || description || missingEvidence || resolvedTitle),
    source,
  };
}

function currentGapCandidate(snapshot, context, report) {
  const gap = snapshot?.gapDetails || {};
  const title = gap.title || snapshot?.biggestGap?.title || snapshot?.biggestGap;
  if (!title) return null;
  const category = categoryForGap(`${title} ${gap.whyItMatters} ${gap.evidenceMissing} ${gap.action}`);
  return makeCandidate({
    category,
    title,
    description: gap.whyItMatters,
    targetRole: context.targetRole,
    severity: severityFromSource("current_gap", category, report),
    confidence: confidenceFromReport(report),
    evidenceSupport: [gap.evidenceMissing].filter(Boolean),
    missingEvidence: gap.evidenceMissing,
    affectedMetrics: ["recruiter_credibility", "career_decision_quality"],
    recommendedActionType: categoryForGap(gap.action || title),
    explanation: gap.whyItMatters,
    source: "current_gap",
  });
}

function evidenceOpportunityCandidate(snapshot, context, report) {
  const match = snapshot?.primaryRoleMatch || snapshot?.topRoleMatches?.[0] || snapshot?.roleMatches?.[0] || {};
  const opportunity = match.evidenceOpportunity;
  if (!opportunity?.title) return null;
  const category = categoryForGap(`${opportunity.title} ${opportunity.missingEvidence} ${opportunity.action}`);
  return makeCandidate({
    category,
    title: opportunity.title,
    description: opportunity.missingEvidence,
    targetRole: context.targetRole || match.roleName,
    severity: severityFromSource("evidence_opportunity", category, report),
    confidence: confidenceFromReport(report),
    evidenceSupport: opportunity.evidenceIds || [],
    missingEvidence: opportunity.missingEvidence,
    affectedMetrics: ["recruiter_credibility", "role_fit"],
    recommendedActionType: categoryForGap(opportunity.action || opportunity.title),
    explanation: opportunity.missingEvidence,
    source: "evidence_opportunity",
  });
}

function missingSignalCandidates(snapshot, context, report) {
  const match = snapshot?.primaryRoleMatch || snapshot?.topRoleMatches?.[0] || snapshot?.roleMatches?.[0] || {};
  return asArray(match.missingSignals).map((signal) => {
    const category = categoryForGap(signal);
    return makeCandidate({
      category,
      title: signal,
      description: `${signal} is missing for ${match.roleName || context.targetRole || "target role"}.`,
      targetRole: context.targetRole || match.roleName,
      severity: severityFromSource("missing_signal", category, report),
      confidence: confidenceFromReport(report),
      missingEvidence: signal,
      affectedMetrics: ["role_fit", "recruiter_credibility"],
      recommendedActionType: category,
      explanation: `${signal} limits role-specific confidence.`,
      source: "missing_signal",
    });
  });
}

function weakEvidenceCandidates(report, context) {
  return asArray(report?.weakestEvidence).slice(0, 4).map((item) => {
    const category = categoryForGap(`${item.type} ${item.title} ${item.description}`);
    return makeCandidate({
      category,
      title: CATEGORY_LABELS[category] || item.title,
      description: item.description,
      targetRole: context.targetRole,
      severity: scoreFromWeakEvidence(item),
      confidence: confidenceFromReport(report),
      evidenceSupport: [item.title],
      missingEvidence: item.title,
      affectedMetrics: ["evidence_quality"],
      recommendedActionType: item.quality_breakdown?.factors?.measurable_outcome < 55 ? "measurable_impact" : category,
      explanation: `${item.title} is the weakest evidence item.`,
      source: "weak_evidence",
    });
  });
}

function missingFieldCandidates(report, context) {
  return asArray(report?.missingEvidenceFields).slice(0, 3).map((gap) => {
    const category = gap.field === "occurred_at" ? "recency" : gap.field === "source_type" ? "credibility" : "portfolio_proof";
    return makeCandidate({
      category,
      title: CATEGORY_LABELS[category] || gap.label,
      description: `${gap.label} is missing across evidence items.`,
      targetRole: context.targetRole,
      severity: severityFromSource("missing_field", category, report),
      confidence: confidenceFromReport(report),
      missingEvidence: gap.label,
      affectedMetrics: ["evidence_quality"],
      recommendedActionType: category,
      explanation: `${gap.label} weakens evidence defensibility.`,
      source: "missing_field",
    });
  });
}

function contradictionCandidates(report, context) {
  return asArray(report?.contradictionFlags).slice(0, 3).map((flag) => {
    const category = flag.id === "high_ownership_without_outcome" ? "measurable_impact" : "credibility";
    return makeCandidate({
      category,
      title: CATEGORY_LABELS[category],
      description: flag.id,
      targetRole: context.targetRole,
      severity: severityFromSource("contradiction", category, report),
      confidence: confidenceFromReport(report),
      missingEvidence: flag.id,
      affectedMetrics: ["recruiter_credibility"],
      recommendedActionType: category,
      explanation: `Contradiction detected: ${flag.id}.`,
      source: "contradiction",
    });
  });
}

function dedupeCandidates(candidates) {
  const byCategory = new Map();
  for (const candidate of candidates.filter(Boolean)) {
    const key = candidate.category;
    const previous = byCategory.get(key);
    if (!previous) {
      byCategory.set(key, candidate);
      continue;
    }
    const winner = (SOURCE_PRIORITY[candidate.source] || 0) > (SOURCE_PRIORITY[previous.source] || 0)
      ? candidate
      : previous;
    const merged = {
      ...winner,
      severity: Math.max(previous.severity, candidate.severity),
      confidence: Math.max(previous.confidence, candidate.confidence),
      evidenceSupport: [...new Set([...previous.evidenceSupport, ...candidate.evidenceSupport])].slice(0, 5),
      affectedMetrics: [...new Set([...previous.affectedMetrics, ...candidate.affectedMetrics])].slice(0, 5),
    };
    byCategory.set(key, merged);
  }
  return [...byCategory.values()];
}

export function buildGapCandidates(profile = {}, snapshot = {}, evidenceReport = null, context = {}) {
  const inputProfile = profile || {};
  const inputSnapshot = snapshot || {};
  const match = inputSnapshot.primaryRoleMatch || inputSnapshot.topRoleMatches?.[0] || inputSnapshot.roleMatches?.[0] || {};
  const ctx = {
    targetRole: context.targetRole || match.roleName || inputSnapshot.targetRole || inputProfile.target_roles?.[0] || "",
    roleContext: context.roleContext || match.roleFamily || match.roleName || "",
    currentAction: context.currentAction || inputSnapshot.gapDetails?.action || inputSnapshot.suggestedNextMove || "",
  };
  return dedupeCandidates([
    currentGapCandidate(inputSnapshot, ctx, evidenceReport),
    evidenceOpportunityCandidate(inputSnapshot, ctx, evidenceReport),
    ...missingSignalCandidates(inputSnapshot, ctx, evidenceReport),
    ...weakEvidenceCandidates(evidenceReport, ctx),
    ...missingFieldCandidates(evidenceReport, ctx),
    ...contradictionCandidates(evidenceReport, ctx),
  ]);
}

export function evaluateGapCandidate(candidate, context = {}) {
  const sourceWeight = SOURCE_PRIORITY[candidate?.source] || SOURCE_PRIORITY.fallback;
  const targetRoleRelevance = roleRelevanceFor(candidate?.category, context.targetRole || candidate?.targetRole, context.roleContext);
  const evidenceWeakness = clampScore(candidate?.severity);
  const missingEvidenceSeverity = clampScore(candidate?.missingEvidence ? candidate.severity : candidate.severity * 0.72);
  const recruiterImpact = recruiterImpactFor(candidate?.category, context.evidenceReport);
  const readinessImpact = readinessImpactFor(candidate?.category);
  const actionability = actionabilityFor(candidate?.category, context.currentAction || candidate?.recommendedActionType);
  const confidence = clampScore(candidate?.confidence);
  const contradictionRisk = asArray(context.evidenceReport?.contradictionFlags).length ? 80 : 35;
  const factors = {
    targetRoleRelevance,
    evidenceWeakness,
    missingEvidenceSeverity,
    recruiterImpact,
    readinessImpact,
    actionability,
    confidence,
    contradictionRisk,
    sourceContinuity: sourceWeight,
  };
  const weighted = Object.entries(RANKING_WEIGHTS).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0);
  const score = clampScore(weighted * 0.88 + sourceWeight * 0.12);
  return {
    ...candidate,
    shadowScore: score,
    rankingFactors: factors,
  };
}

export function rankGapCandidates(candidates = [], context = {}) {
  const evaluated = asArray(candidates).map((candidate) => evaluateGapCandidate(candidate, context));
  return evaluated.sort((a, b) => {
    if (b.shadowScore !== a.shadowScore) return b.shadowScore - a.shadowScore;
    if (b.severity !== a.severity) return b.severity - a.severity;
    const sourceDelta = (SOURCE_PRIORITY[b.source] || 0) - (SOURCE_PRIORITY[a.source] || 0);
    if (sourceDelta) return sourceDelta;
    return String(a.title).localeCompare(String(b.title));
  });
}

export function selectBiggestGap(candidates = [], context = {}) {
  const ranked = rankGapCandidates(candidates, context);
  const top = ranked[0] || null;
  if (!top) return null;
  if (top.confidence < 18 || top.shadowScore < 35) {
    return { ...top, insufficientConfidence: true };
  }
  return top;
}

function categoryAgreementType(currentCategory, shadowCategory) {
  if (!currentCategory || !shadowCategory) return "insufficient_data";
  if (currentCategory === shadowCategory) return "category_match";
  if ((RELATED_CATEGORIES[currentCategory] || []).includes(shadowCategory)) return "related_gap";
  return "meaningful_disagreement";
}

export function compareGapSelections(currentGap, shadowGap, context = {}) {
  const currentTitle = typeof currentGap === "string" ? currentGap : currentGap?.title;
  const currentCategory = categoryForGap(`${currentTitle} ${currentGap?.description || ""} ${currentGap?.whyItMatters || ""}`);
  if (!shadowGap) {
    return {
      currentGap,
      shadowGap: null,
      agreementType: "insufficient_data",
      categoryAgreement: false,
      confidenceDelta: null,
      shadowRanking: [],
      reasonForDifference: "No shadow gap could be selected.",
      migrationRecommendation: "Do not migrate.",
    };
  }
  const titleMatch = norm(currentTitle) === norm(shadowGap.title);
  const categoryType = categoryAgreementType(currentCategory, shadowGap.category);
  const insufficient = shadowGap.insufficientConfidence || shadowGap.confidence < 25;
  const agreementType = insufficient
    ? "insufficient_shadow_confidence"
    : titleMatch
      ? "exact_match"
      : categoryType;
  const categoryAgreement = currentCategory === shadowGap.category;
  const shadowRanking = asArray(context.rankedCandidates).map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    category: candidate.category,
    score: candidate.shadowScore,
    confidence: candidate.confidence,
    source: candidate.source,
  }));
  const reasonForDifference = agreementType === "exact_match"
    ? "Current and shadow selectors chose the same gap."
    : agreementType === "category_match"
      ? "Shadow selector chose a different title in the same category."
      : agreementType === "related_gap"
        ? "Shadow selector chose a related category with stronger evidence basis."
        : agreementType === "insufficient_shadow_confidence"
          ? "Shadow selector confidence is not sufficient for visible migration."
          : "Shadow selector prioritizes a different evidence category.";
  const safeToConsider = ["exact_match", "category_match", "related_gap"].includes(agreementType) && !insufficient;
  return {
    currentGap,
    shadowGap,
    agreementType,
    categoryAgreement,
    titleMatch,
    confidenceDelta: clampScore(shadowGap.confidence) - clampScore(context.currentConfidence ?? 0),
    shadowRanking,
    reasonForDifference,
    migrationRecommendation: safeToConsider
      ? "Candidate for later guarded migration; keep shadow mode until broader validation passes."
      : "Do not migrate.",
  };
}

export { CATEGORY_LABELS, RANKING_WEIGHTS, RELATED_CATEGORIES };
