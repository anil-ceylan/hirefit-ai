import { openrouterChat } from "./client.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, userPromptLangFooter } from "./lang.js";

const MODEL = "openai/gpt-4o-mini";

export async function runAtsEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const user = `${lens}

Simulate ATS parsing and keyword screening for THIS sector lens. Be harsh and specific — no generic advice.
Use concrete evidence from THIS CV text only.
For every missing keyword, mention what closest signal exists in CV and why it is still insufficient for this JD context.
Extract matched skills directly from CV phrasing (tools, methods, certifications, project terms) — do not invent generic matches.
You MUST find at least 3-5 matching skills from the CV. Look harder. If candidate has project management experience and JD mentions it, that's a match. Never return empty matched_skills.
Do not repeat information from other sections.

CV:
${cvText}

Job description:
${jobDescription}

Return ONLY valid JSON:
{
  "ats_score": <number 0-100>,
  "keyword_match": <number 0-100>,
  "formatting_score": <number 0-100>,
  "matched_skills": [<string, exact phrases inferred from CV evidence>],
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
          "You are an ATS parser simulator. Focus ONLY on skills and keyword matching evidence. Recruiters rely on keyword filters. Call out parsing and keyword failures bluntly — this CV either clears the bot or it does not. JSON only. Be specific to THIS candidate's CV. Reference actual experiences, projects, certifications mentioned in the CV. Never give generic advice that could apply to anyone. Do not repeat information from other sections.",
          langNorm
        ),
      },
      { role: "user", content: user },
    ],
  });

  const p = parseModelJson(content) || {};
  const modelMatched = takeStrings(p.matched_skills).slice(0, 30);
  const fallbackMatched = deriveMatchedSkillsFromCv(cvText, jobDescription, modelMatched);
  return {
    ats_score: clamp(p.ats_score, 0, 100),
    keyword_match: clamp(p.keyword_match, 0, 100),
    formatting_score: clamp(p.formatting_score, 0, 100),
    matched_skills: fallbackMatched,
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

function deriveMatchedSkillsFromCv(cvText, jdText, existing) {
  if (Array.isArray(existing) && existing.length >= 3) return existing;
  const cv = String(cvText || "");
  const jd = String(jdText || "");
  const pool = [
    "project management", "stakeholder management", "agile", "scrum", "jira", "confluence",
    "sql", "python", "excel", "power bi", "tableau", "google analytics", "aws", "azure",
    "leadership", "communication", "data analysis", "product management", "market research",
  ];
  const seen = new Set((existing || []).map((s) => s.toLowerCase()));
  const out = [...(existing || [])];
  const hayCv = cv.toLowerCase();
  const hayJd = jd.toLowerCase();
  for (const skill of pool) {
    if (out.length >= 5) break;
    if (seen.has(skill)) continue;
    if (hayCv.includes(skill) && (hayJd.includes(skill) || out.length < 3)) {
      out.push(skill);
      seen.add(skill);
    }
  }
  if (out.length < 3) {
    const tokens = cv
      .split(/[\n,;|/()]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && s.length <= 32)
      .slice(0, 200);
    for (const t of tokens) {
      if (out.length >= 5) break;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      if (/[a-z]/i.test(t)) {
        out.push(t);
        seen.add(k);
      }
    }
  }
  return out.slice(0, 30);
}
