import { callClaudeHaiku } from "../analyze-v2/openaiClient.js";
import { validateGuidanceOutput } from "./validation.js";
export const PROMOTION_RAISE_PROMPT_VERSION = "promotion_raise_v1";
export function parseGuidancePayload(raw) {
  const text = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed;
  try { parsed = JSON.parse(text); } catch { const match = text.match(/\{[\s\S]*\}/); try { parsed = match ? JSON.parse(match[0]) : null; } catch { parsed = null; } }
  return parsed?.guidance && typeof parsed.guidance === "object" ? parsed.guidance : parsed;
}
export async function generatePromotionRaiseGuidance({ input, profile, lang = "TR" }) {
  const tr = String(lang).toUpperCase() === "TR";
  const prompt = `Return JSON only with keys situation_summary, known_facts, assumptions_unknowns, recommended_next_step, conversation_plan, suggested_wording, evidence_checklist, decision_criteria, risks_tradeoffs. Values may be concise strings or arrays. Speak directly to the user. ${tr ? "Respond in Turkish." : "Respond in English."}\n\nSituation:\n${JSON.stringify(input)}\nCareer Memory (server-loaded, may be incomplete):\n${JSON.stringify({ career_identity: profile?.career_identity, career_level: profile?.career_level, strengths: profile?.strengths, experience: profile?.experience, target_roles: profile?.target_roles })}`;
  const raw = await callClaudeHaiku({ langNorm: tr ? "tr" : "en", max_tokens: 3000, messages: [{ role: "system", content: "Return one complete JSON object only. Do not use Markdown fences. You are a careful career conversation coach. Separate facts from assumptions. Do not give legal advice or guarantee an outcome." }, { role: "user", content: prompt }] });
  const parsed = parseGuidancePayload(raw);
  const check = validateGuidanceOutput(parsed || {});
  if (!check.ok) { const error = new Error("MALFORMED_GUIDANCE_OUTPUT"); error.code = error.message; throw error; }
  return parsed;
}
