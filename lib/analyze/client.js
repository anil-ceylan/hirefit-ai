/* eslint-env node */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function openrouterChat({
  model,
  messages,
  temperature = 0.2,
  responseFormat,
}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");

  const body = { model, temperature, messages };
  if (responseFormat) body.response_format = responseFormat;

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "X-Title": "HireFit",
  };
  const referer = process.env.OPENROUTER_SITE_URL || process.env.VERCEL_URL;
  if (referer) {
    headers["HTTP-Referer"] = referer.startsWith("http") ? referer : `https://${referer}`;
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${raw.slice(0, 600)}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter returned non-JSON body");
  }

  return data?.choices?.[0]?.message?.content ?? "";
}
