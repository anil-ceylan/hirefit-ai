import { openrouterChat } from "./client.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, userPromptLangFooter } from "./lang.js";

const MODEL = "openai/gpt-4o-mini";

export async function runAtsEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const user = `${lens}

Simulate ATS parsing and keyword screening for THIS sector lens. Be harsh and specific — no generic advice.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "ats_score": <number 0-100>,
  "keyword_match": <number 0-100>,
  "formatting_score": <number 0-100>,
  "missing_keywords": [<string>],
  "parsing_issues": [<string>]
}${userPromptLangFooter(langNorm)}`;

  const content = await openrouterChat({
    model: MODEL,
    temperature: 0.12,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPromptWithLang(
          "You are an ATS parser simulator. Recruiters rely on keyword filters. Call out parsing and keyword failures bluntly — this CV either clears the bot or it does not. JSON only.",
          langNorm
        ),
      },
      { role: "user", content: user },
    ],
  });

  const p = parseModelJson(content) || {};
  return {
    ats_score: clamp(p.ats_score, 0, 100),
    keyword_match: clamp(p.keyword_match, 0, 100),
    formatting_score: clamp(p.formatting_score, 0, 100),
    missing_keywords: takeStrings(p.missing_keywords).slice(0, 30),
    parsing_issues: takeStrings(p.parsing_issues).slice(0, 15),
  };
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return 50;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function takeStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}
