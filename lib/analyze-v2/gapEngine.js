import { openrouterChat } from "./client.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, fallbackBiggestGap, userPromptLangFooter } from "./lang.js";

const MODEL = "openai/gpt-4o-mini";

export async function runGapEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const user = `${lens}

Identify REAL reasons this candidate would be rejected or deprioritized for THIS job under THIS sector's hiring bar — not interview tips.

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

Style: direct, uncomfortable, like a recruiter explaining to a colleague why this CV is a no. No generic advice — say screening failure (e.g. "Would fail keyword screen — no X", "Profile not competitive for this level yet"). Avoid softeners ("could", "might consider").

Use at least 3 rejection_reasons when problems exist; if genuinely strong fit, still list 1-2 risks.${userPromptLangFooter(langNorm)}`;

  const content = await openrouterChat({
    model: MODEL,
    temperature: 0.18,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPromptWithLang(
          "You explain why hiring managers pass on this CV for this job — concrete, harsh, filter-level reasons only. JSON only. No therapist tone.",
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
