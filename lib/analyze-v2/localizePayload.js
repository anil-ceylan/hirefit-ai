/* eslint-env node */
import { callClaude } from "../claudeClient.js";
import { parseModelJson } from "./json.js";

const DO_NOT_TRANSLATE_VALUES = new Set([
  "apply_now",
  "apply_with_risk",
  "do_not_apply",
  "critical",
  "major",
  "minor",
  "high",
  "medium",
  "low",
  "strong_yes",
  "maybe",
  "no",
  "yes",
  "pass",
  "review",
  "at risk",
  "intern",
  "junior",
  "mid",
  "senior",
]);

function shouldTranslateString(s) {
  const txt = String(s || "").trim();
  if (!txt) return false;
  if (DO_NOT_TRANSLATE_VALUES.has(txt.toLowerCase())) return false;
  if (/^https?:\/\//i.test(txt)) return false;
  if (!/[A-Za-z]/.test(txt)) return false;
  return true;
}

function collectStringRefs(node, refs) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === "string" && shouldTranslateString(v)) {
        refs.push({
          value: v,
          apply: (next) => {
            node[i] = next;
          },
        });
      } else if (v && typeof v === "object") {
        collectStringRefs(v, refs);
      }
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === "string" && shouldTranslateString(v)) {
        refs.push({
          value: v,
          apply: (next) => {
            node[k] = next;
          },
        });
      } else if (v && typeof v === "object") {
        collectStringRefs(v, refs);
      }
    }
  }
}

/**
 * Ensures user-facing strings are Turkish when UI language is Turkish.
 * Best-effort: returns original payload when translation fails.
 * @param {object} payload
 * @param {"en" | "tr"} langNorm
 */
export async function localizePayloadStrings(payload, langNorm = "en") {
  if (langNorm !== "tr" || !payload || typeof payload !== "object") return payload;

  const clone = JSON.parse(JSON.stringify(payload));
  const refs = [];
  collectStringRefs(clone, refs);
  if (!refs.length) return clone;

  const source = refs.map((r) => r.value);
  try {
    const content = await callClaude(
      `Translate each item in the JSON array to Turkish for end-user UI.
Rules:
- Keep array length and order EXACTLY the same.
- Return ONLY a JSON array of strings.
- Keep tokens like SQL, API, KPI, AWS, Excel, Word, PowerPoint unchanged when appropriate.
- Keep concise tone.

Input:
${JSON.stringify(source)}`,
      "",
      2600,
      { langNorm: "tr" },
    );
    const translated = parseModelJson(content);
    if (!Array.isArray(translated) || translated.length !== source.length) return clone;
    translated.forEach((t, i) => {
      refs[i].apply(String(t ?? source[i]));
    });
    return clone;
  } catch (err) {
    console.warn("[localizePayloadStrings] translation skipped:", err?.message || err);
    return clone;
  }
}

