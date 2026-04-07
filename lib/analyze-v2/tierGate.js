function truncate(s, max) {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildUnifiedResponse(ats, recruiter, gaps, roleFit, decision, sector) {
  return {
    Context: { sector: sector || "Auto-detect" },
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
    },
  };
}

/**
 * Free tier: score + verdict + one gap + truncated narrative; Pro gets full object.
 */
export function applyTierGate(full, isPro) {
  if (isPro) return { ...full, tier: "pro" };

  const gaps = full.Gaps?.rejection_reasons || [];
  const firstGap = gaps[0];

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
      reasoning: truncate(full.Recruiter?.reasoning, 280),
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
      reasoning: truncate(full.Decision?.reasoning, 320),
      what_to_fix_first: (full.Decision?.what_to_fix_first || []).slice(0, 1),
    },
  };
}
