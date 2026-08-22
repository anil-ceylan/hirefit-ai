import { ROLES, normalizeRoleValue } from "./roleCatalog.js";

const ROLE_DISPLAY = {
  strategy_operations_intern: {
    en: "Strategy & Operations Intern",
    tr: "Strateji ve Operasyon Stajyeri",
    explanationTr: "Şirketin büyüme, süreç, analiz ve karar alma çalışmalarına destek olan başlangıç seviyesi rol.",
    explanationEn: "An entry-level role supporting growth, process, analysis, and operating decisions.",
    family: "strategy_operations",
    seniority: "intern",
    examplesTr: ["Süreç analizi", "Operasyon takibi", "Pazar ve büyüme araştırması"],
  },
  business_analyst: {
    en: "Business Analyst",
    tr: "İş Analisti",
    explanationTr: "İş problemlerini, süreçleri ve verileri netleştirerek karar almayı kolaylaştıran rol.",
    explanationEn: "A role that clarifies business problems, workflows, and data to support decisions.",
    family: "business",
    seniority: "entry",
  },
  business_analysis: {
    en: "Business Analysis",
    tr: "İş Analizi",
    explanationTr: "Süreç, veri ve iş ihtiyacını yapılandırarak ekiplerin daha net karar almasını sağlar.",
    explanationEn: "Structures process, data, and business needs so teams can make clearer decisions.",
    family: "business",
    seniority: "entry",
  },
  strategy_analyst: {
    en: "Strategy Analyst",
    tr: "Strateji Analisti",
    explanationTr: "Pazar, büyüme ve karar seçeneklerini analiz ederek stratejik kararları destekler.",
    explanationEn: "Supports strategic decisions through market, growth, and option analysis.",
    family: "strategy",
    seniority: "entry",
  },
  product_manager: {
    en: "Product Manager",
    tr: "Ürün Yöneticisi",
    explanationTr: "Kullanıcı problemini, öncelikleri ve ürün kararlarını sahiplenen rol.",
    explanationEn: "Owns user problems, priorities, and product decisions.",
    family: "product",
    seniority: "entry_mid",
  },
  associate_product_manager: {
    en: "Associate Product Manager",
    tr: "Yardımcı Ürün Yöneticisi",
    explanationTr: "Ürün kararları, kullanıcı ihtiyaçları ve roadmap çalışmalarına destek olan başlangıç rolü.",
    explanationEn: "An early product role supporting product decisions, user needs, and roadmap work.",
    family: "product",
    seniority: "entry",
  },
  product_operations: {
    en: "Product Operations",
    tr: "Ürün Operasyonları Uzmanı",
    explanationTr: "Ürün ekiplerinin veri, süreç, kullanıcı geri bildirimi ve operasyonel takibini güçlendirir.",
    explanationEn: "Improves product team workflows, data, user feedback loops, and operating rhythm.",
    family: "product_operations",
    seniority: "entry_mid",
  },
  growth_analyst: {
    en: "Growth Analyst",
    tr: "Büyüme Analisti",
    explanationTr: "Kullanıcı kazanımı, dönüşüm ve büyüme deneylerini veriyle takip eden rol.",
    explanationEn: "Tracks acquisition, conversion, and growth experiments with data.",
    family: "growth",
    seniority: "entry",
  },
  growth_associate: {
    en: "Growth Associate",
    tr: "Büyüme Ekibi Uzmanı",
    explanationTr: "Büyüme kampanyaları, deneyler ve kullanıcı kazanımı çalışmalarına destek olur.",
    explanationEn: "Supports growth campaigns, experiments, and acquisition work.",
    family: "growth",
    seniority: "entry",
  },
  operations_analyst: {
    en: "Operations Analyst",
    tr: "Operasyon Analisti",
    explanationTr: "Süreçleri, verimliliği ve operasyonel sorunları analiz ederek işleyişi iyileştirir.",
    explanationEn: "Analyzes processes, efficiency, and operating problems to improve how work runs.",
    family: "operations",
    seniority: "entry",
  },
  project_manager: {
    en: "Project Manager",
    tr: "Proje Yöneticisi",
    explanationTr: "İşin kapsamını, takibini ve ekipler arası koordinasyonunu yöneten rol.",
    explanationEn: "Manages scope, follow-through, and cross-functional coordination.",
    family: "operations",
    seniority: "entry_mid",
  },
  project_management: {
    en: "Project Management",
    tr: "Proje Yönetimi",
    explanationTr: "Projelerin plan, sorumluluk, takip ve teslim süreçlerini yönetir.",
    explanationEn: "Manages project planning, ownership, tracking, and delivery.",
    family: "operations",
    seniority: "entry_mid",
  },
  business_development: {
    en: "Business Development",
    tr: "İş Geliştirme Uzmanı",
    explanationTr: "Yeni müşteri, ortaklık ve ticari fırsatları araştırıp büyüme alanı açar.",
    explanationEn: "Finds customer, partnership, and commercial opportunities for growth.",
    family: "business_development",
    seniority: "entry_mid",
  },
  founders_associate: {
    en: "Founder's Associate",
    tr: "Kurucu Ekibi İş Geliştirme Uzmanı",
    explanationTr: "Kurucu ekibe strateji, operasyon, araştırma ve büyüme işlerinde doğrudan destek verir.",
    explanationEn: "Supports the founding team across strategy, operations, research, and growth.",
    family: "startup_operations",
    seniority: "entry",
  },
  startup_operations: {
    en: "Startup Operations",
    tr: "Startup Operasyonları",
    explanationTr: "Erken aşama şirketlerde süreç, müşteri, operasyon ve uygulama işlerini birlikte taşır.",
    explanationEn: "Carries process, customer, operations, and execution work in early-stage companies.",
    family: "startup_operations",
    seniority: "entry_mid",
  },
  management_consulting: {
    en: "Management Consultant",
    tr: "Yönetim Danışmanı",
    explanationTr: "Şirketlerin problem çözme, strateji ve operasyon kararlarını yapılandırmasına destek olur.",
    explanationEn: "Helps companies structure problem-solving, strategy, and operating decisions.",
    family: "consulting",
    seniority: "entry_mid",
  },
  data_analyst: {
    en: "Data Analyst",
    tr: "Veri Analisti",
    explanationTr: "Veriyi analiz ederek iş sorularına cevap ve karar desteği üreten rol.",
    explanationEn: "Analyzes data to answer business questions and support decisions.",
    family: "data",
    seniority: "entry",
  },
  marketing_analyst: {
    en: "Marketing Analyst",
    tr: "Pazarlama Analisti",
    explanationTr: "Kampanya, kanal ve müşteri verilerini analiz ederek pazarlama kararlarını destekler.",
    explanationEn: "Analyzes campaign, channel, and customer data to support marketing decisions.",
    family: "marketing",
    seniority: "entry",
  },
  financial_analyst: {
    en: "Financial Analyst",
    tr: "Finansal Analist",
    explanationTr: "Finansal performans, raporlama ve modelleme ile iş kararlarını destekler.",
    explanationEn: "Supports business decisions through financial performance, reporting, and modeling.",
    family: "finance",
    seniority: "entry",
  },
  sales_development_representative: {
    en: "Sales Development Representative",
    tr: "Satış Geliştirme Temsilcisi",
    explanationTr: "Potansiyel müşterileri bulur, ilk temasları kurar ve satış fırsatı yaratır.",
    explanationEn: "Finds prospects, starts conversations, and creates sales opportunities.",
    family: "sales",
    seniority: "entry",
  },
  customer_success: {
    en: "Customer Success",
    tr: "Müşteri Başarı Uzmanı",
    explanationTr: "Müşterilerin üründen değer almasını ve doğru şekilde ilerlemesini sağlar.",
    explanationEn: "Helps customers get value from the product and move forward successfully.",
    family: "customer",
    seniority: "entry_mid",
  },
  software_engineer: {
    en: "Software Engineer",
    tr: "Yazılım Mühendisi",
    explanationTr: "Ürün ve sistemleri kodla geliştiren, test eden ve sürdüren teknik rol.",
    explanationEn: "Builds, tests, and maintains products and systems through code.",
    family: "software",
    seniority: "entry_mid",
  },
  ux_researcher: {
    en: "UX Researcher",
    tr: "Kullanıcı Deneyimi Araştırmacısı",
    explanationTr: "Kullanıcı ihtiyaçlarını araştırarak ürün kararlarının daha doğru alınmasını sağlar.",
    explanationEn: "Researches user needs so product decisions can be made with better context.",
    family: "research",
    seniority: "entry_mid",
  },
  healthcare_management: {
    en: "Healthcare Management",
    tr: "Sağlık Yönetimi",
    explanationTr: "Sağlık kurumlarında süreç, hizmet kalitesi, koordinasyon ve operasyon kararlarını destekleyen yönetim rolü.",
    explanationEn: "Supports process, service quality, coordination, and operating decisions in healthcare organizations.",
    family: "healthcare_operations",
    seniority: "entry_mid",
  },
  hospital_operations: {
    en: "Hospital Operations",
    tr: "Hastane Operasyonları",
    explanationTr: "Hastane içi akış, kaynak kullanımı, hasta deneyimi ve ekip koordinasyonunu iyileştirmeye odaklanır.",
    explanationEn: "Focuses on hospital workflows, resource use, patient experience, and team coordination.",
    family: "healthcare_operations",
    seniority: "entry_mid",
  },
  clinical_operations: {
    en: "Clinical Operations",
    tr: "Klinik Operasyonlar",
    explanationTr: "Klinik ekiplerin idari süreç, takip, kalite ve uygulama akışlarını destekleyen operasyon rolü.",
    explanationEn: "An operations role supporting administrative process, tracking, quality, and delivery flows for clinical teams.",
    family: "healthcare_operations",
    seniority: "entry_mid",
  },
  health_informatics: {
    en: "Health Informatics",
    tr: "Sağlık Bilişimi",
    explanationTr: "Sağlık verisi, dijital sistemler ve operasyon ihtiyaçları arasında köprü kuran rol.",
    explanationEn: "Connects healthcare data, digital systems, and operational needs.",
    family: "healthcare_data",
    seniority: "entry_mid",
  },
  healthcare_data_analyst: {
    en: "Healthcare Data Analyst",
    tr: "Sağlık Veri Analisti",
    explanationTr: "Sağlık hizmeti, hasta deneyimi veya operasyon verilerini analiz ederek karar desteği üretir.",
    explanationEn: "Analyzes healthcare service, patient experience, or operations data to support decisions.",
    family: "healthcare_data",
    seniority: "entry",
  },
  public_health: {
    en: "Public Health",
    tr: "Halk Sağlığı",
    explanationTr: "Toplum sağlığı, program takibi, saha verisi ve etki ölçümü gibi alanlarda çalışan rol ailesi.",
    explanationEn: "A role family around public health, program tracking, field data, and impact measurement.",
    family: "public_health",
    seniority: "entry_mid",
  },
  medical_sales: {
    en: "Medical Sales",
    tr: "Medikal Satış",
    explanationTr: "Sağlık ürünleri veya hizmetlerinde müşteri ihtiyacı, saha ilişkisi ve ticari takip üzerine çalışır.",
    explanationEn: "Works on customer needs, field relationships, and commercial follow-through for healthcare products or services.",
    family: "healthcare_commercial",
    seniority: "entry_mid",
  },
};

const ROLE_NAME_ALIASES = {
  "Strategy & Operations Intern": "strategy_operations_intern",
  "Strategy & Operations": "strategy_operations_intern",
  "Strateji ve Operasyon Stajyeri": "strategy_operations_intern",
  "Business Analyst": "business_analyst",
  "İş Analisti": "business_analyst",
  "Strategy Analyst": "strategy_analyst",
  "Product Manager": "product_manager",
  "Associate Product Manager": "associate_product_manager",
  "Product Operations": "product_operations",
  "Growth Analyst": "growth_analyst",
  "Growth Associate": "growth_associate",
  "Operations Analyst": "operations_analyst",
  "Project Manager": "project_manager",
  "Business Development": "business_development",
  "Founder's Associate": "founders_associate",
  "Founder’s Associate": "founders_associate",
  "Startup Operations": "startup_operations",
  "Management Consultant": "management_consulting",
  "Data Analyst": "data_analyst",
  "Marketing Analyst": "marketing_analyst",
  "Financial Analyst": "financial_analyst",
  "Sales Development Representative": "sales_development_representative",
  "Customer Success": "customer_success",
  "Software Engineer": "software_engineer",
  "UX Researcher": "ux_researcher",
  "Healthcare Management": "healthcare_management",
  "Sağlık Yönetimi": "healthcare_management",
  "Hospital Operations": "hospital_operations",
  "Hastane Operasyonları": "hospital_operations",
  "Clinical Operations": "clinical_operations",
  "Klinik Operasyonlar": "clinical_operations",
  "Health Informatics": "health_informatics",
  "Sağlık Bilişimi": "health_informatics",
  "Healthcare Data Analyst": "healthcare_data_analyst",
  "Sağlık Veri Analisti": "healthcare_data_analyst",
  "Public Health": "public_health",
  "Halk Sağlığı": "public_health",
  "Medical Sales": "medical_sales",
  "Medikal Satış": "medical_sales",
};

function fallbackMetadata(valueOrName) {
  const normalized = normalizeRoleValue(valueOrName);
  const row = ROLES[normalized];
  if (!row) {
    const raw = String(valueOrName || "").trim();
    return {
      id: normalized || raw,
      en: raw,
      tr: raw,
      explanationTr: "Bu rol için açıklama kapsamımız gelişiyor. Mevcut deneyimlerini genel rol aileleri üzerinden değerlendireceğiz.",
      explanationEn: "Coverage for this role is still improving. We will evaluate your experience through broader role families.",
      family: "general",
      seniority: "unknown",
    };
  }
  return {
    id: normalized,
    en: row.en,
    tr: row.tr,
    explanationTr: "Bu rol için açıklama kapsamımız gelişiyor. Mevcut deneyimlerini genel rol aileleri üzerinden değerlendireceğiz.",
    explanationEn: "Coverage for this role is still improving. We will evaluate your experience through broader role families.",
    family: "general",
    seniority: "unknown",
  };
}

export function resolveRoleDisplayId(valueOrName) {
  const raw = String(valueOrName || "").trim();
  if (!raw) return "";
  if (ROLE_NAME_ALIASES[raw]) return ROLE_NAME_ALIASES[raw];
  const normalized = normalizeRoleValue(raw);
  if (ROLE_DISPLAY[normalized]) return normalized;
  return normalized;
}

export function getRoleDisplay(valueOrName, lang = "TR") {
  const id = resolveRoleDisplayId(valueOrName);
  const base = ROLE_DISPLAY[id] || fallbackMetadata(valueOrName);
  const tr = String(lang || "").toUpperCase() === "TR";
  return {
    ...base,
    id: base.id || id,
    primary: tr ? base.tr : base.en,
    secondary: tr ? base.en : base.tr,
    explanation: tr ? base.explanationTr : base.explanationEn,
  };
}

export function formatRoleTitle(valueOrName, lang = "TR") {
  return getRoleDisplay(valueOrName, lang).primary;
}

export function formatRoleSecondary(valueOrName, lang = "TR") {
  return getRoleDisplay(valueOrName, lang).secondary;
}

export { ROLE_DISPLAY };
