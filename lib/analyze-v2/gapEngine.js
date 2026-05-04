import { callClaude, CLAUDE_MODEL_SONNET } from "../claudeClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, fallbackBiggestGap, MANDATORY_TURKISH_AI_OUTPUT, userPromptLangFooter } from "./lang.js";

const MODEL = CLAUDE_MODEL_SONNET;

export async function runGapEngine(cvText, jobDescription, sector, langNorm = "en", careerContext = null) {
  const lens = getSectorPromptBlock(sector, careerContext);
  const langInstruction = langNorm === "tr" ? MANDATORY_TURKISH_AI_OUTPUT : "Respond in English.";
  const basePrompt = `${lens}

Identify REAL rejection gaps for THIS job under THIS sector's hiring bar.
Focus ONLY on structured extraction; no coaching and no narrative sentences.
No natural-language explanations. No direct address. No prose.
Maximum output: rejection_reasons max 6, biggest_gap max 1 line.
Do not repeat recruiter commentary, action-plan sequencing, or keyword-only lists from other sections.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "rejection_reasons": [
    {
      "issue": "<snake_case_gap_tag>",
      "impact": "<snake_case_impact_tag>",
      "reason_code": "<snake_case_reason_code>",
      "explanation_code": "<snake_case_explanation_code>",
      "context": "<snake_case_context_tag>",
      "risk_level": "high" | "medium" | "low",
      "signal_strength": "none" | "weak" | "partial" | "strong",
      "evidence_cv": "<exact quote or close paraphrase from CV — max 15 words>",
      "jd_requirement": "<exact requirement phrase from JD — max 10 words>"
    }
  ],
  "biggest_gap": "<snake_case_gap_tag>"
}

evidence_cv and jd_requirement must contain real text from the inputs above — not tags, not codes.

evidence_cv must be natural language — never snake_case.
Wrong: "bulut_ag_deneyimi_yok"
Right: "CV'de bulut teknolojisi deneyimi belirtilmemiş"

Use at least 3 rejection_reasons when problems exist; if genuinely strong fit, still list 1-2 risks.${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  const system = systemPromptWithLang(
    "You extract screening gaps as mostly structured tags, but evidence_cv and jd_requirement must be real quoted/paraphrased text from CV/JD. Return valid JSON only. No narrative explanation text.",
    langNorm
  );
  const content = await callClaude(user, system, 1200, { langNorm, model: MODEL });

  const p = parseModelJson(content) || {};
  const raw = Array.isArray(p.rejection_reasons) ? p.rejection_reasons : [];
  const rejection_reasons = raw
    .map((r) => ({
      issue: toStructuredTag(r?.issue),
      impact: toStructuredTag(r?.impact) || "unknown_impact",
      reason_code: toStructuredTag(r?.reason_code) || "insufficient_signal",
      explanation_code: toStructuredTag(r?.explanation_code) || "insufficient_signal_context",
      context: toStructuredTag(r?.context) || "missing_context_tag",
      risk_level: normalizeImpact(r?.risk_level ?? r?.impact),
      signal_strength: normalizeSignalStrength(r?.signal_strength),
      evidence_cv: normalizeNaturalSnippet(r?.evidence_cv, 15) || "CV evidence not found",
      jd_requirement: normalizeNaturalSnippet(r?.jd_requirement, 10) || "JD requirement not found",
    }))
    .filter((r) => r.issue)
    .slice(0, 12);

  return {
    rejection_reasons,
    biggest_gap: toStructuredTag(p.biggest_gap) || fallbackBiggestGap(langNorm),
  };
}

function normalizeImpact(v) {
  const s = String(v || "").toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function normalizeSignalStrength(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "none" || s === "weak" || s === "partial" || s === "strong") return s;
  return "weak";
}

function toStructuredTag(v) {
  const raw = String(v || "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/[^a-z0-9_\s-]/g, " ")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function normalizeNaturalSnippet(v, maxWords) {
  const text = String(v || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const words = text.split(" ").filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}
