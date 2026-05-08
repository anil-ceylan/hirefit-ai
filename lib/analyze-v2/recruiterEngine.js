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
  "reasoning": "<4-5 sentences, I/you only, never 'the candidate' — blunt, specific to THIS CV and JD — end with a clear gut decision (shortlist / maybe / bin)>",
  "strengths": [<string>, max 4, I/you recruiter voice, each must tie to a named CV fact — zero generic praise],
  "weaknesses": [<string>, max 4, I/you — blunt JD vs CV gaps, e.g. "I'm binning this because..." / "Geçemiyorum çünkü..."],
  "red_flags": [<string>, max 3, dealbreakers or credibility issues, first person where natural]
}${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  let systemPrompt = `${buildRecruiterSystemPrompt(langNorm, { includeFirstPersonLead: false })}

${RECRUITER_SECTOR_PERSONAS}

Output: Return ONLY valid JSON exactly as in the user message — no markdown fences, no text outside JSON. recruiter_verdict must be exactly "strong_yes", "maybe", or "no". Every natural-language string (reasoning, strengths, weaknesses, red_flags) must follow the I/you rules in the system prompt above. Be specific to this CV and JD; never generic filler. Strengths that are only praise with no named CV fact are invalid — rewrite or omit them.`;
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
  const narratedFallback = narrateRecruiterReasoning(structured, langNorm);
  const reasoningFinal = String(p.reasoning || "").trim() || narratedFallback || fallbackNoReasoning(langNorm);

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
  const strongestSignal = strengths[0] || pickCvAnchor(cvText) || (langNorm === "tr" ? "Profilinde role yakın bir sinyal var." : "There is at least one role-relevant signal in your profile.");
  const rolePerception = inferRolePerception(cvText, jobDescription, langNorm);
  const uncertainty = weaknesses[0] || (langNorm === "tr"
    ? "Role özgü çıktı ve kapsam sinyalleri yeterince görünür değil."
    : "Role-specific output and ownership signals are not explicit enough.");
  const recruiterLeaning = normalizeLeaning(modelVerdict, langNorm);
  const decisionTension = buildDecisionTension({ strongestSignal, uncertainty, langNorm });

  return {
    strengths,
    weaknesses,
    role_perception: rolePerception,
    uncertainty,
    recruiter_leaning: recruiterLeaning,
    decision_tension: decisionTension,
    strongest_signal: strongestSignal,
  };
}

function narrateRecruiterReasoning(structured, langNorm) {
  const strongest = String(structured?.strongest_signal || "").trim();
  const rolePerception = String(structured?.role_perception || "").trim();
  const uncertainty = String(structured?.uncertainty || "").trim();
  const tension = String(structured?.decision_tension || "").trim();
  if (langNorm === "tr") {
    const s1 = strongest || "Profilinde role temas eden bir sinyal görüyorum.";
    const s2 = rolePerception || "Ama seni role tam oturmuş bir profil olarak konumlamak şu aşamada zor.";
    const s3 = uncertainty || "Role özel sinyaller yeterince net olmadığı için karar anında tereddüt oluşuyor.";
    const s4 = tension || "Bu nedenle seni tamamen elemem ama kısa liste kararında alt sırada tutabilirim.";
    return `${s1} ${s2} ${s3} ${s4}`.replace(/\s+/g, " ").trim();
  }
  const s1 = strongest || "I can see at least one signal that aligns with the role.";
  const s2 = rolePerception || "Still, I cannot position you as a fully locked-in fit yet.";
  const s3 = uncertainty || "Because role-specific proof is not explicit enough, hesitation remains at decision time.";
  const s4 = tension || "So I may not reject outright, but I would likely place you lower in the shortlist.";
  return `${s1} ${s2} ${s3} ${s4}`.replace(/\s+/g, " ").trim();
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

function normalizeLeaning(modelVerdict, langNorm) {
  if (modelVerdict === "strong_yes") return langNorm === "tr" ? "shortlist" : "shortlist";
  if (modelVerdict === "no") return langNorm === "tr" ? "eleme egilimi" : "reject-leaning";
  return langNorm === "tr" ? "temkinli olumlu" : "cautiously positive";
}

function buildDecisionTension({ strongestSignal, uncertainty, langNorm }) {
  if (langNorm === "tr") {
    return `Guclu sinyal: ${strongestSignal}. Gerilim noktasi: ${uncertainty}`;
  }
  return `Strongest signal: ${strongestSignal}. Decision tension: ${uncertainty}`;
}

function pickCvAnchor(cvText) {
  const lines = String(cvText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.find((l) => /(built|launched|led|founded|managed|improved|kur|gelistir|yonet|optimiz|uygul)/i.test(l)) || lines[0] || "";
}
