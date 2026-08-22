import { firstCompleteSentences } from "../sentenceTruncate.js";
import { parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "./actionPlanNormalize.js";
import { fallbackNoReasoning, normalizeAnalyzeLang } from "./lang.js";

/** Free tier: first 2 complete sentences (no mid-sentence ellipsis). */
function truncateNarrative(s, maxCharsHint) {
  const two = firstCompleteSentences(s, 2);
  if (two.length <= maxCharsHint) return two;
  return firstCompleteSentences(s, 1);
}

function ensureNarrative(s, langNorm, maxCharsHint) {
  const trimmed = String(s || "").trim();
  if (!trimmed) return truncateNarrative(fallbackNoReasoning(langNorm), maxCharsHint);
  return truncateNarrative(trimmed, maxCharsHint);
}

export function buildUnifiedResponse(ats, recruiter, gaps, roleFit, decision, sector, careerContext = null) {
  const recruiterStructured = normalizeRecruiterStructuredForResponse(recruiter?.structured_analysis);
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
    recognition_line: decision.recognition_line || "",
    core_problem: decision.core_problem || "",
    impact_statement: decision.impact_statement || "",
    first_action: decision.first_action || "",
    pattern_summary: decision.pattern_summary || "",
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
      structured_analysis: recruiterStructured,
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
      reasoning: ensureNarrative(full.Recruiter?.reasoning, langNorm, 320),
      strengths: (full.Recruiter?.strengths || []).slice(0, 1),
      weaknesses: [],
      red_flags: [],
      structured_analysis: normalizeRecruiterStructuredForResponse(full.Recruiter?.structured_analysis, {
        langNorm,
        fallbackReasoning: full.Recruiter?.reasoning,
      }),
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
      reasoning: ensureNarrative(full.Decision?.reasoning, langNorm, 360),
      what_to_fix_first: nextLine ? [nextLine] : (full.Decision?.what_to_fix_first || []).slice(0, 1),
      action_plan: actionPlanForFree,
    },
    Output: {
      decision: full.Decision?.reasoning || "",
      recognition_line: "",
      core_problem: "",
      impact_statement: "",
      first_action: "",
      pattern_summary: "",
      reasons: firstGap ? [firstGap.issue].filter(Boolean) : [],
      recruiter_view: ensureNarrative(full.Recruiter?.reasoning, langNorm, 260),
      fixes: (actionPlanForFree?.fixes || []).slice(0, 2).map((f) => f.issue).filter(Boolean),
      role_suggestions: [],
    },
  };
}

function normalizeRecruiterStructuredForResponse(structured, { langNorm = "en", fallbackReasoning = "" } = {}) {
  const tr = langNorm === "tr";
  const firstPerception = String(structured?.first_perception || "").trim()
    || (tr
      ? "Profil tamamen disarida degil; ilk bakista bazi soru isaretleri var."
      : "You are not fully out of range, but I still have question marks on first read.");
  const internalMonologue = ensureNarrative(
    structured?.internal_monologue || fallbackReasoning,
    langNorm,
    300
  );
  const coreConcern = String(structured?.core_concern || "").trim()
    || (tr
      ? "Bu rol teknik gecmis istiyor; CV'de bunu net goremiyorum."
      : "This role wants technical depth I cannot clearly see on your CV.");
  const persuasionTip = String(structured?.persuasion_tip || "").trim()
    || (tr
      ? "- Bu role baglanan somut bir is satirini CV'de daha gorunur yaz."
      : "- Make one concrete delivery line for this role easier to spot on your CV.");
  const signalTags = Array.isArray(structured?.signal_tags)
    ? structured.signal_tags.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 4)
    : [];
  return {
    first_perception: capSentences(stripForbiddenRecruiterLabels(firstPerception), 1, 96),
    internal_monologue: capSentences(stripForbiddenRecruiterLabels(internalMonologue), 1, 96),
    core_concern: capSentences(stripForbiddenRecruiterLabels(coreConcern), 1, 96),
    persuasion_tip: capBullets(stripForbiddenRecruiterLabels(persuasionTip), 1, 110),
    signal_tags: signalTags.length ? signalTags : [tr ? "Partial Match" : "Partial Match"],
  };
}

function stripForbiddenRecruiterLabels(text) {
  return String(text || "")
    .replace(/güçlü\s*sinyal/gi, "")
    .replace(/gerilim\s*noktası/gi, "")
    .replace(/strongest\s*signal/gi, "")
    .replace(/decision\s*tension/gi, "")
    .replace(/signal\s*density|sinyal\s*yoğunluğu|sinyal\s*yogunlugu/gi, "")
    .replace(/output\s*intensity|çıktı\s*yoğunluğu|cikti\s*yogunlugu/gi, "")
    .replace(/role[-\s]*specific\s*output|role\s*özgü\s*çıktı|role\s*ozgu\s*cikti|kapsam\s*sinyali/gi, "")
    .replace(/\balignment\b/gi, "")
    .replace(/ats/gi, "")
    .replace(/debug/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function capSentences(text, maxSentences = 1, maxChars = 180) {
  const picked = String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, maxSentences))
    .join(" ")
    .trim();
  if (picked.length <= maxChars) return picked;
  return `${picked.slice(0, maxChars - 3).trim()}...`;
}

function capBullets(text, maxBullets = 2, maxChars = 220) {
  const lines = String(text || "")
    .split(/\n|•/)
    .map((x) => x.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, Math.max(1, maxBullets));
  const joined = lines.map((l) => `- ${l}`).join("\n").trim();
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars - 3).trim()}...`;
}
