/* eslint-env node */
import Anthropic from "@anthropic-ai/sdk";
import {
  MANDATORY_TURKISH_AI_OUTPUT,
  normalizeAnalyzeLang,
  requiredResponseLanguageDirective,
  userPromptLangFooter,
} from "./analyze-v2/lang.js";
import { logPromptBeingSent } from "./aiPromptLog.js";

export const CLAUDE_MODEL_SONNET = process.env.ANTHROPIC_SONNET_MODEL || "claude-sonnet-4-6";
export const CLAUDE_MODEL_OPUS = process.env.ANTHROPIC_OPUS_MODEL || "claude-opus-4-1";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || CLAUDE_MODEL_SONNET;

/** Prepended to every Claude system prompt (recruiter, decision, any future callers). */
const CLAUDE_CANDIDATE_DIRECT_ADDRESS_RULE = `ABSOLUTE RULE - CANNOT BE BROKEN:
You are speaking directly TO the candidate.
Use "you" and "I" — never "the candidate".

WRONG: "The candidate lacks experience..."
WRONG: "This applicant shows..."
RIGHT: "I see your McKinsey Forward — 
        that's a strong signal."
RIGHT: "I'm looking for FMCG experience 
        and it's just not here."
RIGHT: "You have strong project management 
        but this role needs P&L proof."

If you write "the candidate" anywhere, 
you have failed this instruction.`;

let anthropicClient;
function getAnthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

function extractText(response) {
  const blocks = response?.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * @param {string} prompt - User message (e.g. full instructions + JSON schema request)
 * @param {string} [systemPrompt] - Cached when non-empty (ephemeral cache_control)
 * @param {number} [maxTokens]
 * @param {{ langNorm?: "en" | "tr", recruiterVoice?: boolean }} [options] - recruiterVoice reserved for callers (direct-address rule always prepended when system is set)
 */
export async function callClaude(prompt, systemPrompt = "", maxTokens = 1024, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const langNorm = normalizeAnalyzeLang(options.langNorm);
  const systemLead = requiredResponseLanguageDirective(langNorm);
  const userTail = userPromptLangFooter(langNorm);
  let finalSystem = `${systemLead}\n\n${CLAUDE_CANDIDATE_DIRECT_ADDRESS_RULE}`;
  if (langNorm === "tr") finalSystem += `\n\n${MANDATORY_TURKISH_AI_OUTPUT}`;
  if (systemPrompt) finalSystem += `\n\n${systemPrompt}`;
  const userPrompt = String(prompt || "").trim().endsWith(userTail)
    ? String(prompt || "").trim()
    : `${String(prompt || "").trim()}\n\n${userTail}`;

  const debugMessages = [
    { role: "system", content: finalSystem },
    { role: "user", content: userPrompt },
  ];
  logPromptBeingSent(debugMessages);

  const chosenModel = String(options.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const response = await getAnthropic().messages.create({
    model: chosenModel,
    max_tokens: maxTokens,
    system: finalSystem
      ? [
          {
            type: "text",
            text: finalSystem,
            cache_control: { type: "ephemeral" },
          },
        ]
      : undefined,
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractText(response);
}
