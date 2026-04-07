import { openrouterChat } from "./client.js";
import { parseModelJson } from "./json.js";

const MODEL = "openai/gpt-4o-mini";

export async function runAtsAnalysis(cvText, jobDescription) {
  const user = `You are an Applicant Tracking System (ATS). Score how well the CV matches the job description for keyword and requirement coverage.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON with this exact shape (no markdown):
{
  "alignmentScore": <number 0-100>,
  "matchedKeywords": [<string>],
  "missingKeywords": [<string>]
}`;

  const content = await openrouterChat({
    model: MODEL,
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You simulate ATS keyword matching. Be concise. Output JSON only.",
      },
      { role: "user", content: user },
    ],
  });

  const parsed = parseModelJson(content);
  if (!parsed || typeof parsed !== "object") {
    return {
      alignmentScore: 50,
      matchedKeywords: [],
      missingKeywords: [],
    };
  }

  return {
    alignmentScore: clampScore(parsed.alignmentScore ?? parsed.score),
    matchedKeywords: toStrArray(parsed.matchedKeywords ?? parsed.matched_keywords),
    missingKeywords: toStrArray(parsed.missingKeywords ?? parsed.missing_keywords),
  };
}

function clampScore(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 50;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function toStrArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
}
