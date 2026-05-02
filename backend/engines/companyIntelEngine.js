import { callClaudeHaiku } from "../../lib/analyze-v2/openaiClient.js";
import { parseModelJson } from "../../lib/analyze-v2/json.js";
import { criticalOutputLanguageInstruction, MANDATORY_TURKISH_AI_OUTPUT } from "../../lib/analyze-v2/lang.js";

const KNOWN_SECTORS = [
  "Auto-detect",
  "Tech / Startup",
  "Consulting",
  "Finance",
  "FMCG / Retail",
  "Healthcare",
  "Government",
];

/** Job-title / boilerplate tokens — skip as company candidates */
const JOB_TITLE_WORDS = new Set(
  "senior junior mid staff principal lead staff intern the we our this role job position opening opportunity team remote hybrid onsite full time part contract permanent temporary software engineer developer engineering data science scientist analyst designer product manager director head vp chief executive founder cofounder co-founder machine learning ml ai stack frontend backend devops sre qa quality assurance architect consultant associate years experience required preferred plus nice have skills responsibilities qualifications about overview description summary location based global emea apac".split(
    " "
  )
);

function cleanCompanyCandidate(s) {
  return String(s || "")
    .replace(/^[\s,;:]+|[\s,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleCompanyName(name) {
  const n = cleanCompanyCandidate(name);
  if (n.length < 2 || n.length > 80) return false;
  const low = n.toLowerCase();
  if (/^(unknown|n\/a|na|not applicable|tbd|confidential|anonymous)\b/i.test(low)) return false;
  if (/^about\s+us$/i.test(low)) return false;
  const words = low.split(/\s+/);
  if (words.length === 1 && JOB_TITLE_WORDS.has(words[0])) return false;
  if (words.every((w) => JOB_TITLE_WORDS.has(w) || w.length < 2)) return false;
  return true;
}

/**
 * Rule-based company name hints from JD (before / after GPT).
 */
export function heuristicExtractCompanyName(jdText) {
  const t = String(jdText || "").replace(/\r\n/g, "\n").trim();
  if (!t) return "";

  const tryName = (raw) => {
    const c = cleanCompanyCandidate(raw);
    return isPlausibleCompanyName(c) ? c : "";
  };

  let m;

  m = t.match(/\b([A-Z][A-Za-z0-9&.'’-]+(?:\s+[A-Z][A-Za-z0-9&.'’-]+){0,4})\s+is\s+(looking|hiring|seeking|recruiting)\b/);
  if (m) {
    const hit = tryName(m[1]);
    if (hit) return hit;
  }

  m = t.match(/\bat\s+([A-Z0-9][A-Za-z0-9&.'’-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'’-]*){0,5})(?=\s*[,.]|\s+as\s|\s+for\s|\s+to\s|\s+and\s|\s+in\s|\s+on\s|\s*$|\n)/);
  if (m) {
    const hit = tryName(m[1]);
    if (hit) return hit;
  }

  m = t.match(/\bjoin\s+([A-Z][A-Za-z0-9&.'’-]+(?:\s+[A-Z][A-Za-z0-9&.'’-]+){0,4})\b/);
  if (m) {
    const tail = m[1].trim();
    if (!/^our\b/i.test(tail)) {
      const hit = tryName(tail);
      if (hit) return hit;
    }
  }

  m = t.match(/\bAbout\s+([A-Z][A-Za-z0-9&.'’-]+(?:\s+[A-Z][A-Za-z0-9&.'’-]+){0,4})\b/);
  if (m && m[1] && !/^us$/i.test(m[1].trim())) {
    const hit = tryName(m[1]);
    if (hit) return hit;
  }

  const aboutUs = t.match(/(?:^|\n)\s*About\s+Us\s*[:\n]\s*([\s\S]{0,500})/i);
  if (aboutUs) {
    const chunk = aboutUs[1];
    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3);
    for (const line of lines.slice(0, 4)) {
      if (/^(we|our|the\s+role|this\s+role)\b/i.test(line)) continue;
      const head = line.split(/[—–\-–]/)[0].trim();
      const titleCase = head.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s*$/);
      if (titleCase) {
        const hit = tryName(titleCase[1]);
        if (hit) return hit;
      }
    }
  }

  const firstBlock = (t.split(/\n\s*\n/)[0] || t).slice(0, 1200);
  const capRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  let capM;
  const capHits = [];
  while ((capM = capRe.exec(firstBlock)) !== null) {
    capHits.push(capM[1]);
  }
  for (const phrase of capHits.reverse()) {
    const words = phrase.toLowerCase().split(/\s+/);
    const nonJob = words.filter((w) => !JOB_TITLE_WORDS.has(w));
    if (nonJob.length >= 1 && isPlausibleCompanyName(phrase)) return phrase;
  }

  return "";
}

function gptCompanyNameLooksEmpty(name) {
  const s = String(name || "").trim();
  if (!s) return true;
  const low = s.toLowerCase();
  if (/^n\/a$|^na$|^unknown$|^not\s+stated$|^not\s+available$|^none$|^—/.test(low)) return true;
  if (/company\s+name\s+not\s+stated/i.test(s)) return true;
  return false;
}

function resolveCompanyNameField(gptName, jd) {
  let name = String(gptName || "").trim();
  if (gptCompanyNameLooksEmpty(name)) name = "";
  if (!name) name = heuristicExtractCompanyName(jd);
  if (!name) return "";
  return name;
}

/** Real employer string for Tavily etc.; empty when unknown. */
export function companyNameForSearch(extracted) {
  const n = String(extracted?.company_name || "").trim();
  if (!n) return "";
  if (/^Could not extract company name/i.test(n)) return "";
  if (/^Şirket adı çıkarılamadı/i.test(n)) return "";
  return n;
}

/**
 * Map free-text industry to HireFit sector lens key.
 */
export function mapToHireFitSector(inferred) {
  const s = String(inferred || "").toLowerCase();
  if (!s.trim()) return "Auto-detect";
  if (/tech|software|saas|startup|engineering|developer|it |product|data science|ai\b/.test(s)) return "Tech / Startup";
  if (/consult|strategy|mckinsey|bain|bcg/.test(s)) return "Consulting";
  if (/bank|finance|investment|accounting|cfa|fintech|trading/.test(s)) return "Finance";
  if (/fmcg|retail|consumer|cpg|brand/.test(s)) return "FMCG / Retail";
  if (/health|medical|pharma|clinical|hospital/.test(s)) return "Healthcare";
  if (/government|public sector|ministry|municipal/.test(s)) return "Government";
  return "Auto-detect";
}

/**
 * JD → structured company + sector signals (GPT). lang: 'tr' | 'en'
 */
export async function extractCompanyIntelFromJd(jdText, lang = "en") {
  const jd = String(jdText || "").trim().slice(0, 12000);
  const langNorm = lang === "tr" ? "tr" : "en";
  const trRule =
    langNorm === "tr"
      ? "Yanıtını Türkçe ver, İngilizce kelime karıştırma. JSON değerleri Türkçe olsun (mapped_sector hariç — o İngilizce sabit listeden biri olmalı)."
      : "Respond in English only for natural-language string values.";

  const user = `${langNorm === "tr" ? `${MANDATORY_TURKISH_AI_OUTPUT}\n\n` : ""}${criticalOutputLanguageInstruction(langNorm)}

${trRule}

Job description (JD):
${jd}

Return ONLY valid JSON:
{
  "company_name": "<string or empty if unknown>",
  "sector_inferred": "<short industry label, e.g. B2B SaaS, Investment Banking>",
  "subsector_niche": "<string>",
  "region_likely": "<country/region or unknown>",
  "position_level": "junior" | "mid" | "senior" | "unknown",
  "company_type_estimate": "startup" | "scaleup" | "enterprise" | "big4" | "bigtech" | "unknown",
  "mapped_sector": "<exactly one of: Tech / Startup, Consulting, Finance, FMCG / Retail, Healthcare, Government, Auto-detect>"
}

Rules:
- Infer only from JD text. If a field cannot be inferred, use "unknown" or empty string for company_name.
- Do not invent a company name if JD is anonymous; leave company_name empty.
- For company_name, actively check English phrasing such as: "at [Company]", "join [Company]", "[Company] is looking/hiring/seeking", a title-cased employer in the first paragraph, and headings like "About [Company]" or the first substantive line after "About us".
- mapped_sector must be one of the listed English labels.`;

  const langHead =
    langNorm === "tr"
      ? "Tüm yanıtlarını YALNIZCA Türkçe olarak ver."
      : "You must respond ONLY in English. Every single word must be in English.";
  const systemTail =
    langNorm === "tr"
      ? "İş ilanından işveren ve pazar bağlamı çıkar. Yalnızca JSON üret; JSON dışında düz metin yok."
      : "You extract employer and market context from job postings. JSON only. No prose outside JSON.";

  const content = await callClaudeHaiku({
    langNorm,
    messages: [
      {
        role: "system",
        content: `${langNorm === "tr" ? `${MANDATORY_TURKISH_AI_OUTPUT}\n\n` : ""}${criticalOutputLanguageInstruction(langNorm)}\n\n${langHead}\n\n${systemTail}`,
      },
      { role: "user", content: user },
    ],
  });

  const p = parseModelJson(content) || {};
  let mapped = String(p.mapped_sector || "").trim();
  if (!KNOWN_SECTORS.includes(mapped)) {
    mapped = mapToHireFitSector(p.sector_inferred || mapped);
  }

  return {
    company_name: resolveCompanyNameField(p.company_name, jd),
    sector_inferred: String(p.sector_inferred || "").trim(),
    subsector_niche: String(p.subsector_niche || "").trim(),
    region_likely: String(p.region_likely || "").trim(),
    position_level: String(p.position_level || "unknown").trim(),
    company_type_estimate: String(p.company_type_estimate || "unknown").trim(),
    mapped_sector: mapped,
  };
}
