import { callClaude, CLAUDE_MODEL_OPUS, CLAUDE_MODEL_SONNET } from "../claudeClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { criticalOutputLanguageInstruction, fallbackNoReasoning, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";
import { buildRecruiterSystemPrompt } from "../recruiterSystemPrompt.js";
import { parseActionPlan, enrichActionPlan, pickDoThisNextStep } from "./actionPlanNormalize.js";

const MODEL = CLAUDE_MODEL_SONNET;

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
  const firstLine = pickDoThisNextStep(actionPlan.fixes);
  const what_to_fix_first = firstLine ? [firstLine] : [];
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
    langNorm
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
  const reasoning = String(p.reasoning || "").trim() || fallbackNoReasoning(langNorm);

  return {
    final_alignment_score: score,
    final_verdict: verdict,
    confidence: clamp(p.confidence, 0, 100),
    reasoning,
    recognition_line: recognitionLine,
    core_problem: coreProblem,
    impact_statement: impactStatement,
    first_action: firstAction,
    pattern_summary: patternSummary,
    reasons: linkedReasons,
    recruiter_view: recruiterView,
    fixes: takeStrings(p.fixes).slice(0, 4),
    role_suggestions: normalizeRoleSuggestions(p.role_suggestions),
    what_to_fix_first,
    action_plan: actionPlan,
  };
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
      role: String(r?.role || "").trim(),
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
    return `Recruiter ilk taramada "${g.evidence_cv || g.issue}" sinyalini görüyor ve ${g.explanation_code || g.context || "katkı_sinyali_zayıf"} nedeniyle riski yüksek değerlendiriyor.`;
  }
  return `In first-pass screening, the recruiter sees "${g.evidence_cv || g.issue}" and marks high risk due to ${g.explanation_code || g.context || "weak_impact_signal"}.`;
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

function getTurkishFragmentsByRisk(risk, evidence, context, reasonCode, strength) {
  if (risk === "high") {
    return [
      `"${evidence}" satırı ${context} boşluğu bırakıyor; ${reasonCode} nedeniyle recruiter bunu doğrudan eleme sinyali olarak okuyor (${strength}).`,
      `CV’indeki "${evidence}" ifadesi ${context} tarafını kanıtlamıyor; bu yüzden ${reasonCode} kodunda yüksek riskle eleniyorsun (${strength}).`,
      `"${evidence}" var ama ${context} yok; recruiter ${reasonCode} nedeniyle katkını doğrulayamıyor ve karar olumsuza dönüyor (${strength}).`,
      `"${evidence}" aktiviteyi söylüyor, sonucu değil; ${reasonCode} bu yüzden yüksek riskte net bir red sinyali üretiyor (${strength}).`,
    ];
  }
  if (risk === "low") {
    return [
      `"${evidence}" satırı ${context} tarafında küçük bir belirsizlik bırakıyor; ${reasonCode} nedeniyle düşük risk notu düşüyor (${strength}).`,
      `CV’inde "${evidence}" görünüyor; ${context} daha net olursa ${reasonCode} etkisi azalır ve sinyal güçlenir (${strength}).`,
      `"${evidence}" doğru yönde bir sinyal veriyor, ancak ${context} henüz tam kapanmadığı için ${reasonCode} düşük riskte kalıyor (${strength}).`,
      `"${evidence}" ifadesi faydalı ama ${context} düzeyinde daha görünür kanıt ister; ${reasonCode} şu an düşük riskte değerlendiriliyor (${strength}).`,
    ];
  }
  return [
    `"${evidence}" satırı ${context} tarafında kısmi sinyal veriyor; ${reasonCode} nedeniyle recruiter bunu orta riskte tutuyor (${strength}).`,
    `CV’indeki "${evidence}" ifadesi var, fakat ${context} netleşmediği için ${reasonCode} orta riskte değerlendiriliyor (${strength}).`,
    `"${evidence}" ${context} için başlangıç sinyali sunuyor, ancak ${reasonCode} nedeniyle karar tarafında orta risk baskısı oluşuyor (${strength}).`,
    `"${evidence}" görünüyor; ${context} daha somut olana kadar ${reasonCode} orta risk kategorisinde kalıyor (${strength}).`,
  ];
}

function getEnglishFragmentsByRisk(risk, evidence, context, reasonCode, strength) {
  if (risk === "high") {
    return [
      `The line "${evidence}" leaves a clear ${context} gap; due to ${reasonCode}, recruiters treat this as a direct rejection signal (${strength}).`,
      `In your CV, "${evidence}" does not validate ${context}; this maps to ${reasonCode} and drives a high-risk rejection call (${strength}).`,
      `"${evidence}" is present but ${context} is missing; with ${reasonCode}, recruiters cannot validate impact and move to reject (${strength}).`,
      `"${evidence}" shows activity, not outcome; because of ${reasonCode}, this becomes a high-risk screen-out factor (${strength}).`,
    ];
  }
  if (risk === "low") {
    return [
      `"${evidence}" leaves a minor ${context} ambiguity; under ${reasonCode}, recruiters mark this as low risk (${strength}).`,
      `Your CV includes "${evidence}", but ${context} could be clearer; that keeps ${reasonCode} in low-risk range (${strength}).`,
      `"${evidence}" points in the right direction, though ${context} is not fully explicit; ${reasonCode} stays low risk (${strength}).`,
      `"${evidence}" is useful, yet recruiters still need clearer ${context}; ${reasonCode} is currently low risk (${strength}).`,
    ];
  }
  return [
    `"${evidence}" shows partial ${context}; because of ${reasonCode}, recruiters keep this in medium-risk range (${strength}).`,
    `In your CV, "${evidence}" appears, however ${context} is still partial; this maps to ${reasonCode} as medium risk (${strength}).`,
    `The line "${evidence}" suggests ${context}, but not strongly enough; ${reasonCode} keeps recruiter confidence at medium risk (${strength}).`,
    `"${evidence}" is visible, yet ${context} is not fully established; recruiters classify ${reasonCode} as medium risk (${strength}).`,
  ];
}

function buildPatternSummary(modelPatternSummary, gapSignals, langNorm) {
  if (modelPatternSummary && gapSignals.length >= 2) return modelPatternSummary;
  const top = gapSignals.slice(0, 3);
  if (!top.length) return "";
  const contexts = top.map((g) => g.context).filter(Boolean);
  const reasonCodes = top.map((g) => g.explanation_code).filter(Boolean);
  const dominantContext = mostFrequent(contexts) || "insufficient_context_signal";
  const dominantReason = mostFrequent(reasonCodes) || "insufficient_signal";
  if (langNorm === "tr") {
    return `Genel desen: Issue'ların çoğunda ${dominantContext} ve ${dominantReason} birlikte tekrar ediyor; bu yüzden profil sinyali tutarlı ama yetersiz görünüyor.`;
  }
  return `Overall pattern: most issues repeatedly show ${dominantContext} with ${dominantReason}, creating a consistent but insufficient profile signal.`;
}

function linkReasonsWithPattern(reasons, patternSummary, langNorm) {
  if (!Array.isArray(reasons) || !reasons.length) return [];
  return reasons.map((line, idx) => {
    if (!line) return line;
    if (idx === 0) return line;
    if (langNorm === "tr") {
      if (idx === 1) return `Bu desen ${patternSummary ? "ile uyumlu olarak " : ""}${line}`;
      return `Önceki sinyalle bağlantılı şekilde ${line}`;
    }
    if (idx === 1) return `Consistent with that pattern, ${line}`;
    return `Connected to the previous signal, ${line}`;
  });
}

function buildCoreProblem(modelCoreProblem, gapSignals, langNorm) {
  if (modelCoreProblem && includesAnyEvidence(modelCoreProblem, gapSignals)) return modelCoreProblem;
  const top = gapSignals[0];
  if (!top) return "";
  const evidence = top.evidence_cv || top.issue;
  const dominantReason = top.explanation_code || "insufficient_signal";
  const dominantContext = top.context || "missing_context";
  if (langNorm === "tr") {
    return `"${evidence}" sinyali ${dominantContext} tarafında zayıf kaldığı için ${dominantReason} problemi yaratıyor.`;
  }
  return `"${evidence}" leaves ${dominantContext} weak, which triggers ${dominantReason}.`;
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
      line = `Başvuru yaparken "${evidence}" ifadesini kullanıyorsun ama ${reasonCode || context} için her role özel sinyal göstermiyorsun.`;
    }
    return toSingleSentence(line);
  }
  let line = `You likely keep "${evidence}" as-is across applications, without adapting it to the ${context} expectation of each role.`;
  if (!isBehaviorFocusedLine(line, langNorm) || isTooSimilar(line, coreProblem)) {
    line = `You keep applying with "${evidence}" unchanged, but you are not showing role-specific proof for ${reasonCode || context}.`;
  }
  return toSingleSentence(line);
}

function buildImpactStatement(modelImpactStatement, gapSignals, langNorm) {
  if (modelImpactStatement && includesAnyEvidence(modelImpactStatement, gapSignals)) return modelImpactStatement;
  const top = gapSignals[0];
  if (!top) return "";
  const risk = String(top.risk_level || "medium");
  const reasonCode = String(top.explanation_code || "insufficient_signal");
  const context = String(top.context || "missing_context");
  const evidence = String(top.evidence_cv || top.issue || "signal");
  if (langNorm === "tr") {
    if (risk === "high") {
      return `"${evidence}" nedeniyle recruiter ${reasonCode}/${context} sinyalini yüksek risk okuyup seni kısa listeden çıkarır.`;
    }
    if (risk === "low") {
      return `"${evidence}" bu haliyle kalırsa recruiter ${reasonCode} notunu düşer ve geri dönüş hızın azalır.`;
    }
    return `"${evidence}" nedeniyle recruiter ${reasonCode}/${context} sinyalini orta riskte tutup başvurunu beklemeye alır.`;
  }
  if (risk === "high") {
    return `Because of "${evidence}", recruiters read ${reasonCode}/${context} as high risk and drop you from shortlist.`;
  }
  if (risk === "low") {
    return `If "${evidence}" stays unchanged, recruiters flag ${reasonCode} and your callback speed drops.`;
  }
  return `Because of "${evidence}", recruiters keep ${reasonCode}/${context} at medium risk and delay decision.`;
}

function buildFirstAction(modelFirstAction, gapSignals, langNorm) {
  if (modelFirstAction && includesAnyEvidence(modelFirstAction, gapSignals)) return modelFirstAction;
  const top = gapSignals[0];
  if (!top) return "";
  const evidence = String(top.evidence_cv || top.issue || "").trim();
  if (!evidence) return "";
  if (langNorm === "tr") {
    return `CV’inde "${evidence}" kısmını şu şekilde yeniden yaz: "%18 dönüşüm artışı sağladım".`;
  }
  return `Rewrite "${evidence}" in your CV like this: "Drove an 18% conversion increase".`;
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
