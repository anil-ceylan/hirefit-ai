import { logPromptBeingSent } from "./aiPromptLog.js";
import { enforcePromptLanguageRules, normalizeAnalyzeLang } from "./analyze-v2/lang.js";

export async function callAI({ model, system, user, langNorm = "en" }) {
  const baseMessages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const messages = enforcePromptLanguageRules(baseMessages, normalizeAnalyzeLang(langNorm));
  logPromptBeingSent(messages);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 800,
      messages,
    }),
  });
  
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI error: ${txt}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return content.trim();
}

// Güvenli JSON parse (model bazen metin ekler)
export function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* ignore nested JSON parse */
      }
    }
    return null;
  }
}