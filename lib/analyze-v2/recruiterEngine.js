import { openrouterChat } from "./client.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, fallbackNoReasoning, userPromptLangFooter } from "./lang.js";

const MODEL = "anthropic/claude-3-haiku";

export async function runRecruiterEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const user = `${lens}

You are a senior in-house recruiter with 30 seconds per CV, hiring in the sector implied above. Think in reject/shortlist logic — not coaching. Sound like real screening pressure: who gets cut and why. No motivational framing.
Reference concrete CV details in every section (experience, project names, certifications, school, internship/company names).
Do not write generic phrases like "strong background" without naming the exact CV evidence.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "recruiter_verdict": "strong_yes" | "maybe" | "no",
  "reasoning": "<2-4 sentences: blunt, specific to THIS CV and JD — say what would make you bin it or what barely saves it>",
  "strengths": [<string>, max 6, only real signals — no filler praise],
  "weaknesses": [<string>, max 6, frame as why they lose to other applicants — e.g. "Filtered out because..." not "Could develop..."],
  "red_flags": [<string>, max 5, dealbreakers or credibility issues]
}${userPromptLangFooter(langNorm)}`;

  let content;
  try {
    content = await openrouterChat({
      model: MODEL,
      temperature: 0.2,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPromptWithLang(
            'Verdict must be exactly "strong_yes", "maybe", or "no". No fluff. JSON only. Be specific to THIS candidate\'s CV. Reference actual experiences, projects, certifications mentioned in the CV. Never give generic advice that could apply to anyone.',
            langNorm
          ),
        },
        { role: "user", content: user },
      ],
    });
  } catch {
    content = await openrouterChat({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: systemPromptWithLang(
            'Verdict must be exactly "strong_yes", "maybe", or "no". JSON only. Be specific to THIS candidate\'s CV. Reference actual experiences, projects, certifications mentioned in the CV. Never give generic advice that could apply to anyone.',
            langNorm
          ),
        },
        { role: "user", content: user },
      ],
    });
  }

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
