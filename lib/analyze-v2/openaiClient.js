/* eslint-env node */
import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "gpt-4o";
const FALLBACK_MODEL = "gpt-4o-mini";
/** Cap output for OpenRouter free-tier / cost control (≤1024). */
const DEFAULT_MAX_TOKENS = 1000;

function getOpenAIConfig() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const apiKey = openaiKey || openrouterKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY or OPENROUTER_API_KEY is not set");

  const useOpenRouter = !!openrouterKey && !openaiKey;
  const referer = process.env.OPENROUTER_SITE_URL || process.env.VERCEL_URL;
  const defaultHeaders = {};
  if (useOpenRouter) {
    defaultHeaders["X-Title"] = "HireFit";
    if (referer) {
      defaultHeaders["HTTP-Referer"] = referer.startsWith("http") ? referer : `https://${referer}`;
    }
  }

  return {
    apiKey,
    baseURL: useOpenRouter ? OPENROUTER_BASE_URL : process.env.OPENAI_BASE_URL,
    defaultHeaders,
  };
}

function extractContent(res) {
  return res?.choices?.[0]?.message?.content ?? "";
}

export async function openaiChat({
  messages,
  model = DEFAULT_MODEL,
  temperature = 0.2,
  responseFormat,
  fallbackModel = FALLBACK_MODEL,
  max_tokens = DEFAULT_MAX_TOKENS,
}) {
  const cfg = getOpenAIConfig();
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    defaultHeaders: cfg.defaultHeaders,
  });

  const capped = Math.min(1024, Math.max(1, Number(max_tokens) || DEFAULT_MAX_TOKENS));

  try {
    const res = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: capped,
      messages,
      response_format: responseFormat,
    });
    return extractContent(res);
  } catch (err) {
    console.warn(`[openaiChat] primary model failed (${model}), fallback to ${fallbackModel}:`, err?.message || err);
    const res = await client.chat.completions.create({
      model: fallbackModel,
      temperature,
      max_tokens: capped,
      messages,
      response_format: responseFormat,
    });
    return extractContent(res);
  }
}
