import { buildRecruiterSystemPrompt } from "./recruiterSystemPrompt.js";

export const MASTER_SYSTEM = `
You are part of a multi-AI career decision system.
Be direct, realistic, and concise.
Return ONLY valid JSON. No extra text.
`;

export const ATS_PROMPT = (cv, jd) => `
Analyze the CV against the job description.

Return ONLY JSON:
{
  "score": number,
  "matched_skills": [string],
  "missing_skills": [string],
  "keywords": [string],
  "summary": "short factual summary"
}

CV:
${cv}

JD:
${jd}
`;

/**
 * Chat messages for a minimal recruiter screen (7-second reject/maybe/consider).
 * @param {string} cv
 * @param {string} jd
 * @param {"en"|"tr"} [langNorm]
 */
export function recruiterPromptMessages(cv, jd, langNorm = "en") {
  return [
    {
      role: "system",
      content: `${buildRecruiterSystemPrompt(langNorm)}
You have 7 seconds. Return ONLY JSON as in the user message. decision, reason, insight, biggest_mistake: I/you only.`,
    },
    {
      role: "user",
      content: `Would you reject this CV for this role?

CV:
${cv}

JD:
${jd}

Return ONLY JSON:
{
  "decision": "reject" | "maybe" | "consider",
  "confidence": number,
  "biggest_mistake": "short, brutal",
  "reason": "1-2 sentences, I/you only",
  "insight": "raw recruiter thought, I/you only"
}`,
    },
  ];
}

export const FIX_PROMPT = (cv, jd) => `
Improve this CV for the job description.

Return ONLY JSON:
{
  "top_fixes": [string],
  "before_after": [
    { "before": "...", "after": "..." }
  ],
  "quick_action": "one immediate fix"
}

CV:
${cv}

JD:
${jd}
`;