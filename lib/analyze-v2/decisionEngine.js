import { callClaude } from "../claudeClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { criticalOutputLanguageInstruction, fallbackNoReasoning, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";
import { buildRecruiterSystemPrompt } from "../recruiterSystemPrompt.js";

export async function runDecisionEngine({
  cvText,
  jobDescription,
  ats,
  recruiter,
  gaps,
  roleFit,
  sector,
  lang: langNorm = "en",
}) {
  const lens = getSectorPromptBlock(sector);
  const bundle = JSON.stringify({
    ats,
    recruiter,
    gaps,
    roleFit,
  });

  const langInstruction = langNorm === "tr" ? MANDATORY_TURKISH_AI_OUTPUT : "Respond in English.";
  const basePrompt = `${lens}

You are the final hiring committee for ONE application under the sector lens above. Synthesize the JSON inputs into a single career decision for the applicant — speak to them as "you". The verdict must reflect how they fare against THIS sector's bar, not a generic CV rubric.
Your reasoning must cite at least 2 concrete CV details (experience/project/certification/achievement) about them — paraphrased in your own words.
Never quote raw CV bullet points in the reasoning field. Summarize and interpret — do not copy-paste CV text.
If evidence is missing, explicitly say "CV'de belirtilmemiş" and do not invent.
Focus ONLY on final verdict + one highest-impact next step.
Maximum output: reasoning max 4 short sentences; what_to_fix_first exactly 1 item.
Turkish mode rule: Yanıtını Türkçe ver, İngilizce kelime karıştırma.
Do not repeat full recruiter narrative, deep gap list, or keyword table from other sections.

Original CV (excerpt if long — decide from data below):
${cvText.slice(0, 6000)}

Job description (excerpt):
${jobDescription.slice(0, 4000)}

Prior engine outputs (source of truth):
${bundle}

Return ONLY valid JSON:
{
  "final_alignment_score": <number 0-100, must reflect ATS + recruiter + gaps — not optimism>,
  "final_verdict": "apply_now" | "apply_with_risk" | "do_not_apply",
  "confidence": <number 0-100>,
  "reasoning": "<3-5 short sentences: blunt recruiter voice — uncomfortable truths, zero generic coaching, name the filter; paraphrase only — no raw CV bullet copy-paste>",
  "what_to_fix_first": [<string>, exactly ONE string: the single highest-impact fix, imperative, time-bound when possible e.g. "Learn X within 7 days before applying again"]
}

Rules:
- do_not_apply if recruiter_verdict is "no" OR multiple high-impact rejection reasons clearly disqualify.
- apply_now only if ATS and recruiter both signal strong match.
- apply_with_risk for everything else.
- what_to_fix_first must contain exactly one item — the one move that moves the needle most.

ACTION PLAN CONSTRAINTS (what_to_fix_first):
NEVER suggest: changing university degree or major, going back to school, or multi-year new qualifications (e.g. "pursue a relevant engineering degree").
ONLY suggest actions completable in roughly 90 days or less: learn a specific skill, build a specific project, earn a specific certification, rewrite a specific CV section.
If the hard blocker is a fundamental credential (e.g. wrong degree vs JD requirement) that cannot be fixed short-term, say so plainly — e.g. that this role requires a specific degree you do not have, and you should focus on roles that value your actual background instead of "get a new degree".${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  const systemPrompt = `${buildRecruiterSystemPrompt(langNorm)}

${criticalOutputLanguageInstruction(langNorm)}

You are the final hiring committee: give the final screen verdict directly to the applicant. Explain exactly why you will or will not pass the initial screen for this role.
Be specific — reference their CV and the job requirements.
Follow the response language from the CRITICAL instruction above (UI language), not the JD's language.

what_to_fix_first must never recommend changing degree, returning to university, or multi-year qualifications. Only short-horizon, actionable fixes; if the gap is a hard degree mismatch, direct them toward better-fit roles instead of "get a new degree".

You output the final apply/do-not-apply decision. Output ONLY valid JSON as specified in the user message — no markdown fences, no text before or after the JSON. Sound like a tired in-house recruiter: direct, slightly harsh, no sugar-coating or 'you got this' language. Be specific to their CV. Reference actual experiences, projects, certifications they listed — in reasoning, summarize in your own words; never paste raw CV lines. Never give generic advice that could apply to anyone. Do not repeat information from other sections.`;

  const content = await callClaude(user, systemPrompt, 1024, {
    langNorm,
    recruiterVoice: true,
  });

  const p = parseModelJson(content) || {};
  const verdict = normalizeVerdict(p.final_verdict);
  let score = clamp(p.final_alignment_score, 0, 100);
  score = reconcileScore(score, verdict, ats, recruiter);

  return {
    final_alignment_score: score,
    final_verdict: verdict,
    confidence: clamp(p.confidence, 0, 100),
    reasoning: String(p.reasoning || "").trim() || fallbackNoReasoning(langNorm),
    what_to_fix_first: takeStrings(p.what_to_fix_first).slice(0, 1),
  };
}

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

function takeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
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
