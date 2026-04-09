/* eslint-env node */
import { openaiChat } from "../../lib/analyze-v2/openaiClient.js";
import { parseModelJson } from "../../lib/analyze-v2/json.js";

const TAVILY_URL = "https://api.tavily.com/search";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function cacheKey(parts) {
  return parts.join("|").slice(0, 500);
}

function getCached(key) {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.t > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return row.v;
}

function setCached(key, value) {
  cache.set(key, { t: Date.now(), v: value });
}

async function tavilySearch(query) {
  const key = cacheKey(["tavily", query]);
  const hit = getCached(key);
  if (hit) return hit;

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return { results: [] };
  }

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: "advanced",
      }),
    });
    const data = await res.json();
    const results = Array.isArray(data?.results)
      ? data.results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        }))
      : [];
    setCached(key, { results });
    return { results };
  } catch (e) {
    console.warn("[tavilySearch]", e?.message || e);
    return { results: [] };
  }
}

async function summarizeInsights(prompt, lang) {
  const isTr = lang === "tr";
  const content = await openaiChat({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: isTr
          ? "Sen bir iş analisti asistanısın. Sadece verilen arama özetlerinden çıkarım yap; uydurma. Çıktı JSON."
          : "You are a workplace research assistant. Infer only from provided snippets; do not invent. JSON only.",
      },
      { role: "user", content: prompt },
    ],
  });
  return parseModelJson(content) || {};
}

/**
 * Parallel company-focused searches; returns processed insights (not raw URLs).
 */
export async function searchCompany(companyName, sector, lang = "en") {
  const c = String(companyName || "").trim();
  const s = String(sector || "").trim();
  if (!c && !s) {
    return { news_snippets: 0, culture_snippets: 0, trend_snippets: 0, insight: "", tone: "neutral" };
  }

  const q1 = `${c || s} latest news 2025 2026`.trim();
  const q2 = `${c || s} hiring culture employee benefits`.trim();
  const q3 = `${s || c} industry trends skills in demand 2025 2026`.trim();

  const [r1, r2, r3] = await Promise.all([tavilySearch(q1), tavilySearch(q2), tavilySearch(q3)]);

  const bundle = [r1, r2, r3]
    .map((r, i) => `--- Batch ${i + 1} ---\n${formatResults(r.results)}`)
    .join("\n\n");

  const isTr = lang === "tr";
  const prefix = isTr ? "WSJ ve sektör raporlarına göre: " : "Based on public web snippets (news, careers, industry pages): ";

  const prompt = isTr
    ? `${prefix}
Aşağıdaki arama özetlerinden şirket odaklı 2-3 cümle çıkar:
- Son dönem haber / büyüme sinyalleri
- İşe alım / çalışan deneyimi ile ilgili genel izlenim (kesin iddia etme; "sinyaller" dili kullan)

Metin:
${bundle}

JSON dön:
{ "insight": "<string>", "tone": "positive|neutral|cautious" }`
    : `${prefix}
From the snippets below, produce 2-3 sentences on:
- Recent momentum / news signals
- Hiring culture / benefits signals (careful language, no unverified claims)

Snippets:
${bundle}

Return JSON:
{ "insight": "<string>", "tone": "positive|neutral|cautious" }`;

  const sum = await summarizeInsights(prompt, lang);
  return {
    news_snippets: r1.results.length,
    culture_snippets: r2.results.length,
    trend_snippets: r3.results.length,
    insight: String(sum.insight || "").trim(),
    tone: String(sum.tone || "neutral"),
  };
}

function formatResults(results) {
  return (results || [])
    .slice(0, 5)
    .map((x, i) => `${i + 1}. ${x.title}\n${String(x.content || "").slice(0, 400)}`)
    .join("\n");
}

/**
 * Sector trend searches → structured summary.
 */
export async function searchSectorTrends(sector, lang = "en") {
  const s = String(sector || "").trim() || "general industry";
  const q1 = `${s} most in-demand skills 2025 2026`;
  const q2 = `${s} what recruiters look for 2025`;
  const q3 = `${s} emerging roles future of work`;

  const [r1, r2, r3] = await Promise.all([tavilySearch(q1), tavilySearch(q2), tavilySearch(q3)]);
  const bundle = [r1, r2, r3]
    .map((r, i) => `--- ${i + 1} ---\n${formatResults(r.results)}`)
    .join("\n\n");

  const isTr = lang === "tr";
  const prompt = isTr
    ? `WSJ ve sektör raporlarına göre: Aşağıdaki web özetlerinden sektör trendlerini çıkar. Uydurma; kanıtsız iddia yok.

${bundle}

Sadece JSON:
{
  "trending_skills": ["skill1","skill2","skill3"],
  "declining_skills": ["skill1","skill2"],
  "emerging_roles": ["role1","role2"],
  "key_insight": "Bu sektörde şu an ...",
  "source_summary": "WSJ, LinkedIn, industry reports bazında (özet)"
}`
    : `From the snippets, extract sector trends. Do not invent facts.

${bundle}

Return JSON only:
{
  "trending_skills": ["skill1","skill2","skill3"],
  "declining_skills": ["skill1","skill2"],
  "emerging_roles": ["role1","role2"],
  "key_insight": "What stands out now because ...",
  "source_summary": "Based on aggregated public sources (news, hiring sites, reports)"
}`;

  const obj = await summarizeInsights(prompt, lang);
  return {
    trending_skills: Array.isArray(obj.trending_skills) ? obj.trending_skills.map(String) : [],
    declining_skills: Array.isArray(obj.declining_skills) ? obj.declining_skills.map(String) : [],
    emerging_roles: Array.isArray(obj.emerging_roles) ? obj.emerging_roles.map(String) : [],
    key_insight: String(obj.key_insight || "").trim(),
    source_summary: String(obj.source_summary || "").trim(),
  };
}

/**
 * Compare CV skills vs sector trends (GPT).
 */
export async function compareCvToSectorTrends(cvText, trendingSkills, lang = "en") {
  const cv = String(cvText || "").slice(0, 8000);
  const trends = (trendingSkills || []).slice(0, 12);
  const isTr = lang === "tr";

  const prompt = isTr
    ? `CV metni:
${cv}

Trend beceriler (sektör): ${trends.join(", ")}

Sadece CV'de geçen kanıta dayan. Uydurma. JSON:
{
  "matched_trending": ["..."],
  "missing_trending": ["..."],
  "narrative": "CV'nde şu trending skill'ler var: ... Sektörde revaçta ama CV'nde eksik: ..."
}`
    : `CV:
${cv}

Trending skills: ${trends.join(", ")}

Use only evidence present in CV. JSON:
{
  "matched_trending": ["..."],
  "missing_trending": ["..."],
  "narrative": "Your CV shows trending skills X, Y. In demand but missing from your CV: A, B."
}`;

  const content = await openaiChat({
    model: "llama-3.3-70b-versatile",
    temperature: 0.15,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You compare CV evidence to a skill list. JSON only.",
      },
      { role: "user", content: prompt },
    ],
  });
  const p = parseModelJson(content) || {};
  return {
    matched_trending: Array.isArray(p.matched_trending) ? p.matched_trending.map(String) : [],
    missing_trending: Array.isArray(p.missing_trending) ? p.missing_trending.map(String) : [],
    narrative: String(p.narrative || "").trim(),
  };
}

/**
 * Full report card sections + preparation box (GPT), with graceful degradation if search empty.
 */
export async function buildCompanyIntelligenceReport({
  extracted,
  companySearch,
  sectorTrends,
  cvComparison,
  lang = "en",
}) {
  const isTr = lang === "tr";
  const ex = extracted || {};
  const bundle = JSON.stringify({
    extracted: ex,
    companySearch,
    sectorTrends,
    cvComparison,
  });

  const prompt = isTr
    ? `Aşağıdaki verilerle şirket/sektör raporu üret. Web verisi yoksa sadece JD çıkarımıyla devam et; "veri yok" demeden doğal yaz.

${bundle}

JSON formatı:
{
  "company_structure": "<ŞIRKET GENEL YAPISI: tip, büyüklük tahmini, ana faaliyet, büyüme/olgunluk>",
  "employee_experience": "<ÇALIŞAN DENEYİMİ: itibar sinyalleri, faydalar, kültür — temkinli dil>",
  "career_opportunities": "<KARIYER FIRSATLARI: CV'ye katkı, uluslararası bağlantı, sektör geçişi>",
  "sector_position": "<SEKTÖR KONUMU: rekabet, büyüme/durgunluk sinyalleri>",
  "one_liner_value": "Bu şirket kariyerinize şunu katar: ...",
  "preparation_steps": [
    { "skill": "", "resource_path": "", "weeks_estimate": 2 }
  ],
  "preparation_intro": "Bu role hazırlanmak için önerilen adımlar:"
}
Maksimum 2 preparation_steps. Hafta tahmini gerçekçi olsun.`
    : `Build a structured employer/sector report from the data below. If web data is thin, rely on JD extraction only; stay factual.

${bundle}

Return JSON:
{
  "company_structure": "...",
  "employee_experience": "...",
  "career_opportunities": "...",
  "sector_position": "...",
  "one_liner_value": "This company would add ... to your career because ...",
  "preparation_steps": [{ "skill": "", "resource_path": "", "weeks_estimate": 2 }],
  "preparation_intro": "Suggested steps to prepare for this role:"
}
Max 2 preparation_steps.`;

  const content = await openaiChat({
    model: "llama-3.3-70b-versatile",
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  return parseModelJson(content) || {};
}

/**
 * Orchestrate: search + trends + CV compare + report card.
 */
function truncateStr(s, n) {
  const t = String(s || "");
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

/** Free tier: shorter company intel payload. */
export function liteCompanyIntel(layer) {
  if (!layer) return null;
  const rep = layer.report || {};
  return {
    extracted: layer.extracted,
    company_search: { insight: truncateStr(layer.company_search?.insight, 400) },
    sector_trends: {
      key_insight: layer.sector_trends?.key_insight,
      trending_skills: (layer.sector_trends?.trending_skills || []).slice(0, 4),
      source_summary: layer.sector_trends?.source_summary,
    },
    cv_vs_sector: { narrative: layer.cv_vs_sector?.narrative },
    report: {
      company_structure: truncateStr(rep.company_structure, 320),
      employee_experience: truncateStr(rep.employee_experience, 320),
      career_opportunities: truncateStr(rep.career_opportunities, 320),
      sector_position: truncateStr(rep.sector_position, 320),
      one_liner_value: rep.one_liner_value,
      preparation_intro: rep.preparation_intro,
      preparation_steps: (rep.preparation_steps || []).slice(0, 1),
    },
  };
}

export async function buildCompanyIntelligenceLayer({ extracted, cvText, jobDescription, lang }) {
  const langNorm = lang === "tr" ? "tr" : "en";
  const company = extracted?.company_name || "";
  const sectorLabel = extracted?.sector_inferred || extracted?.mapped_sector || "";

  let companySearch = { insight: "", tone: "neutral", news_snippets: 0, culture_snippets: 0, trend_snippets: 0 };
  let sectorTrends = {
    trending_skills: [],
    declining_skills: [],
    emerging_roles: [],
    key_insight: "",
    source_summary: "",
  };
  let cvComparison = { matched_trending: [], missing_trending: [], narrative: "" };

  try {
    if (process.env.TAVILY_API_KEY && (company || sectorLabel)) {
      companySearch = await searchCompany(company, sectorLabel, langNorm);
    }
  } catch (e) {
    console.warn("[buildCompanyIntelligenceLayer] searchCompany", e?.message || e);
  }

  try {
    if (process.env.TAVILY_API_KEY && sectorLabel) {
      sectorTrends = await searchSectorTrends(sectorLabel, langNorm);
    }
  } catch (e) {
    console.warn("[buildCompanyIntelligenceLayer] searchSectorTrends", e?.message || e);
  }

  try {
    if (sectorTrends.trending_skills?.length && cvText) {
      cvComparison = await compareCvToSectorTrends(cvText, sectorTrends.trending_skills, langNorm);
    }
  } catch (e) {
    console.warn("[buildCompanyIntelligenceLayer] compareCv", e?.message || e);
  }

  const reportCard = await buildCompanyIntelligenceReport({
    extracted,
    companySearch,
    sectorTrends,
    cvComparison,
    lang: langNorm,
  });

  return {
    extracted,
    company_search: companySearch,
    sector_trends: sectorTrends,
    cv_vs_sector: cvComparison,
    report: reportCard,
  };
}
