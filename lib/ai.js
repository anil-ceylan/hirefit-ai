import { callClaudeHaiku } from "./analyze-v2/openaiClient.js";

export async function callAI({ model, system, user, langNorm = "en" }) {
  void model;
  const content = await callClaudeHaiku({
    langNorm,
    max_tokens: 800,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
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
