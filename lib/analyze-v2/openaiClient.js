/* eslint-env node */
import OpenAI from "openai";
import { logPromptBeingSent } from "../aiPromptLog.js";

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

export async function openaiChat({
  messages,
  model = GROQ_PRIMARY_MODEL,
  temperature = 0.2,
  responseFormat,
  fallbackModel = GROQ_FALLBACK_MODEL,
  max_tokens = DEFAULT_MAX_TOKENS,
}) {
  const cfg = getGroqConfig();
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
  });

  const capped = Math.min(800, Math.max(1, Number(max_tokens) || DEFAULT_MAX_TOKENS));

  try {
    logPromptBeingSent(messages);
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
    logPromptBeingSent(messages);
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
