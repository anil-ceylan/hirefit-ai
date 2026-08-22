export const ROLE_TAXONOMY = [
  {
    id: "product_management",
    tr: "Ürün Yönetimi",
    en: "Product Management",
    patterns: [
      /product|ürün|urun|pdm|\bpm\b/i,
      /backlog|prd|user stor(?:y|ies)|kullanıcı hikayesi|kullanici hikayesi/i,
      /roadmap|user flow|kullanıcı akışı|kullanici akisi|product strategy/i,
    ],
  },
  {
    id: "product_strategy",
    tr: "Ürün Stratejisi",
    en: "Product Strategy",
    patterns: [
      /product strategy|ürün stratejisi|urun stratejisi|market sizing|competitive|positioning|pricing/i,
      /roadmap|prioritization|önceliklendirme|onceliklendirme/i,
    ],
  },
  {
    id: "growth",
    tr: "Growth / Büyüme",
    en: "Growth",
    patterns: [/growth|büyüme|buyume|activation|retention|funnel|conversion|dönüşüm|donusum|acquisition/i],
  },
  {
    id: "growth_strategy",
    tr: "Growth Strategy",
    en: "Growth Strategy",
    patterns: [/growth strategy|büyüme stratejisi|buyume stratejisi|go[-\s]?to[-\s]?market|gtm strategy|acquisition strategy/i],
  },
  {
    id: "business_analysis",
    tr: "İş Analizi",
    en: "Business Analysis",
    patterns: [/business analys|iş analiz|is analiz|requirement|gereksinim|process mapping|raporlama/i],
  },
  {
    id: "strategy_operations",
    tr: "Strateji & Operasyon",
    en: "Strategy & Operations",
    patterns: [/strategy|strateji|operations|operasyon|process improvement|süreç|surec|execution tracking/i],
  },
  {
    id: "gtm_operations",
    tr: "GTM Operasyonları",
    en: "GTM Operations",
    patterns: [/gtm|go[-\s]?to[-\s]?market|revenue operations|revops|sales ops|pipeline|crm/i],
  },
  {
    id: "ai_product_operations",
    tr: "AI Product Operations",
    en: "AI Product Operations",
    patterns: [/ai product operations|ai ops|llm|prompt|automation|workflow automation|yapay zeka|ai product/i],
  },
  {
    id: "marketing",
    tr: "Pazarlama",
    en: "Marketing",
    patterns: [/marketing|pazarlama|campaign|kampanya|landing page|linkedin|instagram|seo|content|içerik|icerik/i],
  },
  {
    id: "data_analysis",
    tr: "Veri Analizi",
    en: "Data Analysis",
    patterns: [/data|veri|sql|excel|dashboard|power\s?bi|tableau|trend analysis|analiz|analytics/i],
  },
  {
    id: "business_development",
    tr: "Business Development",
    en: "Business Development",
    patterns: [/business development|bd\b|sales|satış|satis|partnership|ortaklık|ortaklik|lead generation/i],
  },
  {
    id: "project_management",
    tr: "Proje Yönetimi",
    en: "Project Management",
    patterns: [/project management|proje yönet|proje yonet|delivery|stakeholder coordination|paydaş|paydas|takip|coordination/i],
  },
  {
    id: "customer_success",
    tr: "Müşteri Başarısı",
    en: "Customer Success",
    patterns: [/customer success|müşteri başar|musteri basar|account management|onboarding|support|müşteri|musteri/i],
  },
  {
    id: "ux_research",
    tr: "UX Araştırma",
    en: "UX Research",
    patterns: [/ux research|user research|kullanıcı araştır|kullanici arastir|interview|usability|persona/i],
  },
];

const TASK_LIKE_RE =
  /\b(contribute|create|creation|manage|management processes|support|assist|coordinate|track|prepare|write|deliver|execute|improve|optimize|develop)\b/i;

export function roleTaxonomyLabel(id, lang = "EN") {
  const role = ROLE_TAXONOMY.find((x) => x.id === id) || ROLE_TAXONOMY[2];
  return String(lang || "").toUpperCase() === "TR" ? role.tr : role.en;
}

export function normalizeCareerRoleId(rawRole, context = "") {
  const raw = String(rawRole || "");
  const text = `${raw} ${context || ""}`.toLowerCase();
  if (/backlog|prd|user stor(?:y|ies)|roadmap|user flow|product management|ürün yönetimi|urun yonetimi/i.test(raw)) {
    return "product_management";
  }
  if (/product strategy|ürün stratejisi|urun stratejisi/i.test(raw)) return "product_strategy";
  if (/growth strategy|büyüme stratejisi|buyume stratejisi/i.test(raw)) return "growth_strategy";
  if (/gtm operations|gtm operasyon/i.test(raw)) return "gtm_operations";
  if (/ai product operations/i.test(raw)) return "ai_product_operations";
  const priority = [
    "ai_product_operations",
    "product_strategy",
    "growth_strategy",
    "gtm_operations",
    "product_management",
    "strategy_operations",
  ];
  const ordered = [
    ...priority.map((id) => ROLE_TAXONOMY.find((x) => x.id === id)).filter(Boolean),
    ...ROLE_TAXONOMY.filter((x) => !priority.includes(x.id)),
  ];
  for (const role of ordered) {
    if (role.patterns.some((re) => re.test(text))) return role.id;
  }
  return "business_analysis";
}

export function normalizeCareerRoleLabel(rawRole, lang = "EN", context = "") {
  const raw = String(rawRole || "").replace(/\s+/g, " ").trim();
  const role = ROLE_TAXONOMY.find((x) => {
    const target = String(lang || "").toUpperCase() === "TR" ? x.tr : x.en;
    return raw.toLowerCase() === target.toLowerCase();
  });
  if (role && !isTaskLikeRoleLabel(raw)) return roleTaxonomyLabel(role.id, lang);
  return roleTaxonomyLabel(normalizeCareerRoleId(raw, context), lang);
}

export function isTaskLikeRoleLabel(rawRole) {
  const raw = String(rawRole || "").replace(/\s+/g, " ").trim();
  if (!raw) return true;
  if (raw.length > 42 || raw.split(/\s+/).length > 5) return true;
  return TASK_LIKE_RE.test(raw) && !ROLE_TAXONOMY.some((x) => x.patterns.some((re) => re.test(raw)));
}

export function roleProximityBand(score, lang = "EN") {
  const tr = String(lang || "").toUpperCase() === "TR";
  const n = Number.isFinite(Number(score)) ? Math.round(Number(score)) : 0;
  if (n >= 78) return tr ? "Güçlü yakınlık" : "Strong proximity";
  if (n >= 62) return tr ? "Orta yakınlık" : "Medium proximity";
  return tr ? "Düşük yakınlık" : "Low proximity";
}
