import { callClaude, CLAUDE_MODEL_OPUS } from "../claudeClient.js";
import { parseModelJson } from "./json.js";
import { buildRecruiterSystemPrompt } from "../recruiterSystemPrompt.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { RECRUITER_SECTOR_PERSONAS } from "./recruiterPersonas.js";
import { fallbackNoReasoning, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";

const FIRST_PERSON_RULE = `ABSOLUTE RULE:
Speak directly to the candidate.
Use "I" and "you".
NEVER write "The candidate" or
"This applicant".
WRONG: "The candidate has experience..."
RIGHT: "I see your McKinsey Forward —
strong signal. But I'm looking for
pricing experience and it's just not here."
`;

export async function runRecruiterEngine(
  cvText,
  jobDescription,
  sector,
  langNorm = "en",
  careerContext = null
) {
  const lens = getSectorPromptBlock(sector, careerContext);
  const langInstruction = langNorm === "tr" ? MANDATORY_TURKISH_AI_OUTPUT : "Respond in English.";
  const basePrompt = `${lens}

You have ~30 seconds per CV. Think reject/shortlist — not coaching. Real screening pressure: who gets cut and why. No motivational framing, no cheerleading, no "great candidate" padding.
If the user-selected sector lens above conflicts with what you infer from the job description, prioritize the job description and the sector personas (tone, priorities) from your system instructions.

Reference concrete CV details everywhere (experience, project names, certifications, school, company names). Quote CV lines directly where possible; do not write generic praise.
If a detail is missing, explicitly say "CV'de belirtilmemiş" (TR) or "Not stated on the CV" (EN) and do not invent.
FORBIDDEN in strengths: standalone fluff such as "strong communicator", "passionate", "team player", "detail-oriented", "fast learner", "great attitude", "impressive background" without naming a CV anchor (company, tool, metric, project title, scope).
Every strength must cite one concrete CV anchor; if you cannot, omit that strength.
Weaknesses must name the exact JD vs CV mismatch (tool, domain, seniority, proof type). At least two weaknesses should read like a real screen-out reason, not soft coaching.
If verdict is maybe or strong_yes, still include at least one harsh line about what would make you hesitate vs other applicants.
Focus ONLY on human/recruiter perspective (credibility, narrative, trust signals, hiring instinct).
Maximum list sizes: strengths max 4, weaknesses max 4, red_flags max 3. Each list item should be first-person where natural (e.g. "I'm not seeing quantified impact on X").
Turkish mode rule: Yanıtını Türkçe ver, İngilizce kelime karıştırma.
Do not repeat technical gap tables, keyword matrices, or step-by-step action plans from other sections.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "recruiter_verdict": "strong_yes" | "maybe" | "no",
  "reasoning": "<one paragraph, recruiter-like internal thought after 15-second scan>",
  "first_perception": "<single short sentence>",
  "internal_monologue": "<single paragraph, subjective and human>",
  "core_concern": "<single concise line: the main blocker>",
  "persuasion_tip": "<single concise action tip>",
  "signal_tags": ["<short tag>", "<short tag>", "<short tag>"],
  "strengths": [<string>, max 4],
  "weaknesses": [<string>, max 4],
  "red_flags": [<string>, max 3]
}${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  let systemPrompt = `${buildRecruiterSystemPrompt(langNorm, { includeFirstPersonLead: false })}

${RECRUITER_SECTOR_PERSONAS}

Output: Return ONLY valid JSON exactly as in the user message — no markdown fences, no text outside JSON. recruiter_verdict must be exactly "strong_yes", "maybe", or "no". Every natural-language string must be in the selected language only (no mixed TR/EN). Keep first_perception/core_concern/persuasion_tip concise. signal_tags max 4.`;
  systemPrompt = `${FIRST_PERSON_RULE}\n\n${systemPrompt}`;

  const content = await callClaude(user, systemPrompt, 1400, {
    langNorm,
    recruiterVoice: true,
    model: CLAUDE_MODEL_OPUS,
  });

  const p = parseModelJson(content) || {};
  const v = String(p.recruiter_verdict || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  let verdict = "maybe";
  if (v === "strong_yes" || v === "yes" || v === "strongyes") verdict = "strong_yes";
  else if (v === "no" || v === "reject") verdict = "no";

  const structured = buildStructuredRecruiterAnalysis({
    parsed: p,
    cvText,
    jobDescription,
    langNorm,
    modelVerdict: verdict,
  });
  const reasoningFinal = ensureRecruiterParagraph(p.reasoning, structured, langNorm);

  return {
    recruiter_verdict: verdict,
    reasoning: reasoningFinal,
    strengths: takeStrings(p.strengths).slice(0, 6),
    weaknesses: takeStrings(p.weaknesses).slice(0, 6),
    red_flags: takeStrings(p.red_flags).slice(0, 5),
    structured_analysis: structured,
  };
}

function takeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function buildStructuredRecruiterAnalysis({ parsed, cvText, jobDescription, langNorm, modelVerdict }) {
  const strengths = takeStrings(parsed?.strengths).slice(0, 3);
  const weaknesses = takeStrings(parsed?.weaknesses).slice(0, 3);
  const strongestSignal = strengths[0] || pickCvAnchor(cvText) || (langNorm === "tr" ? "Profilinde role yakin bir sinyal var." : "There is at least one role-relevant signal in your profile.");
  const rolePerception = inferRolePerception(cvText, jobDescription, langNorm);
  const uncertainty = weaknesses[0] || (langNorm === "tr"
    ? "Role ozgu cikti ve kapsam sinyalleri yeterince gorunur degil."
    : "Role-specific output and ownership signals are not explicit enough.");
  const firstPerception = pickNonEmpty(
    String(parsed?.first_perception || "").trim(),
    langNorm === "tr"
      ? shortPerceptionFromRole(rolePerception)
      : shortPerceptionFromRole(rolePerception)
  );
  const internalMonologue = pickNonEmpty(
    String(parsed?.internal_monologue || "").trim(),
    buildInternalMonologue({ strongestSignal, rolePerception, uncertainty, langNorm })
  );
  const coreConcern = pickNonEmpty(
    String(parsed?.core_concern || "").trim(),
    langNorm === "tr"
      ? `Beni durduran sey: ${uncertainty}`
      : `What pauses me most: ${uncertainty}`
  );
  const persuasionTip = pickNonEmpty(
    String(parsed?.persuasion_tip || "").trim(),
    langNorm === "tr"
      ? "Role ozel execution kanitini tek satirda daha net gormem lazim."
      : "I need one clearer role-specific execution proof line."
  );
  const signalTags = normalizeSignalTags(parsed?.signal_tags, langNorm, strongestSignal, uncertainty, rolePerception).slice(0, 4);

  return {
    first_perception: firstPerception,
    internal_monologue: internalMonologue,
    core_concern: coreConcern,
    persuasion_tip: persuasionTip,
    signal_tags: signalTags,
    strengths,
    weaknesses,
    role_perception: rolePerception,
    uncertainty,
    recruiter_leaning: normalizeLeaning(modelVerdict, langNorm),
    strongest_signal: strongestSignal,
  };
}

function inferRolePerception(cvText, jobDescription, langNorm) {
  const cv = String(cvText || "").toLowerCase();
  const jd = String(jobDescription || "").toLowerCase();
  const productSignal = /(product|growth|ux|deney|funnel|activation)/i.test(cv);
  const opsJd = /(operations|operasyon|seo|content|içerik|execution|yürütme)/i.test(jd);
  if (langNorm === "tr") {
    if (productSignal && opsJd) {
      return "Seni daha cok product/growth tarafinda konumluyorum; rol ise operasyonel execution tarafina daha yakin.";
    }
    return "Seni role yakin goruyorum ama pozisyonun bekledigi net sinyal yogunlugu henuz tam degil.";
  }
  if (productSignal && opsJd) {
    return "I currently read you closer to product/growth, while this role leans more toward operational execution.";
  }
  return "I can see relevant overlap, but the signal density for this specific role is still incomplete.";
}

function ensureRecruiterParagraph(rawReasoning, structured, langNorm) {
  const direct = String(rawReasoning || "").trim();
  if (direct.length >= 40) return direct;
  const mono = String(structured?.internal_monologue || "").trim();
  if (mono.length >= 40) return mono;
  return fallbackNoReasoning(langNorm);
}

function shortPerceptionFromRole(rolePerception) {
  const r = String(rolePerception || "").trim();
  if (!r) return "";
  const cut = r.split(/(?<=[.!?])\s+/).filter(Boolean)[0];
  return String(cut || r).trim();
}

function buildInternalMonologue({ strongestSignal, rolePerception, uncertainty, langNorm }) {
  if (langNorm === "tr") {
    return `${strongestSignal} bunu pozitife yazdiriyor. Ama ${rolePerception.toLowerCase()} ve ${uncertainty.toLowerCase()} tarafi beni yavaslatiyor; shortlist'e alirim ama simdilik maybe tarafindayim.`;
  }
  return `${strongestSignal} is a positive signal. But ${rolePerception.toLowerCase()} and ${uncertainty.toLowerCase()} still slow me down; I might shortlist, but for now I am in maybe mode.`;
}

function normalizeSignalTags(raw, langNorm, strongestSignal, uncertainty, rolePerception) {
  const tr = langNorm === "tr";
  const fromModel = Array.isArray(raw)
    ? raw.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  if (fromModel.length) return [...new Set(fromModel)].slice(0, 4);
  const tags = [];
  const all = `${strongestSignal} ${uncertainty} ${rolePerception}`.toLowerCase();
  if (/product|growth|urun/.test(all)) tags.push(tr ? "Product sinyali" : "Product signal");
  if (/seo|content|icerik/.test(all)) tags.push(tr ? "SEO sorusu" : "SEO question");
  if (/kpi|metric|metrik|conversion|donusum/.test(all)) tags.push(tr ? "KPI izi" : "KPI trace");
  if (/uncertain|tereddut|soru/.test(all)) tags.push(tr ? "Soru isareti" : "Question mark");
  if (!tags.length) tags.push(tr ? "Role-fit sinyali" : "Role-fit signal");
  return [...new Set(tags)].slice(0, 4);
}

function pickNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

function normalizeLeaning(modelVerdict, langNorm) {
  if (modelVerdict === "strong_yes") return langNorm === "tr" ? "shortlist" : "shortlist";
  if (modelVerdict === "no") return langNorm === "tr" ? "eleme egilimi" : "reject-leaning";
  return langNorm === "tr" ? "temkinli olumlu" : "cautiously positive";
}

function pickCvAnchor(cvText) {
  const lines = String(cvText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.find((l) => /(built|launched|led|founded|managed|improved|kur|gelistir|yonet|optimiz|uygul)/i.test(l)) || lines[0] || "";
}
