import { anthropicChat } from "./anthropicClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, fallbackNoReasoning, userPromptLangFooter } from "./lang.js";

const MODEL = "llama-3.1-70b-versatile";

export async function runRecruiterEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const langInstruction = langNorm === "tr"
    ? "SEN TURKCE KONUSAN BIR UZMANSIN. BUTUN CIKTILARIN TURKCE OLMALI. INGILIZCE YAZMA. CV veya is ilani Ingilizce olsa bile sen Turkce yaz."
    : "Respond in English.";
  const basePrompt = `${lens}

You are a senior in-house recruiter with 30 seconds per CV, hiring in the sector implied above. Think in reject/shortlist logic — not coaching. Sound like real screening pressure: who gets cut and why. No motivational framing.
Reference concrete CV details in every section (experience, project names, certifications, school, internship/company names).
Quote CV lines directly where possible; do not write generic praise.
If a detail is missing, explicitly say "CV'de belirtilmemiş" and do not invent.
Do not write generic phrases like "strong background" without naming the exact CV evidence.
Focus ONLY on human/recruiter perspective (credibility, narrative, trust signals, hiring instinct).
Maximum output: strengths max 4, weaknesses max 4, red_flags max 3.
Turkish mode rule: Yanıtını Türkçe ver, İngilizce kelime karıştırma.
Do not repeat technical gap tables, keyword matrices, or step-by-step action plans from other sections.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "recruiter_verdict": "strong_yes" | "maybe" | "no",
  "reasoning": "<1-2 sentences max: blunt, specific to THIS CV and JD — say what would make you bin it or what barely saves it>",
  "strengths": [<string>, max 6, only real signals — no filler praise],
  "weaknesses": [<string>, max 6, frame as why they lose to other applicants — e.g. "Filtered out because..." not "Could develop..."],
  "red_flags": [<string>, max 5, dealbreakers or credibility issues]
}${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  const content = await anthropicChat({
    model: MODEL,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPromptWithLang(
          'Verdict must be exactly "strong_yes", "maybe", or "no". No fluff. JSON only. Be specific to THIS candidate\'s CV. Reference actual experiences, projects, certifications mentioned in the CV. Never give generic advice that could apply to anyone. Do not repeat information from other sections.',
          langNorm
        ),
      },
      { role: "user", content: user },
    ],
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
