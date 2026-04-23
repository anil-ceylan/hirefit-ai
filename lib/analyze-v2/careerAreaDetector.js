import { openaiChat } from "./openaiClient.js";
import { parseModelJson } from "./json.js";
import { normalizeAnalyzeLang, userPromptLangFooter } from "./lang.js";

export const CAREER_AREAS = [
  "Veri & Analiz",
  "Yazılım",
  "Ürün",
  "Pazarlama",
  "Finans",
  "İş / Operasyon",
  "Tasarım",
  "Satış",
];

const CAREER_AREA_SET = new Set(CAREER_AREAS);

const CONF_MAP = {
  düşük: "low",
  dusuk: "low",
  low: "low",
  orta: "medium",
  medium: "medium",
  yüksek: "high",
  yuksek: "high",
  high: "high",
};

const MODEL = "llama-3.3-70b-versatile";

export function normalizeCareerArea(area) {
  const a = String(area || "").trim();
  if (CAREER_AREA_SET.has(a)) return a;

  const low = a.toLowerCase();
  if (low.includes("data") || low.includes("analiz")) return "Veri & Analiz";
  if (low.includes("yazılım") || low.includes("software") || low.includes("engineer")) return "Yazılım";
  if (low.includes("ürün") || low.includes("product")) return "Ürün";
  if (low.includes("pazarlama") || low.includes("marketing")) return "Pazarlama";
  if (low.includes("finans") || low.includes("finance")) return "Finans";
  if (low.includes("operasyon") || low.includes("business") || low.includes("iş")) return "İş / Operasyon";
  if (low.includes("tasarım") || low.includes("design")) return "Tasarım";
  if (low.includes("satış") || low.includes("sales")) return "Satış";

  return "İş / Operasyon";
}

function normalizeConfidence(value) {
  const key = String(value || "").trim().toLowerCase();
  return CONF_MAP[key] || "medium";
}

export async function detectCareerArea({ cvText, jobDescription, lang = "en" }) {
  const cv = String(cvText || "").trim();
  const jd = String(jobDescription || "").trim();
  const langNorm = normalizeAnalyzeLang(lang);
  if (!cv || !jd) {
    return {
      area: "İş / Operasyon",
      reason: "Insufficient input; defaulted to nearest general lane.",
      confidence: "low",
    };
  }

  const prompt = `Bir adayın CV’sini ve iş ilanını analiz et.
Amaç: adayın EN UYGUN olduğu kariyer alanını seçmek.

Kurallar:
- Sadece TEK alan seç.
- Genel konuşma yapma.
- Kararı en baskın sinyale göre ver.
- Emin değilsen en yakın alanı seç.

Olası alanlar:
- Veri & Analiz
- Yazılım
- Ürün
- Pazarlama
- Finans
- İş / Operasyon
- Tasarım
- Satış

CV:
${cv.slice(0, 5000)}

Job Description:
${jd.slice(0, 5000)}

Return ONLY valid JSON:
{
  "area": "<must be one of the listed 8 options>",
  "reason": "<one sentence>",
  "confidence": "Düşük" | "Orta" | "Yüksek"
}
${userPromptLangFooter(langNorm)}`;

  try {
    const content = await openaiChat({
      model: MODEL,
      temperature: 0,
      responseFormat: { type: "json_object" },
      langNorm,
      max_tokens: 260,
      messages: [
        {
          role: "system",
          content:
            "You are a strict career lane classifier. Pick exactly one lane from the provided list. JSON only.",
        },
        { role: "user", content: prompt },
      ],
    });

    const p = parseModelJson(content) || {};
    const area = normalizeCareerArea(p.area);
    const reason = String(p.reason || "").trim() || "Dominant CV-JD signals align with this lane.";
    const confidence = normalizeConfidence(p.confidence);

    return { area, reason, confidence };
  } catch {
    return {
      area: "İş / Operasyon",
      reason: "Classifier fallback selected the nearest general lane.",
      confidence: "low",
    };
  }
}

