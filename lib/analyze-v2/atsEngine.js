import { openaiChat } from "./openaiClient.js";
import { parseModelJson } from "./json.js";
import { getSectorPromptBlock } from "./sectorContext.js";
import { systemPromptWithLang, userPromptLangFooter } from "./lang.js";

const MODEL = "llama-3.3-70b-versatile";

export async function runAtsEngine(cvText, jobDescription, sector, langNorm = "en") {
  const lens = getSectorPromptBlock(sector);
  const langInstruction = langNorm === "tr"
    ? "SEN TURKCE KONUSAN BIR UZMANSIN. BUTUN CIKTILARIN TURKCE OLMALI. INGILIZCE YAZMA. CV veya is ilani Ingilizce olsa bile sen Turkce yaz."
    : "Respond in English.";
  const basePrompt = `${lens}

Simulate ATS parsing and keyword screening for THIS sector lens. Be harsh and specific — no generic advice.
Use concrete evidence from THIS CV text only.
Quote CV phrases directly where relevant; do not write generic statements.
If a required detail does not exist in CV, explicitly say "CV'de belirtilmemiş".
For every missing keyword, mention what closest signal exists in CV and why it is still insufficient for this JD context.
Extract matched skills directly from CV phrasing (tools, methods, certifications, project terms) — do not invent generic matches.
You MUST find at least 3-5 matching skills from the CV. Look harder. If candidate has project management experience and JD mentions it, that's a match. Never return empty matched_skills.
Maximum list lengths: matched_skills max 5, top_keywords max 12, missing_keywords max 12, parsing_issues max 8.
Turkish mode rule: Yanıtını Türkçe ver, İngilizce kelime karıştırma.
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
  "top_keywords": [<string, most critical JD keywords in response language>],
  "missing_keywords": [<string>],
  "parsing_issues": [<string>]
}${userPromptLangFooter(langNorm)}`;
  const user = `${langInstruction}\n\n${basePrompt}`;

  const content = await openaiChat({
    model: MODEL,
    temperature: 0.0,
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
  const fallbackMatched = deriveMatchedSkillsFromCv(cvText, jobDescription, modelMatched, langNorm);
  const cleanMissing = takeStrings(p.missing_keywords)
    .map(cleanAtsTag)
    .filter(Boolean)
    .slice(0, 30);
  const cleanParsing = takeStrings(p.parsing_issues)
    .map(cleanAtsTag)
    .filter(Boolean)
    .slice(0, 15);
  return {
    ats_score: clamp(p.ats_score, 0, 100),
    keyword_match: clamp(p.keyword_match, 0, 100),
    formatting_score: clamp(p.formatting_score, 0, 100),
    matched_skills: fallbackMatched,
    top_keywords: deriveTopKeywordsFromJd(jobDescription, langNorm, takeStrings(p.top_keywords).slice(0, 20)),
    missing_keywords: cleanMissing,
    parsing_issues: cleanParsing,
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

function deriveMatchedSkillsFromCv(cvText, jdText, existing, langNorm = "en") {
  if (Array.isArray(existing) && existing.length >= 3) return existing;
  const cv = String(cvText || "");
  const jd = String(jdText || "");
  const pool = [
    "project management", "stakeholder management", "agile", "scrum", "jira", "confluence",
    "sql", "python", "excel", "power bi", "tableau", "google analytics", "aws", "azure",
    "leadership", "communication", "data analysis", "product management", "market research",
  ];
  const semanticPairs = [
    { jd: ["client impact", "business impact", "customer impact"], cv: ["stakeholder management", "stakeholder collaboration", "cross-functional", "project management"] },
    { jd: ["stakeholder"], cv: ["stakeholder management", "stakeholder collaboration", "client communication"] },
    { jd: ["data-driven", "data driven", "analytics"], cv: ["data analysis", "data-driven decision making", "analysis"] },
    { jd: ["delivery", "execution"], cv: ["project management", "program management", "coordination"] },
    { jd: ["roadmap"], cv: ["product management", "planning", "prioritization"] },
  ];
  const trMap = {
    "project management": "proje yönetimi",
    "stakeholder management": "paydaş yönetimi",
    "stakeholder collaboration": "paydaş iş birliği",
    agile: "çevik çalışma",
    scrum: "scrum",
    jira: "jira",
    confluence: "confluence",
    sql: "sql",
    python: "python",
    excel: "excel",
    "power bi": "power bi",
    tableau: "tableau",
    "google analytics": "google analytics",
    aws: "aws",
    azure: "azure",
    leadership: "liderlik",
    communication: "iletişim",
    "data analysis": "veri analizi",
    "product management": "ürün yönetimi",
    "market research": "pazar araştırması",
    "client impact": "müşteri etkisi",
    "data-driven decision making": "veri odaklı karar verme",
  };
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
  for (const pair of semanticPairs) {
    if (out.length >= 5) break;
    const jdHit = pair.jd.some((x) => hayJd.includes(x));
    if (!jdHit) continue;
    const cvHit = pair.cv.find((x) => hayCv.includes(x));
    if (!cvHit) continue;
    const key = cvHit.toLowerCase();
    if (seen.has(key)) continue;
    out.push(cvHit);
    seen.add(key);
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
  const localized = out.map((s) => {
    const key = String(s).toLowerCase();
    return langNorm === "tr" ? trMap[key] || s : s;
  });
  return localized
    .filter((s) => !/^(key duties|duties|responsibilities|requirements?)\b/i.test(String(s)))
    .slice(0, 30);
}

function deriveTopKeywordsFromJd(jdText, langNorm, existing = []) {
  if (Array.isArray(existing) && existing.length >= 3) return existing.slice(0, 20);
  const jd = String(jdText || "").toLowerCase();
  const keywords = [
    "project management", "stakeholder management", "client impact", "data-driven decision making",
    "sql", "python", "excel", "power bi", "tableau", "agile", "scrum", "communication", "leadership",
  ];
  const trMap = {
    "project management": "proje yönetimi",
    "stakeholder management": "paydaş yönetimi",
    "client impact": "müşteri etkisi",
    "data-driven decision making": "veri odaklı karar verme",
    sql: "sql", python: "python", excel: "excel", "power bi": "power bi", tableau: "tableau",
    agile: "çevik çalışma", scrum: "scrum", communication: "iletişim", leadership: "liderlik",
  };
  const out = [];
  for (const k of keywords) {
    if (out.length >= 12) break;
    if (jd.includes(k)) out.push(langNorm === "tr" ? trMap[k] || k : k);
  }
  const cleanedExisting = (existing || []).map(cleanAtsTag).filter(Boolean).slice(0, 20);
  return out.length ? out : cleanedExisting;
}

function cleanAtsTag(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^(key duties|duties|responsibilities|requirements?)\s*[ivxlcdm0-9-]*$/i.test(s)) return "";
  return s.replace(/^(key duties|duties|responsibilities|requirements?)\s*[ivxlcdm0-9-]*[:\-]?\s*/i, "").trim();
}
