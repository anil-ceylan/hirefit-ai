/**
 * Free-tier copy: prefer full sentences — never cut mid-sentence with "…".
 */

export function firstCompleteSentences(text, maxSentences = 2) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const parts = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts || parts.length === 0) return raw;
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  return cleaned.slice(0, Math.max(1, maxSentences)).join(" ").trim();
}

/**
 * Prefer `maxSentences` complete sentences; if still over `softMaxChars`, drop to one sentence (still whole).
 */
export function truncateIntelField(text, maxSentences, softMaxChars) {
  let out = firstCompleteSentences(text, maxSentences);
  if (out.length <= softMaxChars) return out;
  out = firstCompleteSentences(text, 1);
  return out;
}
