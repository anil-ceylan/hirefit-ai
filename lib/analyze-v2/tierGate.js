import { firstCompleteSentences } from "../sentenceTruncate.js";
import { parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "./actionPlanNormalize.js";
import { normalizeAnalyzeLang } from "./lang.js";

/** Free tier: first 2 complete sentences (no mid-sentence ellipsis). */
function truncateNarrative(s, maxCharsHint) {
  const two = firstCompleteSentences(s, 2);
  if (two.length <= maxCharsHint) return two;
  return firstCompleteSentences(s, 1);
}

export function buildUnifiedResponse(ats, recruiter, gaps, roleFit, decision, sector, careerContext = null) {
  const roleSuggestions = Array.isArray(decision.role_suggestions) && decision.role_suggestions.length
    ? decision.role_suggestions
    : (roleFit?.role_fit || []).slice(0, 3).map((r) => ({
        role: r.role,
        score: Number.isFinite(Number(r.score)) ? Math.max(60, Math.min(85, Math.round(Number(r.score)))) : 70,
        reason: r.evidence || "",
      }));
  const reasons = Array.isArray(decision.reasons) && decision.reasons.length
    ? decision.reasons
    : (gaps?.rejection_reasons || []).slice(0, 3).map((r) => r.issue).filter(Boolean);
  const fixes = Array.isArray(decision.fixes) && decision.fixes.length
    ? decision.fixes
    : (decision?.action_plan?.fixes || []).slice(0, 3).map((f) => f.issue).filter(Boolean);
  const structured = {
    decision: decision.reasoning || "",
    reasons,
    recruiter_view: decision.recruiter_view || recruiter.reasoning || "",
    fixes,
    role_suggestions: roleSuggestions,
  };
  return {
    Context: {
      sector: sector || "Auto-detect",
      career_area: careerContext?.area || "",
      career_area_confidence: careerContext?.confidence || "",
      career_area_reason: careerContext?.reason || "",
      career_area_fallback_applied: Boolean(careerContext?.fallbackApplied),
    },
    "Final Alignment Score": decision.final_alignment_score,
    ATS: {
      ats_score: ats.ats_score,
      keyword_match: ats.keyword_match,
      formatting_score: ats.formatting_score,
      matched_skills: ats.matched_skills,
      top_keywords: ats.top_keywords,
      missing_keywords: ats.missing_keywords,
      parsing_issues: ats.parsing_issues,
    },
    Recruiter: {
      recruiter_verdict: recruiter.recruiter_verdict,
      reasoning: recruiter.reasoning,
      strengths: recruiter.strengths,
      weaknesses: recruiter.weaknesses,
      red_flags: recruiter.red_flags,
    },
    Gaps: {
      rejection_reasons: gaps.rejection_reasons,
      biggest_gap: gaps.biggest_gap,
    },
    RoleFit: {
      role_fit: roleFit.role_fit,
      best_role: roleFit.best_role,
    },
    Decision: {
      final_verdict: decision.final_verdict,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      what_to_fix_first: decision.what_to_fix_first,
      action_plan: decision.action_plan,
    },
    Output: structured,
    ...structured,
  };
}

/**
 * Free tier: score + verdict + one gap + truncated narrative; Pro gets full object.
 * @param {object} full
 * @param {boolean} isPro
 * @param {string} [lang] UI / analysis language (e.g. "en", "tr", "EN") — used to enrich action_plan for free users.
 */
export function applyTierGate(full, isPro, lang = "en") {
  if (isPro) return { ...full, tier: "pro" };

  const langNorm = normalizeAnalyzeLang(lang);
  const gaps = full.Gaps?.rejection_reasons || [];
  const firstGap = gaps[0];

  const rawPlan = full.Decision?.action_plan;
  const basePlan =
    rawPlan == null
      ? { priority_callout: null, fixes: [], interview_note: null }
      : parseActionPlan(typeof rawPlan === "string" ? rawPlan : rawPlan);
  const actionPlanForFree = enrichActionPlan(basePlan, {
    lang: langNorm,
    roleFit: full.RoleFit,
    gaps: full.Gaps,
    verdict: full.Decision?.final_verdict,
  });
  const nextLine = pickDoThisNextStep(actionPlanForFree.fixes);

  return {
    "Final Alignment Score": full["Final Alignment Score"],
    Context: full.Context || { sector: "Auto-detect" },
    tier: "free",
    ATS: {
      ats_score: full.ATS?.ats_score,
      keyword_match: full.ATS?.keyword_match,
      formatting_score: full.ATS?.formatting_score,
      matched_skills: (full.ATS?.matched_skills || []).slice(0, 6),
      top_keywords: (full.ATS?.top_keywords || []).slice(0, 8),
      missing_keywords: (full.ATS?.missing_keywords || []).slice(0, 6),
      parsing_issues: (full.ATS?.parsing_issues || []).slice(0, 1),
    },
    Recruiter: {
      recruiter_verdict: full.Recruiter?.recruiter_verdict,
      reasoning: truncateNarrative(full.Recruiter?.reasoning, 320),
      strengths: (full.Recruiter?.strengths || []).slice(0, 1),
      weaknesses: [],
      red_flags: [],
    },
    Gaps: {
      rejection_reasons: firstGap ? [firstGap] : [],
      biggest_gap: full.Gaps?.biggest_gap || "",
    },
    RoleFit: {
      role_fit: [],
      best_role: "",
      locked: true,
    },
    Decision: {
      final_verdict: full.Decision?.final_verdict,
      confidence: full.Decision?.confidence,
      reasoning: truncateNarrative(full.Decision?.reasoning, 360),
      what_to_fix_first: nextLine ? [nextLine] : (full.Decision?.what_to_fix_first || []).slice(0, 1),
      action_plan: actionPlanForFree,
    },
    Output: {
      decision: full.Decision?.reasoning || "",
      reasons: firstGap ? [firstGap.issue].filter(Boolean) : [],
      recruiter_view: truncateNarrative(full.Recruiter?.reasoning, 260),
      fixes: (actionPlanForFree?.fixes || []).slice(0, 2).map((f) => f.issue).filter(Boolean),
      role_suggestions: [],
    },
  };
}
