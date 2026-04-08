import { groqChat } from "./client.js";
import { parseModelJson } from "./json.js";

const MODEL = "llama-3.3-70b-versatile";

export async function runFixAnalysis(cvText, jobDescription) {
  const user = `Improve this CV to better match the job. Propose concrete rewrites and suggestions. Do not invent employers, dates, or degrees.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON with this exact shape (no markdown):
{
  "rewrittenBulletPoints": [<string>, ...],
  "improvementSuggestions": [<string>, ...]
}`;

  const content = await groqChat({
    model: MODEL,
    temperature: 0.3,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a senior CV editor. Output JSON only. Bullets should be ready to paste into a CV.",
      },
      { role: "user", content: user },
    ],
  });

  const parsed = parseModelJson(content);
  if (!parsed || typeof parsed !== "object") {
    return { rewrittenBulletPoints: [], improvementSuggestions: [] };
  }

  return {
    rewrittenBulletPoints: toStrArray(
      parsed.rewrittenBulletPoints ?? parsed.rewritten_bullet_points ?? parsed.bullets
    ).slice(0, 20),
    improvementSuggestions: toStrArray(
      parsed.improvementSuggestions ?? parsed.improvement_suggestions ?? parsed.suggestions
    ).slice(0, 20),
  };
}

function toStrArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}
