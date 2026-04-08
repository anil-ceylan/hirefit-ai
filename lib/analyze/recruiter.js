import { groqChat } from "./client.js";
import { parseModelJson } from "./json.js";

const MODEL = "llama-3.1-70b-versatile";

export async function runRecruiterAnalysis(cvText, jobDescription) {
  const user = `You are an experienced in-house recruiter reviewing this CV for the role below.

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

  let content;
  try {
    content = await groqChat({
      model: MODEL,
      temperature: 0.25,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You give direct recruiter-style feedback. hireDecision must be exactly YES, NO, or MAYBE. JSON only.",
        },
        { role: "user", content: user },
      ],
    });
  } catch {
    content = await groqChat({
      model: MODEL,
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content:
            "You give direct recruiter-style feedback. hireDecision must be exactly YES, NO, or MAYBE. JSON only.",
        },
        { role: "user", content: user },
      ],
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
