/**
 * Canonical career roles: stable `value` keys with TR/EN display labels.
 */

function role(value, tr, en) {
  return { value, tr, en };
}

const ROLE_LIST = [
  // Technology
  role("product_manager", "Ürün Yöneticisi", "Product Manager"),
  role("project_manager", "Proje Yöneticisi", "Project Manager"),
  role("product_operations", "Ürün Operasyonları", "Product Operations"),
  role("business_analyst", "İş Analisti", "Business Analyst"),
  role("data_analyst", "Veri Analisti", "Data Analyst"),
  role("growth_manager", "Büyüme Yöneticisi", "Growth Manager"),
  role("software_engineer", "Yazılım Mühendisi", "Software Engineer"),
  role("ui_ux_designer", "UI/UX Tasarımcı", "UI/UX Designer"),
  role("solutions_architect", "Çözüm Mimarı", "Solutions Architect"),
  role("customer_success", "Müşteri Başarısı", "Customer Success"),
  // Finance
  role("investment_analyst", "Yatırım Analisti", "Investment Analyst"),
  role("financial_analyst", "Finansal Analist", "Financial Analyst"),
  role("risk_analyst", "Risk Analisti", "Risk Analyst"),
  role("fintech_product_manager", "Fintek Ürün Yöneticisi", "Fintech Product Manager"),
  role("corporate_finance", "Kurumsal Finans", "Corporate Finance"),
  role("strategy_analyst", "Strateji Analisti", "Strategy Analyst"),
  // Healthcare
  role("healthcare_management", "Sağlık Yönetimi", "Healthcare Management"),
  role("hospital_operations", "Hastane Operasyonları", "Hospital Operations"),
  role("clinical_operations", "Klinik Operasyonlar", "Clinical Operations"),
  role("health_informatics", "Sağlık Bilişimi", "Health Informatics"),
  role("healthcare_data_analyst", "Sağlık Veri Analisti", "Healthcare Data Analyst"),
  role("public_health", "Halk Sağlığı", "Public Health"),
  role("medical_sales", "Medikal Satış", "Medical Sales"),
  // Consulting
  role("strategy_consulting", "Strateji Danışmanlığı", "Strategy Consulting"),
  role("management_consulting", "Yönetim Danışmanlığı", "Management Consulting"),
  role("project_management", "Proje Yönetimi", "Project Management"),
  role("operations_consulting", "Operasyon Danışmanlığı", "Operations Consulting"),
  role("transformation_consulting", "Dönüşüm Danışmanlığı", "Transformation Consulting"),
  // Marketing
  role("growth", "Büyüme", "Growth"),
  role("digital_marketing", "Dijital Pazarlama", "Digital Marketing"),
  role("brand_management", "Marka Yönetimi", "Brand Management"),
  role("performance_marketing", "Performans Pazarlama", "Performance Marketing"),
  role("social_media", "Sosyal Medya", "Social Media"),
  role("crm", "CRM", "CRM"),
  role("product_marketing", "Ürün Pazarlaması", "Product Marketing"),
  role("market_research", "Pazar Araştırması", "Market Research"),
  role("content_strategy", "İçerik Stratejisi", "Content Strategy"),
  // Education
  role("edtech", "Eğitim Teknolojileri", "EdTech"),
  role("academic_operations", "Akademik Operasyonlar", "Academic Operations"),
  role("student_success", "Öğrenci Başarısı", "Student Success"),
  role("program_management", "Program Yönetimi", "Program Management"),
  role("education_consulting", "Eğitim Danışmanlığı", "Education Consulting"),
  role("content_development", "İçerik Geliştirme", "Content Development"),
  role("instructional_design", "Öğretim Tasarımı", "Instructional Design"),
  // Government
  role("policy_analyst", "Politika Analisti", "Policy Analyst"),
  role("public_administration", "Kamu Yönetimi", "Public Administration"),
  role("government_digital", "Dijital Dönüşüm", "Digital Transformation"),
  role("administrative_affairs", "İdari İşler", "Administrative Affairs"),
  // Logistics
  role("supply_chain", "Tedarik Zinciri", "Supply Chain"),
  role("logistics_operations", "Lojistik Operasyonları", "Logistics Operations"),
  role("procurement", "Satın Alma", "Procurement"),
  role("warehouse_operations", "Depo Operasyonları", "Warehouse Operations"),
  role("transport_planning", "Ulaşım Planlama", "Transport Planning"),
  role("operations_analyst", "Operasyon Analisti", "Operations Analyst"),
  // Gaming
  role("game_product_management", "Oyun Ürün Yönetimi", "Game Product Management"),
  role("game_design", "Oyun Tasarımı", "Game Design"),
  role("community_management", "Topluluk Yönetimi", "Community Management"),
  role("user_research", "Kullanıcı Araştırması", "User Research"),
  role("liveops", "Canlı Operasyon", "LiveOps"),
  role("qa_tester", "Kalite Kontrol", "QA Tester"),
  role("game_marketing", "Oyun Pazarlaması", "Game Marketing"),
  // E-commerce
  role("ecommerce_operations", "E-ticaret Operasyonları", "E-commerce Operations"),
  role("marketplace_management", "Marketplace Yönetimi", "Marketplace Management"),
  role("category_management", "Kategori Yönetimi", "Category Management"),
  role("sales_operations", "Satış Operasyonları", "Sales Operations"),
  // AI
  role("ai_product_management", "AI Ürün Yönetimi", "AI Product Management"),
  role("ai_operations", "AI Operasyonları", "AI Operations"),
  role("prompt_engineering", "Prompt Mühendisliği", "Prompt Engineering"),
  role("machine_learning", "Makine Öğrenimi", "Machine Learning"),
  role("ai_strategy", "AI Stratejisi", "AI Strategy"),
  role("automation_specialist", "Otomasyon Uzmanı", "Automation Specialist"),
  role("ai_business_analyst", "AI İş Analisti", "AI Business Analyst"),
  // Law
  role("legal_internship", "Hukuk Stajı", "Legal Internship"),
  role("legal_operations", "Legal Operations", "Legal Operations"),
  role("compliance", "Uyum/Compliance", "Compliance"),
  role("contract_management", "Sözleşme Yönetimi", "Contract Management"),
  role("kvkk_gdpr", "KVKK/GDPR", "KVKK/GDPR"),
  role("regulation_analyst", "Regülasyon Analisti", "Regulation Analyst"),
  // Media
  role("content_creation", "İçerik Üretimi", "Content Creation"),
  role("editorial", "Editörlük", "Editorial"),
  role("video_production", "Video Prodüksiyon", "Video Production"),
  role("brand_communications", "Marka İletişimi", "Brand Communications"),
  role("pr", "PR", "PR"),
  // HR
  role("talent_acquisition", "İşe Alım", "Talent Acquisition"),
  role("hr_operations", "İK Operasyonları", "HR Operations"),
  role("people_analytics", "İK Analitiği", "People Analytics"),
  role("employer_branding", "İşveren Markası", "Employer Branding"),
  role("learning_development", "Öğrenme ve Gelişim", "Learning & Development"),
  role("organizational_development", "Organizasyonel Gelişim", "Organizational Development"),
  // Tourism
  role("hotel_operations", "Otel Operasyonları", "Hotel Operations"),
  role("guest_relations", "Misafir İlişkileri", "Guest Relations"),
  role("revenue_management", "Gelir Yönetimi", "Revenue Management"),
  role("tourism_marketing", "Turizm Pazarlaması", "Tourism Marketing"),
  role("event_management", "Etkinlik Yönetimi", "Event Management"),
  // Retail
  role("store_operations", "Mağaza Operasyonları", "Store Operations"),
  role("sales", "Satış", "Sales"),
  role("retail_ecommerce", "E-ticaret", "E-commerce"),
  role("retail_supply", "Tedarik", "Supply"),
  // Operations (sector)
  role("operations_management", "Operasyon Yönetimi", "Operations Management"),
  role("process_improvement", "Süreç İyileştirme", "Process Improvement"),
  role("business_analysis", "İş Analizi", "Business Analysis"),
  role("quality_management", "Kalite Yönetimi", "Quality Management"),
  role("efficiency_analysis", "Verimlilik Analizi", "Efficiency Analysis"),
  // Entrepreneurship
  role("founder", "Kurucu", "Founder"),
  role("business_development", "İş Geliştirme", "Business Development"),
  role("fundraising", "Yatırım Toplama", "Fundraising"),
  role("general_operations", "Operasyon", "Operations"),
  role("general_strategy", "Strateji", "Strategy"),
  role("general_marketing", "Pazarlama", "Marketing"),
  role("general_consulting", "Danışmanlık", "Consulting"),
];

export const ROLES = Object.fromEntries(ROLE_LIST.map((r) => [r.value, r]));

/** Industry → canonical role value keys */
export const ROLES_BY_INDUSTRY = {
  technology: [
    "product_manager", "associate_product_manager", "project_manager", "product_operations", "business_analyst", "data_analyst",
    "growth_manager", "software_engineer", "ui_ux_designer", "ux_researcher", "solutions_architect", "customer_success",
  ],
  finance: [
    "investment_analyst", "financial_analyst", "risk_analyst", "fintech_product_manager",
    "corporate_finance", "strategy_analyst",
  ],
  healthcare: [
    "healthcare_management", "hospital_operations", "clinical_operations", "health_informatics",
    "healthcare_data_analyst", "business_analyst", "project_manager", "operations_analyst",
    "public_health", "medical_sales",
  ],
  consulting: [
    "strategy_consulting", "management_consulting", "business_analyst", "project_management",
    "operations_consulting", "transformation_consulting", "data_analyst",
  ],
  marketing: [
    "growth", "digital_marketing", "brand_management", "performance_marketing", "social_media", "crm",
    "product_marketing", "market_research", "content_strategy",
  ],
  education: [
    "edtech", "academic_operations", "student_success", "program_management",
    "education_consulting", "content_development", "instructional_design",
  ],
  government: [
    "policy_analyst", "public_administration", "project_management", "data_analyst", "general_operations",
    "government_digital", "administrative_affairs",
  ],
  logistics: [
    "supply_chain", "logistics_operations", "procurement", "warehouse_operations",
    "transport_planning", "operations_analyst", "product_operations",
  ],
  gaming: [
    "game_product_management", "game_design", "community_management", "user_research",
    "liveops", "qa_tester", "growth", "game_marketing",
  ],
  ecommerce: [
    "ecommerce_operations", "marketplace_management", "growth", "product_manager",
    "category_management", "crm", "data_analyst", "sales_operations",
  ],
  ai: [
    "ai_product_management", "ai_operations", "prompt_engineering", "data_analyst",
    "machine_learning", "ai_strategy", "automation_specialist", "ai_business_analyst",
  ],
  law: [
    "legal_internship", "legal_operations", "compliance", "contract_management",
    "kvkk_gdpr", "regulation_analyst",
  ],
  media: [
    "content_creation", "social_media", "editorial", "video_production", "brand_communications",
    "pr", "community_management",
  ],
  hr: [
    "talent_acquisition", "hr_operations", "people_analytics", "employer_branding",
    "learning_development", "organizational_development",
  ],
  tourism: [
    "hotel_operations", "guest_relations", "revenue_management", "tourism_marketing",
    "event_management", "general_operations",
  ],
  retail: [
    "store_operations", "category_management", "sales", "crm", "retail_ecommerce", "retail_supply",
    "operations_analyst",
  ],
  operations: [
    "operations_management", "process_improvement", "project_management", "business_analysis",
    "quality_management", "efficiency_analysis",
  ],
  entrepreneurship: [
    "founder", "founders_associate", "startup_operations", "growth", "product_manager", "sales", "business_development",
    "general_strategy", "general_operations", "fundraising",
  ],
};

export const FALLBACK_ROLE_VALUES = [
  "project_management",
  "business_analyst",
  "general_operations",
  "sales",
  "general_marketing",
  "data_analyst",
  "general_strategy",
  "general_consulting",
];

ROLES_BY_INDUSTRY.other = FALLBACK_ROLE_VALUES;

const LEGACY_ROLE_ALIASES = {
  "Strategy & Operations Intern": "strategy_operations_intern",
  "Strategy & Operations": "strategy_operations_intern",
  "Associate Product Manager": "associate_product_manager",
  "Growth Analyst": "growth_analyst",
  "Growth Associate": "growth_associate",
  "Marketing Analyst": "marketing_analyst",
  "Founder's Associate": "founders_associate",
  "Startup Operations": "startup_operations",
  "Sales Development Representative": "sales_development_representative",
  "UX Researcher": "ux_researcher",
  "Product Manager": "product_manager",
  "Project Manager": "project_manager",
  "Product Operations": "product_operations",
  "Business Analyst": "business_analyst",
  "Data Analyst": "data_analyst",
  "Growth Manager": "growth_manager",
  "Software Engineer": "software_engineer",
  "UI/UX Designer": "ui_ux_designer",
  "Solutions Architect": "solutions_architect",
  "Customer Success": "customer_success",
  "Investment Analyst": "investment_analyst",
  "Financial Analyst": "financial_analyst",
  "Risk Analyst": "risk_analyst",
  "Fintech Product Manager": "fintech_product_manager",
  "Corporate Finance": "corporate_finance",
  "Strategy Analyst": "strategy_analyst",
  "Healthcare Management": "healthcare_management",
  "Hospital Operations": "hospital_operations",
  "Clinical Operations": "clinical_operations",
  "Health Informatics": "health_informatics",
  "Healthcare Data Analyst": "healthcare_data_analyst",
  "Public Health": "public_health",
  "Medical Sales": "medical_sales",
  "Strateji Danışmanlığı": "strategy_consulting",
  "Yönetim Danışmanlığı": "management_consulting",
  "İş Analisti": "business_analyst",
  "Proje Yönetimi": "project_management",
  "Operasyon Danışmanlığı": "operations_consulting",
  "Dönüşüm Danışmanlığı": "transformation_consulting",
  "Veri Analisti": "data_analyst",
  "Dijital Pazarlama": "digital_marketing",
  "Marka Yönetimi": "brand_management",
  "Performans Pazarlama": "performance_marketing",
  "Sosyal Medya": "social_media",
  "Ürün Pazarlaması": "product_marketing",
  "Pazar Araştırması": "market_research",
  "İçerik Stratejisi": "content_strategy",
  "Eğitim Teknolojileri": "edtech",
  "Akademik Operasyonlar": "academic_operations",
  "Öğrenci Başarısı": "student_success",
  "Program Yönetimi": "program_management",
  "Eğitim Danışmanlığı": "education_consulting",
  "İçerik Geliştirme": "content_development",
  "Öğretim Tasarımı": "instructional_design",
  "Politika Analisti": "policy_analyst",
  "Kamu Yönetimi": "public_administration",
  "Operasyon": "general_operations",
  "Dijital Dönüşüm": "government_digital",
  "İdari İşler": "administrative_affairs",
  "Tedarik Zinciri": "supply_chain",
  "Lojistik Operasyonları": "logistics_operations",
  "Satın Alma": "procurement",
  "Depo Operasyonları": "warehouse_operations",
  "Ulaşım Planlama": "transport_planning",
  "Operasyon Analisti": "operations_analyst",
  "Game Product Management": "game_product_management",
  "Oyun Tasarımı": "game_design",
  "User Research": "user_research",
  "Oyun Pazarlaması": "game_marketing",
  "E-ticaret Operasyonları": "ecommerce_operations",
  "Marketplace Yönetimi": "marketplace_management",
  "Ürün Yönetimi": "product_manager",
  "Kategori Yönetimi": "category_management",
  "Satış Operasyonları": "sales_operations",
  "AI Product Management": "ai_product_management",
  "AI Operations": "ai_operations",
  "Prompt Engineering": "prompt_engineering",
  "Machine Learning": "machine_learning",
  "AI Strategy": "ai_strategy",
  "Automation Specialist": "automation_specialist",
  "AI Business Analyst": "ai_business_analyst",
  "Hukuk Stajı": "legal_internship",
  "Legal Operations": "legal_operations",
  "Uyum/Compliance": "compliance",
  "Sözleşme Yönetimi": "contract_management",
  "KVKK/GDPR": "kvkk_gdpr",
  "Regülasyon Analisti": "regulation_analyst",
  "İçerik Üretimi": "content_creation",
  "Editörlük": "editorial",
  "Video Prodüksiyon": "video_production",
  "Marka İletişimi": "brand_communications",
  "Organizasyonel Gelişim": "organizational_development",
  "Otel Operasyonları": "hotel_operations",
  "Misafir İlişkileri": "guest_relations",
  "Turizm Pazarlaması": "tourism_marketing",
  "Etkinlik Yönetimi": "event_management",
  "Mağaza Operasyonları": "store_operations",
  "Satış": "sales",
  "Tedarik": "retail_supply",
  "Operasyon Yönetimi": "operations_management",
  "Süreç İyileştirme": "process_improvement",
  "İş Analizi": "business_analysis",
  "Kalite Yönetimi": "quality_management",
  "Verimlilik Analizi": "efficiency_analysis",
  "İş Geliştirme": "business_development",
  "Strateji": "general_strategy",
  "Pazarlama": "general_marketing",
  "Danışmanlık": "general_consulting",
  "Veri Analizi": "data_analyst",
  "AI Product Manager": "ai_product_management",
  "Startup Founder": "founder",
  "Management Consultant": "management_consulting",
  "Corporate Strategy": "strategy_analyst",
  "Operations Manager": "operations_management",
  "Program Manager": "program_management",
  "Chief of Staff": "general_operations",
  "UX Designer": "ui_ux_designer",
  "Brand Manager": "brand_management",
  "Content Strategist": "content_strategy",
  "Team Lead": "product_manager",
  "Product Lead": "product_manager",
  "General Manager": "operations_management",
};

for (const def of ROLE_LIST) {
  LEGACY_ROLE_ALIASES[def.en] = def.value;
  LEGACY_ROLE_ALIASES[def.tr] = def.value;
  LEGACY_ROLE_ALIASES[def.value] = def.value;
}

export function isTrLang(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

export function normalizeRoleValue(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (ROLES[raw]) return raw;
  if (LEGACY_ROLE_ALIASES[raw]) return LEGACY_ROLE_ALIASES[raw];
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (ROLES[slug]) return slug;
  return raw;
}

export function getRoleLabel(valueOrLegacy, lang = "TR") {
  const value = normalizeRoleValue(valueOrLegacy);
  const row = ROLES[value];
  if (!row) return valueOrLegacy || "";
  return isTrLang(lang) ? row.tr : row.en;
}

export function localizeRoles(roles = [], lang = "TR") {
  return (roles || []).map((r) => getRoleLabel(r, lang)).filter(Boolean);
}

export function normalizeRoleList(roles = []) {
  return [...new Set((roles || []).map(normalizeRoleValue).filter(Boolean))];
}

export function flattenAllRoleValues() {
  return [
    ...new Set([
      ...Object.values(ROLES_BY_INDUSTRY).flat(),
      ...FALLBACK_ROLE_VALUES,
    ]),
  ];
}

/** Merge role values from multiple industries (order = first-seen priority). */
export function getMergedRolesForIndustries(industryIds = []) {
  const ids = (industryIds || []).filter((id) => ROLES_BY_INDUSTRY[id]);
  if (!ids.length) return [...FALLBACK_ROLE_VALUES];
  const merged = [];
  const seen = new Set();
  for (const id of ids) {
    for (const roleValue of ROLES_BY_INDUSTRY[id]) {
      if (!seen.has(roleValue)) {
        seen.add(roleValue);
        merged.push(roleValue);
      }
    }
  }
  return merged.length ? merged : [...FALLBACK_ROLE_VALUES];
}

const DEFAULT_TOP_ROLE_COUNT = 10;

/**
 * Top N roles for onboarding chips (merged industries, stable order).
 */
export function getTopRolesForIndustries(industryIds = [], limit = DEFAULT_TOP_ROLE_COUNT) {
  return getMergedRolesForIndustries(industryIds).slice(0, limit);
}

export function getRemainingRolesForIndustries(industryIds = [], skip = DEFAULT_TOP_ROLE_COUNT) {
  return getMergedRolesForIndustries(industryIds).slice(skip);
}

/** Ordered priority roles for Career GPS / OS */
export function getPrioritizedRoles(goals = {}) {
  const ranked = normalizeRoleList([
    goals.primaryRole,
    goals.secondaryRole,
    goals.tertiaryRole,
  ]);
  const pool = normalizeRoleList(goals.targetRoles || goals.roleIds || []);
  return [...new Set([...ranked, ...pool])];
}
