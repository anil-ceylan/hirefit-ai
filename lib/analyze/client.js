/* eslint-env node */
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_FALLBACK_MODEL = "llama3-8b-8192";
const DEFAULT_MAX_TOKENS = 1000;

async function groqFetchOnce(model, temperature, messages, responseFormat, max_tokens) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const capped = Math.min(1024, Math.max(1, Number(max_tokens) || DEFAULT_MAX_TOKENS));
  const body = { model, temperature, max_tokens: capped, messages };
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${raw.slice(0, 600)}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Groq returned non-JSON body");
  }

  return data?.choices?.[0]?.message?.content ?? "";
}

export async function groqChat({
  model,
  messages,
  temperature = 0.2,
  responseFormat,
  fallbackModel = DEFAULT_FALLBACK_MODEL,
  max_tokens = DEFAULT_MAX_TOKENS,
}) {
  try {
    return await groqFetchOnce(model, temperature, messages, responseFormat, max_tokens);
  } catch (err) {
    console.warn(`[groqChat] primary model failed (${model}), fallback to ${fallbackModel}:`, err?.message || err);
    return groqFetchOnce(fallbackModel, temperature, messages, responseFormat, max_tokens);
  }
}
