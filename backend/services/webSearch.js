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

/** Groq system prefix: single output language. */
function systemLangDirective(lang) {
  return lang === "tr"
    ? "Tüm yanıtlarını YALNIZCA Türkçe olarak ver."
    : "You must respond ONLY in English. Every single word must be in English.";
}

function buildSystemPrompt(baseInstruction, lang) {
  return `${systemLangDirective(lang)}\n\n${baseInstruction}`;
}

async function summarizeInsights(prompt, lang) {
  const isTr = lang === "tr";
  const base = isTr
    ? "Sen bir iş analisti asistanısın. Sadece verilen arama özetlerinden çıkarım yap; uydurma. Çıktı JSON."
    : "You are a workplace research assistant. Infer only from provided snippets; do not invent. JSON only.";
  const content = await openaiChat({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(base, lang),
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
        content: buildSystemPrompt("You compare CV evidence to a skill list. JSON only.", lang),
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

const TECH_HINT_RE =
  /\b(React\.?js|React|Vue\.?js|Angular|Node\.?js|TypeScript|JavaScript|Python|Java\b|Kotlin|Swift|\bGo\b|Rust|C\+\+|C#|\.NET|PHP|Ruby|Rails|Django|Flask|FastAPI|Spring|Kubernetes|Docker|AWS|GCP|Azure|Terraform|Ansible|CI\/CD|Jenkins|GitLab|PostgreSQL|MySQL|MongoDB|Redis|Kafka|Elasticsearch|GraphQL|\bREST\b|Salesforce|SAP|Snowflake|Databricks|Power BI|Tableau|Machine Learning|\bML\b|\bAI\b|LLM|TensorFlow|PyTorch)\b/gi;

const BENEFIT_LINE_RE =
  /\b(health|dental|vision|insurance|401k|pension|pto|paid time off|paid leave|vacation|unlimited pto|stock options|equity|rsu|bonus|gym|fitness|wellness|snacks|meal|lunch|parental leave|sabbatical|learning budget|training budget|home office|stipend|commuter|transport|allowance)\b/i;

function extractTechHintsFromJd(jd) {
  const s = String(jd || "");
  const seen = new Map();
  let m;
  const re = new RegExp(TECH_HINT_RE.source, "gi");
  while ((m = re.exec(s)) !== null) {
    const raw = m[0].trim();
    const key = raw.toLowerCase();
    if (!seen.has(key)) seen.set(key, raw);
  }
  return [...seen.values()].slice(0, 15);
}

function extractBenefitSnippets(jd, max = 5) {
  const text = String(jd || "");
  const parts = text.split(/(?<=[.!?\n])\s+/);
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (t.length < 12 || t.length > 220) continue;
    if (BENEFIT_LINE_RE.test(t)) out.push(t.replace(/\s+/g, " "));
    if (out.length >= max) break;
  }
  return out;
}

function formatCompanyTypeLabel(raw, isTr) {
  const r = String(raw || "unknown").toLowerCase();
  if (isTr) {
    const tr = {
      startup: "startup",
      scaleup: "ölçeklenen şirket",
      enterprise: "büyük kurumsal organizasyon",
      big4: "Big Four benzeri profesyonel hizmet firması",
      bigtech: "büyük teknoloji şirketi",
      unknown: "kuruluş",
    };
    return tr[r] || tr.unknown;
  }
  const en = {
    startup: "startup",
    scaleup: "scale-up",
    enterprise: "large enterprise",
    big4: "Big Four–style professional services firm",
    bigtech: "large technology company",
    unknown: "organization",
  };
  return en[r] || en.unknown;
}

function stripLimitedDataPhrases(s) {
  return String(s || "")
    .replace(/\bLimited public data available\.?\s*/gi, "")
    .replace(/Kamuoyunda sınırlı veri[^.!?]*[.!?]?\s*/gi, "")
    .replace(/\bsınırlı veri mevcut\.?\s*/gi, "")
    .trim();
}

function shouldApplyJdFallbackToField(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  const low = t.toLowerCase();
  if (low.includes("limited public data available")) return true;
  if (low.includes("kamuoyunda sınırlı veri") || low.includes("sınırlı veri mevcut")) return true;
  return false;
}

function mergeFieldWithJdFallback(modelText, jdBlock) {
  const cleaned = stripLimitedDataPhrases(modelText);
  if (!cleaned) return jdBlock;
  return `${cleaned}\n\n${jdBlock}`.trim();
}

function buildJdCompanyOverviewFallback(extracted, jobDescription, isTr) {
  const ex = extracted || {};
  const jd = String(jobDescription || "").trim();
  const name = String(ex.company_name || "").trim();
  const sector = String(ex.sector_inferred || ex.mapped_sector || "").trim();
  const sectorDisp = sector || (isTr ? "genel sektör" : "general sector");
  const ctype = formatCompanyTypeLabel(ex.company_type_estimate, isTr);
  const tech = extractTechHintsFromJd(jd);

  const nameLine = name
    ? isTr
      ? `Şirket: ${name}.`
      : `Company: ${name}.`
    : isTr
      ? "Şirket adı ilanda açık değil."
      : "Company name not stated in the posting.";

  const sectorLine = isTr
    ? `İlandan anlaşılan sektör: ${sectorDisp}.`
    : `Sector inferred from the posting: ${sectorDisp}.`;

  const typeLine = isTr
    ? `İş tanımına göre bu, ${sectorDisp} alanında bir ${ctype} gibi görünüyor.`
    : `Based on the job description, this appears to be a ${ctype} in ${sectorDisp}.`;

  const techLine = tech.length
    ? isTr
      ? `Pozisyonun öne çıkardığı araç veya teknolojiler: ${tech.join(", ")}.`
      : `Tools and technologies emphasized for this role: ${tech.join(", ")}.`
    : isTr
      ? "İlanda net bir teknoloji yığını listesi çıkarılamadı; gereksinimler metninde geçen ifadelere bakın."
      : "No clear technology stack list was extracted; refer to requirement wording in the posting.";

  return [nameLine, sectorLine, typeLine, techLine].join("\n");
}

function buildJdEmployeeExperienceFallback(jobDescription, isTr) {
  const jd = String(jobDescription || "").trim();
  const prefix = isTr ? "İlan metnine göre sinyaller:" : "Based on job posting signals:";
  const signals = [];

  if (/\bhybrid\b/i.test(jd)) {
    signals.push(isTr ? "Hibrit çalışma geçiyor." : "Posting mentions hybrid work.");
  } else if (/\b(remote|work from home|wfh|fully remote|uzaktan)\b/i.test(jd)) {
    signals.push(isTr ? "Uzaktan çalışma / WFH ifadeleri geçiyor." : "Remote or work-from-home language appears.");
  } else if (/\b(on-?site|in-?office|office-?based|ofiste)\b/i.test(jd)) {
    signals.push(isTr ? "Ofis / onsite vurgusu var." : "On-site or office-based work is referenced.");
  }

  if (/\b(startup|scale-?up|early-?stage)\b/i.test(jd)) {
    signals.push(isTr ? "Startup veya scale-up tonuna yakın ifadeler var." : "Wording suggests startup or scale-up context.");
  }
  if (/\b(enterprise|Fortune|multinational|global leader|kurumsal)\b/i.test(jd)) {
    signals.push(isTr ? "Kurumsal veya büyük ölçek diline işaretler var." : "Language points to corporate or large-enterprise context.");
  }

  if (/\b(fast-?paced|rapid|dynamic environment|yüksek tempo)\b/i.test(jd)) {
    signals.push(isTr ? "Hızlı tempolu ortam vurgusu." : "Fast-paced environment is emphasized.");
  }
  if (/\b(structured|process-?driven|well-?defined|governance|süreç)\b/i.test(jd)) {
    signals.push(isTr ? "Yapılandırılmış süreç / çerçeve vurgusu." : "Structured or process-driven signals appear.");
  }

  const benefits = extractBenefitSnippets(jd, 5);
  let benefitBlock = "";
  if (benefits.length) {
    benefitBlock = isTr
      ? `\nİlanda geçen yan hak / fayda ifadeleri: ${benefits.join("; ")}.`
      : `\nBenefits or perks mentioned in the posting: ${benefits.join("; ")}.`;
  }

  if (!signals.length && !benefits.length) {
    const tail = isTr
      ? "İlan metninden belirgin kültür veya yan hak cümlesi çıkarılamadı; beklentileri rol gereksinimleri ve şirket özetiyle ilişkilendirin."
      : "No strong culture or benefits phrases were detected in the posting; align expectations with stated role requirements and the company overview.";
    return `${prefix}\n${tail}`;
  }

  const bullet = signals.map((x) => `- ${x}`).join("\n");
  return `${prefix}\n${bullet}${benefitBlock}`;
}

function enrichReportWithJdFallbacks(report, extracted, jobDescription, lang) {
  const isTr = lang === "tr";
  const r = { ...(report || {}) };
  const co = String(r.company_structure || "").trim();
  const em = String(r.employee_experience || "").trim();

  if (shouldApplyJdFallbackToField(co)) {
    const jdCo = buildJdCompanyOverviewFallback(extracted, jobDescription, isTr);
    r.company_structure = mergeFieldWithJdFallback(co, jdCo);
  }

  if (shouldApplyJdFallbackToField(em)) {
    const jdEm = buildJdEmployeeExperienceFallback(jobDescription, isTr);
    r.employee_experience = mergeFieldWithJdFallback(em, jdEm);
  }

  return r;
}

/**
 * Full report card sections + preparation box (GPT), with graceful degradation if search empty.
 */
export async function buildCompanyIntelligenceReport({
  extracted,
  companySearch,
  sectorTrends,
  cvComparison,
  jobDescription = "",
  lang = "en",
}) {
  const isTr = lang === "tr";
  const ex = extracted || {};
  const jdExcerpt = String(jobDescription || "").trim().slice(0, 8000);
  const bundle = JSON.stringify({
    extracted: ex,
    companySearch,
    sectorTrends,
    cvComparison,
    jobDescription_excerpt: jdExcerpt,
  });

  const qualityTr = `
Alan kuralları (her biri için ayrı ayrı uy):
- company_structure: Somut ol. Gerçek iş kolları, bilinen ürünler, pazar konumu ve kanıtlanabilir gerçekleri yaz. "Büyüme sinyalleri gösteriyor" gibi belirsiz ifadelerden kaçın. Veri sınırlıysa bunu dürüstçe söyle.
- employee_experience: Arama sonuçlarına dayan; kültür, yan haklar veya çalışan yorumları hakkında bilinen somut gerçekleri yaz. Hiçbir şey yoksa genel laflar etme; "Kamuoyunda sınırlı veri mevcut" de.
- career_opportunities: Somut ol. Burada çalışmak hangi becerileri geliştirir? Hangi kapıları açar? Bu rolden gerçekçi kariyer yolu ne? Uluslararası maruziyetten ancak kanıt varsa bahset.
- sector_position: Gerçek rakipleri isimlendir. Sektörün büyüdüğünü, durağan olduğunu veya gerilediğini bir gerekçeyle belirt. Somut ol.`;

  const qualityEn = `
Field rules (apply to each string separately):
- company_structure: Be specific. Mention actual business lines, known products, market position with facts. Avoid vague phrases like "shows growth signals". If data is limited, say so honestly.
- employee_experience: Based on search results, mention specific known facts about culture, benefits, or employee reviews. If nothing found, say "Limited public data available" instead of making generic statements.
- career_opportunities: Be concrete. What skills does working here build? What doors does it open? What is the realistic career path from this role? Mention international exposure only if there is evidence of it.
- sector_position: Name actual competitors. State whether sector is growing, stable, or declining with a reason. Be specific.`;

  const prompt = isTr
    ? `Aşağıdaki verilerle şirket/sektör raporu üret. Web verisi zayıfsa yalnızca JD çıkarımına dayan; uydurma.
${qualityTr}

${bundle}

JSON formatı:
{
  "company_structure": "<şirket genel görünümü — yukarıdaki kurallara uy>",
  "employee_experience": "<çalışan deneyimi — yukarıdaki kurallara uy>",
  "career_opportunities": "<kariyer üstü — yukarıdaki kurallara uy>",
  "sector_position": "<sektör konumu — yukarıdaki kurallara uy>",
  "one_liner_value": "Bu şirket kariyerinize şunu katar: ...",
  "preparation_steps": [
    { "skill": "", "resource_path": "", "weeks_estimate": 2 }
  ],
  "preparation_intro": "Bu role hazırlanmak için önerilen adımlar:"
}
Maksimum 2 preparation_steps. Hafta tahmini gerçekçi olsun.`
    : `Build a structured employer/sector report from the data below. If web data is thin, rely on JD extraction only; do not invent.
${qualityEn}

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

  const reportSystemBase = isTr
    ? "Yapılandırılmış işveren/sektör raporu üretiyorsun. Yalnızca geçerli JSON; kullanıcı mesajındaki alan kurallarına uy."
    : "You produce a structured employer/sector report. Valid JSON only; follow the per-field rules in the user message.";

  const content = await openaiChat({
    model: "llama-3.3-70b-versatile",
    temperature: 0.25,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(reportSystemBase, lang) },
      { role: "user", content: prompt },
    ],
  });
  const parsed = parseModelJson(content) || {};
  const jdFull = String(jobDescription || "").trim();
  return enrichReportWithJdFallbacks(parsed, ex, jdFull, lang);
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

export async function buildCompanyIntelligenceLayer({ extracted, cvText, jobDescription, lang = "en" }) {
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
    jobDescription: String(jobDescription || "").trim(),
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
