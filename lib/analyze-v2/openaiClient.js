import { callClaude } from "../claudeClient.js";
import { enforcePromptLanguageRules, normalizeAnalyzeLang } from "./lang.js";

/** Anthropic Claude Haiku for helper/extraction paths. */
export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

/** @param {Array<{ role: string, content: string }>} messages */
function messagesToClaudeParts(messages) {
  let systemCombined = "";
  const userChunks = [];
  for (const m of messages || []) {
    const r = String(m?.role || "").toLowerCase();
    const content = typeof m?.content === "string" ? m.content : String(m?.content ?? "");
    if (r === "system") systemCombined = systemCombined ? `${systemCombined}\n\n${content}` : content;
    else userChunks.push(content);
  }
  return { systemPrompt: systemCombined, userPrompt: userChunks.join("\n\n").trim() };
}

/**
 * Chat-completions-shaped messages + language enforcement; delegates to {@link callClaude} with Haiku.
 * @param {{ messages: Array<{ role: string, content: string }>, langNorm?: "en"|"tr", max_tokens?: number }} params
 */
export async function callClaudeHaiku({ messages, langNorm = "en", max_tokens = 800 } = {}) {
  const capped = Math.min(Math.max(Number(max_tokens) || 800, 1), 32000);
  const safeMessages = enforcePromptLanguageRules(messages, normalizeAnalyzeLang(langNorm));
  const { systemPrompt, userPrompt } = messagesToClaudeParts(safeMessages);
  return callClaude(userPrompt, systemPrompt, capped, {
    langNorm,
    model: CLAUDE_HAIKU_MODEL,
    useLanguageEnvelope: false,
  });
}
