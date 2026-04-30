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

  return {
    recruiter_verdict: verdict,
    reasoning: String(p.reasoning || "").trim() || fallbackNoReasoning(langNorm),
    strengths: takeStrings(p.strengths).slice(0, 6),
    weaknesses: takeStrings(p.weaknesses).slice(0, 6),
    red_flags: takeStrings(p.red_flags).slice(0, 5),
  };
}

function takeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}
