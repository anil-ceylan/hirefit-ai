import { callClaude, CLAUDE_MODEL_OPUS, CLAUDE_MODEL_SONNET } from "../claudeClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { criticalOutputLanguageInstruction, fallbackNoReasoning, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";
import { buildRecruiterSystemPrompt } from "../recruiterSystemPrompt.js";
import { parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "./actionPlanNormalize.js";
import { normalizeCareerRoleLabel } from "./roleTaxonomy.js";

const MODEL = CLAUDE_MODEL_SONNET;

/** Visible copy only: jargon strip, fake score promises removed, length cap. No scoring side effects. */
function scrubDecisionJargon(text, langNorm) {
  const tr = langNorm === "tr";
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const patterns = [
    [/role[-\s]?fit(?:\s*signal)?/gi, tr ? "rol uyumu" : "role fit"],
    [/\balignment\b|alignment\s*deficit|uyum\s*eksikliği|uyum\s*eksikligi/gi, tr ? "oturus" : "fit"],
    [/signal\s*density|sinyal\s*yoğunluğu|sinyal\s*yogunlugu/gi, tr ? "netlik" : "clarity"],
    [/output\s*intensity|çıktı\s*yoğunluğu|cikti\s*yogunlugu/gi, tr ? "somut cikti" : "tangible output"],
    [/execution\s*signal|execution\s*sinyali/gi, tr ? "net teslim" : "delivery proof"],
    [/\bproduct\s+signal\b/gi, tr ? "urun tarafi" : "product background"],
    [/\bfit\s+signal\b/gi, tr ? "rol okumasi" : "role match read"],
    [/\bweak\s+signal\b/gi, tr ? "zayif okuma" : "weak read"],
    [/\bstrong\s+signal\b/gi, tr ? "guclu okuma" : "strong read"],
    [/scope\s*signal|kapsam\s*sinyali/gi, tr ? "is kapsami" : "scope"],
    [/role[-\s]*specific\s*output|role\s*özgü\s*çıktı|role\s*ozgu\s*cikti/gi, tr ? "role bagli somut is" : "role-tied work"],
    [/keyword\s*matrix|keyword[-\s]*style/gi, tr ? "ilan dili" : "posting language"],
    [/\bATS\b/gi, ""],
    [/optimize|optimi[sz]e|leverage|enhance/gi, tr ? "netlestir" : "tighten"],
    [/\bshortlist\b/gi, tr ? "kisa liste" : "shortlist"],
    [/güçlü\s*sinyal|guclu\s*sinyal/gi, tr ? "guclu yan" : "strong side"],
    [/zayıf\s*sinyal|zayif\s*sinyal/gi, tr ? "zayif yan" : "weak read"],
    [/profil\s*sinyali/gi, tr ? "profil" : "profile"],
    [/eleme\s*sinyali/gi, tr ? "eleme riski" : "screen-out risk"],
    [/red\s*sinyali/gi, tr ? "red riski" : "rejection risk"],
    [/başlangıç\s*sinyali|baslangic\s*sinyali/gi, tr ? "baslangic izlenimi" : "early read"],
    [/kısmi\s*sinyal|kismi\s*sinyal/gi, tr ? "kismi kanit" : "partial proof"],
    [/structured\s+analysis|confidence\s+of\s+\d+\s*%/gi, ""],
  ];
  for (const [re, rep] of patterns) s = s.replace(re, rep);
  if (tr) {
    s = s.replace(/\bsinyal(ler|i|ini|ine|inde)?\b/gi, "örnek").replace(/\börnek\s+örnek\b/gi, "örnek");
  } else {
    s = s.replace(/\bsignals\b/gi, "reads").replace(/\bsignal\b/gi, "read");
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

function stripFakeScorePromiseLanguage(s) {
  return String(s || "")
    .replace(/\bscore\s+will\s+(increase|rise)\s+by\s+\d+\+?/gi, "")
    .replace(/\balignment\s+score\s+will\s+go\s+up\s+by\s+\d+/gi, "")
    .replace(/puan(?:ınız|iniz)?(?:ı|i)?\s*(?:yaklaşık|yaklasik|about)?\s*\+\s*\d+/gi, "")
    .replace(/\+\s*\d+\s*puan(?:\s|$|[,.;])/gi, "")
    .replace(/\+\s*\d+\s*points?(?:\s|$|[,.;])/gi, "")
    .replace(/increase\s+(your\s+)?(fit\s+)?score\s+by\s+\d+/gi, "")
    .replace(/\beslesme\s+skorunuzu?\s+\d+\s*puan\s+art[ıi]r[ıi]r/gi, "")
    .replace(/\bthis\s+will\s+(boost|raise)\s+your\s+score\s+by\s+\d+/gi, "")
    .replace(/\b\d{1,2}\s*%\s*(?:skor|score|uyum)\s*(?:art|yüksel|yuksel)/gi, "")
    .replace(/uyumun(?:uz)?\s+%?\d{1,3}/gi, "")
    .replace(/match\s+(?:to|toward)\s*~?\s*\d{1,3}%/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compressDecisionText(text, { maxSentences = 2, maxChars = 260 } = {}) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const parts = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  t = parts.slice(0, Math.max(1, maxSentences)).join(" ");
  if (t.length > maxChars) return `${t.slice(0, maxChars - 3).trim()}...`;
  return t;
}

function humanizeDecisionVisibleText(text, langNorm, opts = {}) {
  const maxSentences = opts.maxSentences ?? 2;
  const maxChars = opts.maxChars ?? 260;
  let s = String(text || "").trim();
  if (!s) return "";
  s = stripFakeScorePromiseLanguage(s);
  s = scrubDecisionJargon(s, langNorm);
  s = compressDecisionText(s, { maxSentences, maxChars });
  return s.trim();
}

function humanizeActionPlan(plan, langNorm) {
  if (!plan || typeof plan !== "object") return plan;
  const h = (t, o) => humanizeDecisionVisibleText(t, langNorm, o);
  return {
    ...plan,
    priority_callout: plan.priority_callout == null ? null : h(plan.priority_callout, { maxSentences: 1, maxChars: 72 }),
    interview_note: plan.interview_note == null ? null : h(plan.interview_note, { maxSentences: 1, maxChars: 96 }),
    fixes: (plan.fixes || []).map((f) => ({
      ...f,
      issue: h(f.issue, { maxSentences: 1, maxChars: 56 }),
      steps: (f.steps || []).map((step) => h(step, { maxSentences: 1, maxChars: 110 })),
      resource: f.resource
        ? { ...f.resource, label: h(f.resource.label, { maxSentences: 1, maxChars: 44 }) }
        : null,
    })),
  };
}

function dedupeSimilarReasons(lines, max = 4) {
  const out = [];
  for (const line of lines || []) {
    if (!line) continue;
    const tok = normalizeForSimilarity(line);
    if (!tok.length) {
      out.push(line);
      continue;
    }
    if (out.some((p) => jaccardSimilarity(tok, normalizeForSimilarity(p)) >= 0.52)) continue;
    out.push(line);
  }
  return out.slice(0, max);
}

export async function runDecisionEngine({
  cvText,
  jobDescription,
  ats,
  recruiter,
  gaps,
  roleFit,
  sector,
  careerContext = null,
  lang: langNorm = "en",
}) {
  const lens = getSectorPromptBlock(sector, careerContext);
  const gapSignals = normalizeGapSignals(gaps?.rejection_reasons);
  const bundle = JSON.stringify({
    ats,
    recruiter,
    gaps: {
      biggest_gap: gaps?.biggest_gap || "",
      rejection_reasons: gapSignals,
    },
    roleFit,
  });

  const langInstruction = langNorm === "tr" ? MANDATORY_TURKISH_AI_OUTPUT : "Respond in English.";

  const sharedDataBlock = `${lens}

Original CV (excerpt if long — decide from data below):
${cvText.slice(0, 6000)}

Job description (excerpt):
${jobDescription.slice(0, 4000)}

Prior engine outputs (source of truth):
${bundle}`;

  const reasoningRulesSnippet = `- You MUST use structured gap signals: evidence_cv, context, explanation_code
- Every reason MUST reference both evidence_cv and jd_requirement from bundle gaps data.
- Format: "[evidence_cv] — but this role needs [jd_requirement]".
- core_problem must name a specific CV section, skill gap, or missing element — never a generic phrase like 'lacks experience' or 'no results shown'
- first_action: quote the exact weak line from the CV as-is, then suggest a rewrite. The rewrite must ONLY use information explicitly stated in the CV — zero invented numbers, zero invented metrics, zero invented percentages. If no metric exists in the CV for this line, suggest adding a specific tool name or scope instead of a number.
- Every reason must explicitly connect evidence -> risk -> recruiter decision
- recognition_line: one sentence on what the candidate is probably doing right now that hurts them — inferred from a specific CV gap, not generic.
- pattern_summary: two sentences connecting at least 2 gap signals into a root cause pattern — name the signals and why they compound.`;

  const actionPlanRulesBlock = `
Rules for action_plan:
- Return action_plan as a structured JSON object with EXACTLY this shape. Do not add extra fields. Do not write prose. No markdown inside string values.
- fixes array: minimum 1 item, maximum 3 items
- severity: use "critical" for the single worst blocker, "major" for important gaps, "minor" for optional polish
- priority: use "high" for exactly ONE fix — the single highest-leverage next action. Use "medium" or "low" for the other fixes.
- score_impact: integer 1-18 per fix. The "high" priority fix must have the largest score_impact among the three.
- steps: each fix must include a "steps" array with at least 1 and at most 5 short imperative strings (Build, Add, Remove, Apply, Switch, Write, Create, Update, Delete, Find).
- resource is JSON null if none; else { "label": "<max 5 words>", "url": "<https... or null>" }.

ACTION PLAN CONSTRAINTS (action_plan.fixes):
NEVER suggest changing degree / multi-year schooling. Only fixes completable in ~90 days.`;

  const scoringHints = `
Calibrate final_alignment_score 0–100 from ATS + recruiter + gaps in bundle (conservative — not optimism). Set confidence 0–100 for that score estimate.
Do NOT output final_verdict, reasoning, or recruiter_view — another pass handles those.
Output ONLY valid JSON with the schema below.${userPromptLangFooter(langNorm)}`;

  const sonnetUser = `${langInstruction}\n\nYou produce structured recruiter analysis JSON (scores, reasons, fixes, action plan).

${reasoningRulesSnippet}

${sharedDataBlock}

Career intelligence requirement:
- Do not summarize the CV. Infer why a recruiter gains confidence, why they hesitate, where the profile compounds, and which role direction creates the strongest career leverage.
- Prefer hiring psychology over dashboard language.
- Avoid generic HR filler: "candidate demonstrates", "overall good profile", "strong communication skills", "optimization needed", "alignment severity", "analysis complete".
- Explain narrative coherence, transferable value, market fit, and recruiter trust in concrete terms.

Return ONLY valid JSON:
{
  "final_alignment_score": <number 0-100>,
  "confidence": <number 0-100>,
  "recognition_line": "<...>",
  "core_problem": "<...>",
  "impact_statement": "<...>",
  "first_action": "<...>",
  "pattern_summary": "<...>",
  "reasons": [ "<same evidence_cv/jd_requirement format as Rules>" ],
  "fixes": ["<specific action 1>", "<specific action 2>"],
  "role_suggestions": [
    { "role": "<role name>", "score": <number 60-85>, "reason": "<why this role is a better fit>" }
  ],
  "action_plan": {
    "priority_callout": "<max 15 words>",
    "fixes": [
      {
        "issue": "<max 6 words>",
        "severity": "critical" | "major" | "minor",
        "priority": "high" | "medium" | "low",
        "score_impact": <integer 1-18>,
        "steps": ["<step 1>"],
        "resource": { "label": "<max 5 words>", "url": "<full URL or null>" } | null
      }
    ],
    "interview_note": "<max 20 words or null>"
  }
}

${actionPlanRulesBlock}

Role suggestion rules:
- Allowed role labels only: Product Management, Product Strategy, Growth, Growth Strategy, Business Analysis, Strategy & Operations, GTM Operations, AI Product Operations, Marketing, Data Analysis, Business Development, Project Management, Customer Success, UX Research.
- In Turkish output, use the Turkish equivalents: Ürün Yönetimi, Ürün Stratejisi, Growth / Büyüme, Growth Strategy, İş Analizi, Strateji & Operasyon, GTM Operasyonları, AI Product Operations, Pazarlama, Veri Analizi, Business Development, Proje Yönetimi, Müşteri Başarısı, UX Araştırma.
- Never use task phrases as role names. If the better lane mentions backlog, PRD, roadmap, user story, user flow, or product strategy, role must be Product Management / Ürün Yönetimi.
- Role suggestion reason must explain career adjacency: why recruiter confidence rises in that lane, what transferable evidence supports it, and why the candidate's positioning reads cleaner there.

${scoringHints}`;

  const sonnetSystem = `${buildRecruiterSystemPrompt(langNorm)}
${criticalOutputLanguageInstruction(langNorm)}
You write structured extraction only here (scores, rationales lists, fixes, action_plan). Output ONLY JSON per user schema — no prose outside JSON.

action_plan.fixes must never recommend changing degree, returning to university, or multi-year qualifications.`;

  const opusUser = `${langInstruction}\n\n${sharedDataBlock}

The recruiter.reasoning field in bundle is the recruiter's raw gut reaction — use it as the foundation for your reasoning field (I/you voice). Extend with apply/do-not-apply gut clarity.

Produce ONLY verdict and human voice strings. Another model computed alignment score and structured reasons in parallel — you must still pick final_verdict consistent with recruiter_verdict + gaps severity in bundle.

Verdict rules:
- do_not_apply if recruiter_verdict is "no" OR multiple high-impact rejection reasons clearly disqualify.
- apply_now only if ATS and recruiter both signal strong match.
- apply_with_risk for everything else.

Return ONLY valid JSON:
{
  "final_verdict": "apply_now" | "apply_with_risk" | "do_not_apply",
  "reasoning": "<recruiter voice, I/you only, built on recruiter.reasoning from bundle — max 4 sentences, ends with a clear accept/reject gut call>",
  "recruiter_view": "<what recruiter sees in 7 seconds, I/you>"
}${userPromptLangFooter(langNorm)}`;

  const opusSystem = `${buildRecruiterSystemPrompt(langNorm)}
${criticalOutputLanguageInstruction(langNorm)}
You are the senior voice pass: ONLY final verdict and tight recruiter narration. Sound like a tired in-house recruiter — direct, no cheerleading.

Output ONLY valid JSON as specified in the user message — no markdown fences, no text outside JSON.

Reference bundle and CV implicitly; summarize in reasoning in your own words — never paste raw CV lines.`;

  const [contentSonnet, contentOpus] = await Promise.all([
    callClaude(sonnetUser, sonnetSystem, 1200, { langNorm, model: MODEL }),
    callClaude(opusUser, opusSystem, 400, {
      langNorm,
      recruiterVoice: true,
      model: CLAUDE_MODEL_OPUS,
    }),
  ]);

  // eslint-disable-next-line no-console -- temporary debug requested by user
  console.log("[DecisionEngine] raw response type:", typeof contentSonnet);
  // eslint-disable-next-line no-console -- temporary debug requested by user
  console.log("[DecisionEngine] raw response preview:", String(contentSonnet).slice(0, 500));

  let pSonnet = {};
  let pOpus = {};
  try {
    const parsed = parseModelJson(contentSonnet);
    if (parsed == null) {
      // eslint-disable-next-line no-console -- temporary debug requested by user
      console.log("[DecisionEngine] parseModelJson returned null (sonnet)");
    }
    pSonnet = parsed || {};
  } catch (err) {
    // eslint-disable-next-line no-console -- temporary debug requested by user
    console.log("[DecisionEngine] parseModelJson threw (sonnet):", err?.message || err);
    pSonnet = {};
  }
  try {
    const parsed = parseModelJson(contentOpus);
    if (parsed == null) {
      // eslint-disable-next-line no-console -- temporary debug requested by user
      console.log("[DecisionEngine] parseModelJson returned null (opus)");
    }
    pOpus = parsed || {};
  } catch (err) {
    // eslint-disable-next-line no-console -- temporary debug requested by user
    console.log("[DecisionEngine] parseModelJson threw (opus):", err?.message || err);
    pOpus = {};
  }
  const p = {
    ...pSonnet,
    final_verdict: pOpus.final_verdict ?? pSonnet.final_verdict,
    reasoning: pOpus.reasoning ?? pSonnet.reasoning,
    recruiter_view: pOpus.recruiter_view ?? pSonnet.recruiter_view,
  };
  // eslint-disable-next-line no-console -- temporary debug requested by user
  console.log("[DecisionEngine] parsed fields:", {
    core_problem: p.core_problem,
    first_action: p.first_action,
    reasoning: p.reasoning?.slice(0, 100),
  });
  const verdict = normalizeVerdict(p.final_verdict);
  let score = clamp(p.final_alignment_score, 0, 100);
  score = reconcileScore(score, verdict, ats, recruiter);

  let actionPlan = parseActionPlan(p.action_plan);
  actionPlan = enrichActionPlan(actionPlan, {
    lang: langNorm,
    roleFit,
    gaps,
    verdict,
  });
  actionPlan = humanizeActionPlan(actionPlan, langNorm);
  const firstLine = pickDoThisNextStep(actionPlan.fixes);
  const what_to_fix_first = firstLine
    ? [humanizeDecisionVisibleText(firstLine, langNorm, { maxSentences: 1, maxChars: 140 })]
    : [];
  const evidenceAnchoredReasons = enforceEvidenceAnchoredReasons(
    takeStrings(p.reasons).slice(0, 4),
    gapSignals,
    langNorm
  );
  const coreProblem = buildCoreProblem(
    String(p.core_problem || "").trim(),
    gapSignals,
    langNorm
  );
  const recognitionLine = buildRecognitionLine(
    String(p.recognition_line || "").trim(),
    coreProblem,
    gapSignals,
    langNorm
  );
  const impactStatement = buildImpactStatement(
    String(p.impact_statement || "").trim(),
    gapSignals,
    langNorm
  );
  const firstAction = buildFirstAction(
    String(p.first_action || "").trim(),
    gapSignals,
    langNorm,
    cvText
  );
  const patternSummary = buildPatternSummary(
    String(p.pattern_summary || "").trim(),
    gapSignals,
    langNorm
  );
  const linkedReasons = linkReasonsWithPattern(evidenceAnchoredReasons, patternSummary, langNorm);
  const recruiterView = buildRecruiterViewFromSignals(
    String(p.recruiter_view || "").trim(),
    gapSignals,
    langNorm
  );
  const reasoning = String(p.reasoning || "").trim() || buildDecisionReasoningFallback({
    recruiter,
    recruiterView,
    gapSignals,
    langNorm,
  });

  const reasonsForOut = dedupeSimilarReasons(
    linkedReasons.map((r) => humanizeDecisionVisibleText(r, langNorm, { maxSentences: 2, maxChars: 220 })),
    4
  );
  const roleSuggestionsOut = normalizeRoleSuggestions(p.role_suggestions).map((x) => ({
    ...x,
    reason: humanizeDecisionVisibleText(x.reason, langNorm, { maxSentences: 2, maxChars: 200 }),
  }));

  return {
    final_alignment_score: score,
    final_verdict: verdict,
    confidence: clamp(p.confidence, 0, 100),
    reasoning: humanizeDecisionVisibleText(reasoning, langNorm, { maxSentences: 2, maxChars: 280 }),
    recognition_line: humanizeDecisionVisibleText(recognitionLine, langNorm, { maxSentences: 1, maxChars: 180 }),
    core_problem: humanizeDecisionVisibleText(coreProblem, langNorm, { maxSentences: 2, maxChars: 200 }),
    impact_statement: humanizeDecisionVisibleText(impactStatement, langNorm, { maxSentences: 2, maxChars: 220 }),
    first_action: humanizeDecisionVisibleText(firstAction, langNorm, { maxSentences: 2, maxChars: 220 }),
    pattern_summary: humanizeDecisionVisibleText(patternSummary, langNorm, { maxSentences: 2, maxChars: 240 }),
    reasons: reasonsForOut,
    recruiter_view: humanizeDecisionVisibleText(recruiterView, langNorm, { maxSentences: 2, maxChars: 200 }),
    fixes: takeStrings(p.fixes)
      .slice(0, 4)
      .map((f) => humanizeDecisionVisibleText(f, langNorm, { maxSentences: 1, maxChars: 160 })),
    role_suggestions: roleSuggestionsOut,
    what_to_fix_first,
    action_plan: actionPlan,
  };
}

function buildDecisionReasoningFallback({ recruiter, recruiterView, gapSignals, langNorm }) {
  const recruiterReasoning = String(recruiter?.reasoning || "").trim();
  if (recruiterReasoning) return recruiterReasoning;
  const rv = String(recruiterView || "").trim();
  if (rv) {
    return langNorm === "tr"
      ? `${rv} Bu yuzden recruiter kafasinda soru isareti kaliyor; hikaye tam oturmuyor.`
      : `${rv} That leaves open questions for me; the story does not fully lock.`;
  }
  const g = gapSignals?.[0];
  if (g?.evidence_cv || g?.jd_requirement) {
    const ev = String(g.evidence_cv || g.issue || "").trim();
    const req = String(g.jd_requirement || g.context || "").trim();
    if (langNorm === "tr") {
      return `${ev || "Profilinde"} role tamamen uzak degilsin ama ${req || "ilan tarafi"} net degil; recruiter tereddut eder.`;
    }
    return `${ev || "Your profile"} is not totally off this role, but ${req || "what the posting asks for"} is still fuzzy—I would hesitate.`;
  }
  return fallbackNoReasoning(langNorm);
}

export { parseActionPlan, enrichActionPlan, pickDoThisNextStep };

function normalizeVerdict(v) {
  const s = String(v || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (s === "apply_now" || s === "applynow") return "apply_now";
  if (s === "do_not_apply" || s === "dont_apply" || s === "do_not") return "do_not_apply";
  return "apply_with_risk";
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return 55;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function reconcileScore(aiScore, verdict, ats, recruiter) {
  const base =
    0.45 * (ats?.ats_score ?? 50) +
    0.3 * (ats?.keyword_match ?? 50) +
    0.25 * (ats?.formatting_score ?? 50);
  let blended = Math.round(0.5 * aiScore + 0.5 * base);
  if (recruiter?.recruiter_verdict === "no") blended = Math.min(blended, 52);
  if (recruiter?.recruiter_verdict === "strong_yes") blended = Math.max(blended, 58);
  if (verdict === "do_not_apply") return Math.min(blended, Math.min(54, aiScore));
  if (verdict === "apply_now") return Math.max(blended, Math.max(64, aiScore));
  return blended;
}

function takeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function normalizeRoleSuggestions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      role: normalizeCareerRoleLabel(
        String(r?.role || "").trim(),
        "EN",
        String(r?.reason || "")
      ),
      score: clamp(r?.score, 60, 85),
      reason: String(r?.reason || "").trim(),
    }))
    .filter((x) => x.role && x.reason)
    .slice(0, 3);
}

function normalizeGapSignals(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .map((r) => ({
      issue: String(r?.issue || "").trim(),
      context: String(r?.context || "").trim(),
      explanation_code: String(r?.explanation_code || "").trim(),
      evidence_cv: String(r?.evidence_cv || "").trim(),
      jd_requirement: String(r?.jd_requirement || "").trim(),
      risk_level: String(r?.risk_level || r?.impact || "").trim(),
    }))
    .filter((x) => x.issue);
}

function enforceEvidenceAnchoredReasons(modelReasons, gapSignals, langNorm) {
  const nonEmptyModel = Array.isArray(modelReasons) ? modelReasons.filter(Boolean) : [];
  const hasEvidenceInModel = nonEmptyModel.some((line) =>
    gapSignals.some((g) => g.evidence_cv && line.includes(g.evidence_cv))
  );
  if (nonEmptyModel.length && hasEvidenceInModel) return nonEmptyModel;
  return gapSignals
    .slice(0, 4)
    .map((g, idx) => buildReasonFromSignal(g, langNorm, idx))
    .filter(Boolean);
}

function buildRecruiterViewFromSignals(modelRecruiterView, gapSignals, langNorm) {
  if (modelRecruiterView && gapSignals.some((g) => g.evidence_cv && modelRecruiterView.includes(g.evidence_cv))) {
    return modelRecruiterView;
  }
  const g = gapSignals[0];
  if (!g) return modelRecruiterView || "";
  if (langNorm === "tr") {
    return `Ilk turda "${g.evidence_cv || g.issue}" gozume carpiyor; ${g.context || "ilan beklentisi"} tarafinda kanit zayif, risk yuksek okuyorum.`;
  }
  return `On first pass "${g.evidence_cv || g.issue}" stands out, but proof on ${g.context || "what this posting wants"} looks thin—I read higher risk.`;
}

function buildReasonFromSignal(signal, langNorm, idx = 0) {
  const evidence = signal?.evidence_cv || signal?.issue;
  const context = signal?.context || "missing_context";
  const reasonCode = signal?.explanation_code || "insufficient_signal_context";
  const risk = signal?.risk_level || "medium";
  const strength = signal?.signal_strength || "weak";
  if (!evidence) return "";
  const pattern = pickPattern({
    evidence,
    context,
    reasonCode,
    risk,
    strength,
    idx,
  });
  if (langNorm === "tr") {
    const fragments = getTurkishFragmentsByRisk(risk, evidence, context, reasonCode, strength);
    return fragments[pattern % fragments.length];
  }
  const fragments = getEnglishFragmentsByRisk(risk, evidence, context, reasonCode, strength);
  return fragments[pattern % fragments.length];
}

function pickPattern({ evidence, context, reasonCode, risk, strength, idx }) {
  const seed = `${evidence}|${context}|${reasonCode}|${risk}|${strength}|${idx}`;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 4;
}

function getTurkishFragmentsByRisk(risk, evidence, context, _reasonCode, _strength) {
  const ctx = context || "ilan beklentisi";
  if (risk === "high") {
    return [
      `"${evidence}" satirinda ${ctx} bos; recruiter bunu eleme tarafinda okuyabilir.`,
      `"${evidence}" aktiviteyi soyluyor, ${ctx} kanitini vermiyor; ilk turda geri dururum.`,
      `"${evidence}" var ama ${ctx} net degil; hikaye role tam baglanmiyor.`,
      `${ctx} icin "${evidence}" yeterince somut degil; riski yuksek tutarim.`,
    ];
  }
  if (risk === "low") {
    return [
      `"${evidence}" faydali; ${ctx} bir tik daha net olsa soru isaretim azalir.`,
      `"${evidence}" dogru yonde; ${ctx} tarafini bir cumle daha somut yaz.`,
      `${ctx} acisindan "${evidence}" tam ikna etmiyor ama dusuk riskte kaliyor.`,
      `"${evidence}" ile ${ctx} arasinda kopruyu guclendirirsen daha rahat okurum.`,
    ];
  }
  return [
    `"${evidence}" ${ctx} tarafinda yarim kaliyor; orta riskte tutuyorum.`,
    `${ctx} icin "${evidence}" tek basina yetmiyor; netlestirmezsen tereddut kalir.`,
    `"${evidence}" gorunuyor ama ${ctx} hikayesi tam oturmuyor.`,
    `${ctx} beklentisine "${evidence}" ile tam kopru kuramiyorum.`,
  ];
}

function getEnglishFragmentsByRisk(risk, evidence, context, _reasonCode, _strength) {
  const ctx = context || "what this posting wants";
  if (risk === "high") {
    return [
      `"${evidence}" leaves a ${ctx} hole—I would screen this hard.`,
      `"${evidence}" reads like activity without ${ctx} proof; I pause before yes.`,
      `I see "${evidence}", but ${ctx} is not credible yet; feels like a pass risk.`,
      `${ctx} is weak around "${evidence}"; I would not defend this in review.`,
    ];
  }
  if (risk === "low") {
    return [
      `"${evidence}" helps, but ${ctx} could be one notch clearer.`,
      `I buy "${evidence}" directionally; tighten ${ctx} and my doubt drops.`,
      `Low drama, but "${evidence}" still leaves ${ctx} slightly fuzzy.`,
      `Fine for now, yet "${evidence}" does not fully nail ${ctx}.`,
    ];
  }
  return [
    `"${evidence}" partially covers ${ctx}; I stay in maybe.`,
    `${ctx} is only half-proven by "${evidence}"—I need more.`,
    `"${evidence}" is there, but ${ctx} still feels thin on read-through.`,
    `Middle ground: "${evidence}" hints at ${ctx}, not a lock.`,
  ];
}

function buildPatternSummary(modelPatternSummary, gapSignals, langNorm) {
  if (modelPatternSummary && gapSignals.length >= 2) return modelPatternSummary;
  const top = gapSignals.slice(0, 3);
  if (!top.length) return "";
  const contexts = top.map((g) => g.context).filter(Boolean);
  const dominantContext = mostFrequent(contexts) || "";
  if (langNorm === "tr") {
    return dominantContext
      ? `Birden fazla satirda ayni bosluk gorunuyor (${dominantContext}); hikaye netlesmeden zayif kaliyor.`
      : "Birden fazla satirda ayni bosluk tekrarliyor; hikaye netlesmeden zayif kaliyor.";
  }
  return dominantContext
    ? `The same gap shows up across lines (${dominantContext}); the story stays thin for this role.`
    : "The same gap repeats across your lines; the story stays thin for this role.";
}

function linkReasonsWithPattern(reasons, patternSummary, langNorm) {
  if (!Array.isArray(reasons) || !reasons.length) return [];
  return reasons.map((line, idx) => {
    if (!line) return line;
    if (idx === 0) return line;
    if (langNorm === "tr") {
      if (idx === 1 && patternSummary) return `Ayrica (ayni tablo): ${line}`;
      if (idx === 1) return `Ayrica: ${line}`;
      return `Bir baska nokta: ${line}`;
    }
    if (idx === 1 && patternSummary) return `Also (same thread): ${line}`;
    if (idx === 1) return `Also: ${line}`;
    return `Another angle: ${line}`;
  });
}

function buildCoreProblem(modelCoreProblem, gapSignals, langNorm) {
  if (modelCoreProblem && includesAnyEvidence(modelCoreProblem, gapSignals)) return modelCoreProblem;
  const top = gapSignals[0];
  if (!top) return "";
  const evidence = top.evidence_cv || top.issue;
  const dominantContext = top.context || "missing_context";
  if (langNorm === "tr") {
    return `"${evidence}" ${dominantContext} tarafinda zayif; ana mesele bu.`;
  }
  return `"${evidence}" keeps ${dominantContext} weak—that is the core blocker.`;
}

function buildRecognitionLine(modelRecognitionLine, coreProblem, gapSignals, langNorm) {
  const modelSingle = toSingleSentence(modelRecognitionLine);
  if (
    modelSingle &&
    includesAnyEvidence(modelSingle, gapSignals) &&
    isBehaviorFocusedLine(modelSingle, langNorm) &&
    !isTooSimilar(modelSingle, coreProblem)
  ) {
    return modelSingle;
  }
  const top = gapSignals[0];
  if (!top) return "";
  const evidence = String(top.evidence_cv || top.issue || "bu satır").trim();
  const context = String(top.context || "geri dönüş").trim();
  const reasonCode = String(top.explanation_code || "").trim();
  if (langNorm === "tr") {
    let line = `Muhtemelen CV’inde "${evidence}" yazıp her başvuruda ${context} tarafını aynı şekilde bırakıyorsun.`;
    if (!isBehaviorFocusedLine(line, langNorm) || isTooSimilar(line, coreProblem)) {
      line = `Basvurularda "${evidence}" ayni kaliyor; ${reasonCode || context} icin role ozel kanit vermiyorsun.`;
    }
    return toSingleSentence(line);
  }
  let line = `You likely keep "${evidence}" as-is across applications, without adapting it to the ${context} expectation of each role.`;
  if (!isBehaviorFocusedLine(line, langNorm) || isTooSimilar(line, coreProblem)) {
    line = `You keep "${evidence}" static across roles, without sharper proof for ${reasonCode || context}.`;
  }
  return toSingleSentence(line);
}

function buildImpactStatement(modelImpactStatement, gapSignals, langNorm) {
  if (modelImpactStatement && includesAnyEvidence(modelImpactStatement, gapSignals)) return modelImpactStatement;
  const top = gapSignals[0];
  if (!top) return "";
  const risk = String(top.risk_level || "medium");
  const evidence = String(top.evidence_cv || top.issue || "bu satir");
  if (langNorm === "tr") {
    if (risk === "high") {
      return `"${evidence}" bu haliyle recruiter icin yuksek risk; kisa listede one cikmani zorlastirir.`;
    }
    if (risk === "low") {
      return `"${evidence}" netlesirse recruiter soru isareti azalir; hikaye daha anlasilir olur.`;
    }
    return `"${evidence}" tarafini netlestirirsen daha guclu gorunur; su an orta riskte tutuyorum.`;
  }
  if (risk === "high") {
    return `"${evidence}" as written reads risky to me—I would not advance you cleanly.`;
  }
  if (risk === "low") {
    return `Sharpen "${evidence}" and my open questions drop; the story gets easier to defend.`;
  }
  return `Tighten "${evidence}" and this role reads clearer; right now I stay cautious.`;
}

function actionHasFabricatedPercent(action, cvText, gapSignals) {
  if (!/\d{1,3}\s*%/.test(String(action || ""))) return false;
  const pool = `${String(cvText || "")} ${(gapSignals || []).map((g) => `${g.evidence_cv || ""} ${g.jd_requirement || ""}`).join(" ")}`;
  const rx = /(\d{1,3})\s*%/g;
  let m;
  while ((m = rx.exec(action)) !== null) {
    const n = m[1];
    if (!pool.includes(`${n}%`) && !pool.includes(`%${n}`)) return true;
  }
  return false;
}

function buildFirstAction(modelFirstAction, gapSignals, langNorm, cvText = "") {
  const raw = String(modelFirstAction || "").trim();
  if (raw && includesAnyEvidence(raw, gapSignals) && !actionHasFabricatedPercent(raw, cvText, gapSignals)) {
    return raw;
  }
  const top = gapSignals[0];
  if (!top) return "";
  const evidence = String(top.evidence_cv || top.issue || "").trim();
  const context = String(top.context || top.jd_requirement || "").trim();
  if (!evidence) return "";
  if (langNorm === "tr") {
    return `CV'nde "${evidence}" satirini "${context || "rol beklentisi"}" cercevesinde bir tik netlestir; arac ve kapsami yaz, rakam uydurma.`;
  }
  return `Nudge "${evidence}" on your CV toward "${context || "what this role expects"}"—name tools and scope, no invented numbers.`;
}

function includesAnyEvidence(text, gapSignals) {
  const line = String(text || "").trim();
  if (!line) return false;
  return gapSignals.some((g) => {
    const ev = String(g?.evidence_cv || "").trim();
    return ev && line.includes(ev);
  });
}

function toSingleSentence(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const cut = normalized.match(/^(.+?[.!?])(\s|$)/);
  if (cut && cut[1]) return cut[1].trim();
  return normalized;
}

function isBehaviorFocusedLine(text, langNorm) {
  const line = String(text || "").toLowerCase();
  if (!line) return false;
  const behaviorVerbsTr = ["başvur", "güncell", "yaz", "kullan", "gönder", "dene", "bırak", "uyarla"];
  const behaviorVerbsEn = ["apply", "update", "write", "use", "submit", "keep", "adapt", "send"];
  const verbs = langNorm === "tr" ? behaviorVerbsTr : behaviorVerbsEn;
  const hasVerb = verbs.some((v) => line.includes(v));
  const hasEvidenceCue =
    line.includes('"') || line.includes("cv") || line.includes("resume") || line.includes("başvuru");
  return hasVerb && hasEvidenceCue;
}

function isTooSimilar(a, b) {
  const aa = normalizeForSimilarity(a);
  const bb = normalizeForSimilarity(b);
  if (!aa || !bb) return false;
  const overlap = jaccardSimilarity(aa, bb);
  return overlap >= 0.6;
}

function normalizeForSimilarity(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/["'.,:;!?()[\]{}]/g, " ")
    .split(/\s+/)
    .filter((t) => t && t.length > 2);
}

function jaccardSimilarity(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = new Set([...a, ...b]).size || 1;
  return inter / union;
}

function mostFrequent(arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  let best = "";
  let bestCount = -1;
  for (const [k, c] of m.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}
