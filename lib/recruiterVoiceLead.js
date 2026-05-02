import { FIRST_PERSON_RULE } from "./recruiterSystemPrompt.js";

/**
 * Prepended to every recruiter-style AI prompt (Claude v2 paths).
 * Must be the first substantive instruction the model sees.
 */
export const RECRUITER_SPEAK_DIRECT_LEAD = `${FIRST_PERSON_RULE}

SPEAK DIRECTLY TO THE CANDIDATE.
Use 'I' and 'you'.
Never 'the candidate'.
Example output:
'I see McKinsey Forward — strong signal.
But I'm scanning for pricing experience
and it's not here. You have the analytical
mindset but this role needs proof of
working with actual pricing data.'`;

/**
 * Set HIREFIT_LOG_RECRUITER_PROMPT=1 to print full recruiter-related prompts
 * (analyze-v2 recruiter engines).
 */
export function logRecruiterAiPrompt(label, text) {
  if (process.env.HIREFIT_LOG_RECRUITER_PROMPT !== "1") return;
  const body = String(text ?? "");
  const block = `\n[HIREFIT_LOG_RECRUITER_PROMPT] ${label}\n${"=".repeat(72)}\n${body}\n${"=".repeat(72)}\n`;
  try {
    if (typeof process?.stderr?.write === "function") process.stderr.write(block);
  } catch {
    /* ignore logging failures */
  }
}
