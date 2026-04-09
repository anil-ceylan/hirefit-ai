/* eslint-env node */
import { openaiChat } from "../../lib/analyze-v2/openaiClient.js";
import { parseModelJson } from "../../lib/analyze-v2/json.js";

const KNOWN_SECTORS = [
  "Auto-detect",
  "Tech / Startup",
  "Consulting",
  "Finance",
  "FMCG / Retail",
  "Healthcare",
  "Government",
];

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

  const user = `${trRule}

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
- mapped_sector must be one of the listed English labels.`;

  const langHead =
    langNorm === "tr"
      ? "Tüm yanıtlarını YALNIZCA Türkçe olarak ver."
      : "You must respond ONLY in English. Every single word must be in English.";
  const systemTail =
    langNorm === "tr"
      ? "İş ilanından işveren ve pazar bağlamı çıkar. Yalnızca JSON üret; JSON dışında düz metin yok."
      : "You extract employer and market context from job postings. JSON only. No prose outside JSON.";

  const content = await openaiChat({
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${langHead}\n\n${systemTail}`,
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
    company_name: String(p.company_name || "").trim(),
    sector_inferred: String(p.sector_inferred || "").trim(),
    subsector_niche: String(p.subsector_niche || "").trim(),
    region_likely: String(p.region_likely || "").trim(),
    position_level: String(p.position_level || "unknown").trim(),
    company_type_estimate: String(p.company_type_estimate || "unknown").trim(),
    mapped_sector: mapped,
  };
}
