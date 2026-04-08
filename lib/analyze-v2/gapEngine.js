import { openaiChat } from "./openaiClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, fallbackBiggestGap, userPromptLangFooter } from "./lang.js";

const MODEL = "gpt-4o";

export async function runGapEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const langInstruction = langNorm === "tr"
    ? "SEN TURKCE KONUSAN BIR UZMANSIN. BUTUN CIKTILARIN TURKCE OLMALI. INGILIZCE YAZMA. CV veya is ilani Ingilizce olsa bile sen Turkce yaz."
    : "Respond in English.";
  const basePrompt = `${lens}

Identify REAL reasons this candidate would be rejected or deprioritized for THIS job under THIS sector's hiring bar — not interview tips.
Map each gap to a specific JD requirement and then to the closest CV evidence.
Quote CV evidence directly; do not use generic wording.
If evidence is missing, explicitly write "CV'de belirtilmemiş" and do not invent.
Format reasoning like: "JD asks for X; your CV shows Y; missing Z causes rejection risk."
List actionable deficiencies (specific tools, depth, domain context, scale, metrics), not broad categories.
Focus ONLY on technical/professional gaps and rejection reasons.
Maximum output: rejection_reasons max 6, biggest_gap max 1 line.
Turkish mode rule: Yanıtını Türkçe ver, İngilizce kelime karıştırma.
Do not repeat recruiter-emotion commentary, action-plan sequencing, or keyword-only lists from other sections.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "rejection_reasons": [
    { "issue": "<specific, harsh recruiter phrasing — e.g. why ATS or human screen drops them>", "impact": "high" | "medium" | "low", "explanation": "<one sentence: why they get filtered — use 'you' where natural, no softening>" }
  ],
  "biggest_gap": "<one punchy line: the main reason they are being rejected for this role>"
}

Style: direct, evidence-first, technical. No recruiter emotion language.
No generic advice — say screening failure (e.g. "Would fail keyword screen — no X", "Profile not competitive for this level yet"). Avoid softeners ("could", "might consider").

Use at least 3 rejection_reasons when problems exist; if genuinely strong fit, still list 1-2 risks.${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  const content = await openaiChat({
    model: MODEL,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPromptWithLang(
          "You explain why hiring managers pass on this CV for this job — concrete, harsh, filter-level reasons only. JSON only. No therapist tone. Be specific to THIS candidate's CV. Reference actual experiences, projects, certifications mentioned in the CV. Never give generic advice that could apply to anyone. Do not repeat information from other sections.",
          langNorm
        ),
      },
      { role: "user", content: user },
    ],
  });

  const p = parseModelJson(content) || {};
  const raw = Array.isArray(p.rejection_reasons) ? p.rejection_reasons : [];
  const rejection_reasons = raw
    .map((r) => ({
      issue: String(r?.issue || "").trim(),
      impact: normalizeImpact(r?.impact),
      explanation: String(r?.explanation || "").trim(),
    }))
    .filter((r) => r.issue)
    .slice(0, 12);

  return {
    rejection_reasons,
    biggest_gap: String(p.biggest_gap || "").trim() || fallbackBiggestGap(langNorm),
  };
}

function normalizeImpact(v) {
  const s = String(v || "").toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}
