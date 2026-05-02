/**
 * Shared JD extraction prompts + HTML→text for URL-based JD import
 * (api/extract-job.js and server/server.js).
 */

export const EXTRACT_JOB_SYSTEM = `Extract the COMPLETE job posting text.
Do NOT summarize. Do NOT shorten.
Do NOT paraphrase.

Extract VERBATIM:
- Full company description paragraph
- Every single responsibility bullet
- Every single requirement bullet
  including EXACT wording like:
  'is a plus', 'is a must', 
  '4th class', specific degree names,
  department lists
- Any compensation info (paid/unpaid)
- Any location/eligibility requirements

Return format:
Company: [full company description]
Role: [exact job title]
Responsibilities:
- [exact bullet 1]
- [exact bullet 2]
...
Requirements:
- [exact bullet 1]
- [exact bullet 2]
...
Additional: [anything else in the posting]

If any section is missing from the original, omit it. Never invent content.`;

export function buildExtractJobUserMessage(visibleText) {
  return `Below is visible text from a job posting page (HTML stripped). Preserve every requirement, list item, year/class line, department name, and compensation phrase exactly as given.

---SOURCE---
${visibleText}`;
}

/** Strip markdown fences the model sometimes wraps around the reply */
export function normalizeVerbatimExtract(raw) {
  let s = String(raw || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return s;
}

/** Prefer structured "Role:" line; otherwise empty (caller uses HTML fallback). */
export function parseTitleFromVerbatimExtract(text) {
  const m = String(text || "").match(/^Role:\s*(.+)$/im);
  if (!m) return "";
  let s = m[1].trim();
  if (s.startsWith("[") && s.endsWith("]") && s.length > 2) s = s.slice(1, -1).trim();
  return s;
}

/**
 * HTML → text while keeping line breaks at block/list boundaries so bullets
 * and paragraphs are not merged into one line for the model.
 */
export function stripHtmlToJobVisibleText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
