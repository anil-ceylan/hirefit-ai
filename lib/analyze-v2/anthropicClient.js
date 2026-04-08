/* eslint-env node */
import Anthropic from "@anthropic-ai/sdk";
import { openaiChat } from "./openaiClient.js";

const MODEL = "claude-sonnet-4-5";
const FALLBACK_MODEL = "gpt-4o-mini";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toAnthropicPayload(messages = []) {
  const system = messages
    .filter((m) => m?.role === "system")
    .map((m) => String(m.content || "").trim())
    .filter(Boolean)
    .join("\n\n");

  const conversational = messages
    .filter((m) => m?.role !== "system")
    .map((m) => {
      const role = m?.role === "assistant" ? "assistant" : "user";
      return { role, content: String(m?.content || "") };
    });

  return { system, messages: conversational.length ? conversational : [{ role: "user", content: "" }] };
}

function readAnthropicText(resp) {
  const blocks = Array.isArray(resp?.content) ? resp.content : [];
  return blocks
    .map((b) => (b?.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

export async function anthropicChat({
  messages,
  model = MODEL,
  temperature = 0.2,
  responseFormat,
  fallbackModel = FALLBACK_MODEL,
}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey: key });
  const payload = toAnthropicPayload(messages);
  let lastError;

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      const res = await client.messages.create({
        model,
        temperature,
        max_tokens: 2200,
        system: payload.system || undefined,
        messages: payload.messages,
      });
      return readAnthropicText(res);
    } catch (err) {
      lastError = err;
      if (attempt === 2) break;
      await sleep(300 * (2 ** attempt));
    }
  }

  console.warn(`[anthropicChat] primary model failed (${model}), fallback to ${fallbackModel}:`, lastError?.message || lastError);
  return openaiChat({
    messages,
    model: fallbackModel,
    temperature,
    responseFormat,
    fallbackModel,
  });
}
