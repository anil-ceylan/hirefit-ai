import OpenAI from "openai";
import { callClaude } from "../claudeClient.js";
import { logPromptBeingSent } from "../aiPromptLog.js";
import { enforcePromptLanguageRules, normalizeAnalyzeLang } from "./lang.js";

/** Anthropic Claude Haiku — replaces Groq for JSON/helper-style calls. */
export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_PRIMARY_MODEL = "llama-3.3-70b-versatile";
export const GROQ_FALLBACK_MODEL = "llama-3.1-8b-instant";
const DEFAULT_MAX_TOKENS = 800;

function getGroqConfig() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return { apiKey, baseURL: GROQ_BASE_URL };
}

function extractContent(res) {
  return res?.choices?.[0]?.message?.content ?? "";
}

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
 * Same message shape / language rules as Groq {@link openaiChat}; delegates to {@link callClaude} with Haiku.
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

export async function openaiChat({
  messages,
  model = GROQ_PRIMARY_MODEL,
  temperature = 0.2,
  responseFormat,
  fallbackModel = GROQ_FALLBACK_MODEL,
  max_tokens = DEFAULT_MAX_TOKENS,
  langNorm = "en",
}) {
  const cfg = getGroqConfig();
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
  });

  const capped = Math.min(800, Math.max(1, Number(max_tokens) || DEFAULT_MAX_TOKENS));
  const safeMessages = enforcePromptLanguageRules(messages, normalizeAnalyzeLang(langNorm));

  try {
    logPromptBeingSent(safeMessages);
    const res = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: capped,
      messages: safeMessages,
      response_format: responseFormat,
    });
    return extractContent(res);
  } catch (err) {
    console.error(`[openaiChat] primary model failed (${model}), fallback to ${fallbackModel}:`, err?.message || err);
    logPromptBeingSent(safeMessages);
    const res = await client.chat.completions.create({
      model: fallbackModel,
      temperature,
      max_tokens: capped,
      messages: safeMessages,
      response_format: responseFormat,
    });
    return extractContent(res);
  }
}
