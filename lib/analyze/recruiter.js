import { groqChat } from "./client.js";
import { parseModelJson } from "./json.js";
import { normalizeAnalyzeLang } from "../analyze-v2/lang.js";
import { buildRecruiterSystemPrompt } from "../recruiterSystemPrompt.js";

const MODEL = "llama-3.3-70b-versatile";

export async function runRecruiterAnalysis(cvText, jobDescription, lang) {
  const langNorm = normalizeAnalyzeLang(lang);

  const systemPrompt = `${buildRecruiterSystemPrompt(langNorm)}

Return JSON only. hireDecision must be exactly YES, NO, or MAYBE. strengths, weaknesses, and explanation must obey the I/you rules above.`;

  const user = `Review this CV against the job description using the voice required in your system instructions.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON with this exact shape (no markdown):
{
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "hireDecision": "YES" | "NO" | "MAYBE",
  "explanation": "<short plain explanation, 2-4 sentences max>"
}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: user },
  ];

  let content;
  try {
    content = await groqChat({
      model: MODEL,
      temperature: 0.25,
      responseFormat: { type: "json_object" },
      langNorm,
      messages,
    });
  } catch {
    content = await groqChat({
      model: MODEL,
      temperature: 0.25,
      langNorm,
      messages,
    });
  }

  const parsed = parseModelJson(content);
  if (!parsed || typeof parsed !== "object") {
    return {
      strengths: [],
      weaknesses: [],
      hireDecision: "MAYBE",
      explanation: "Unable to parse recruiter response.",
    };
  }

  return {
    strengths: toStrArray(parsed.strengths).slice(0, 12),
    weaknesses: toStrArray(parsed.weaknesses).slice(0, 12),
    hireDecision: normalizeHire(parsed.hireDecision),
    explanation: String(parsed.explanation || parsed.shortExplanation || "").trim() || "No explanation provided.",
  };
}

function normalizeHire(v) {
  const s = String(v || "")
    .trim()
    .toUpperCase();
  if (s === "YES" || s === "NO" || s === "MAYBE") return s;
  if (s.includes("NO")) return "NO";
  if (s.includes("YES")) return "YES";
  return "MAYBE";
}

function toStrArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}
