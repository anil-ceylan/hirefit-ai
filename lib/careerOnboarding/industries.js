/**
 * Industry-first career model — sector controls available roles and downstream intelligence.
 */

import {
  ROLES_BY_INDUSTRY,
  FALLBACK_ROLE_VALUES,
  normalizeRoleList,
  normalizeRoleValue,
  getRoleLabel,
  flattenAllRoleValues,
  getMergedRolesForIndustries,
  getPrioritizedRoles,
} from "./roleCatalog.js";
import { MAX_TARGET_ROLES } from "./careerSignalSchema.js";
import {
  normalizeExperienceLevels,
  primaryExperienceLevel,
  normalizeCompanySizes,
  COMPANY_STAGE_OPTIONS,
  COMPANY_INDUSTRY_OPTIONS,
} from "./onboardingOptions.js";

export { getCompanyTypesForSelection, groupCompanyTypesForDisplay, COMPANY_TYPE_RULES } from "./companyTypeMap.js";

export { ROLES_BY_INDUSTRY, FALLBACK_ROLE_VALUES as FALLBACK_ROLES } from "./roleCatalog.js";
export {
  getRoleLabel,
  normalizeRoleValue,
  normalizeRoleList,
  localizeRoles,
  getMergedRolesForIndustries,
  getPrioritizedRoles,
} from "./roleCatalog.js";

export const INDUSTRIES = [
  { id: "technology", labelEn: "Technology & Software", labelTr: "Teknoloji ve Yazılım" },
  { id: "ai", labelEn: "AI & Data", labelTr: "Yapay Zeka ve Veri" },
  { id: "finance", labelEn: "Finance & Banking", labelTr: "Finans ve Bankacılık" },
  { id: "fintech", labelEn: "FinTech", labelTr: "FinTech" },
  { id: "healthcare", labelEn: "Healthcare & Life Sciences", labelTr: "Sağlık ve Yaşam Bilimleri" },
  { id: "pharma_biotech", labelEn: "Pharma & Biotechnology", labelTr: "İlaç ve Biyoteknoloji" },
  { id: "education", labelEn: "Education", labelTr: "Eğitim" },
  { id: "law", labelEn: "Law", labelTr: "Hukuk" },
  { id: "consulting", labelEn: "Consulting", labelTr: "Danışmanlık" },
  { id: "government", labelEn: "Public Sector & NGOs", labelTr: "Kamu ve Sivil Toplum" },
  { id: "defense_aerospace", labelEn: "Defense & Aerospace", labelTr: "Savunma ve Havacılık" },
  { id: "energy", labelEn: "Energy", labelTr: "Enerji" },
  { id: "climate", labelEn: "Renewable Energy & Climate", labelTr: "Yenilenebilir Enerji ve İklim" },
  { id: "manufacturing", labelEn: "Manufacturing & Industry", labelTr: "Üretim ve Sanayi" },
  { id: "automotive", labelEn: "Automotive", labelTr: "Otomotiv" },
  { id: "construction_real_estate", labelEn: "Construction & Real Estate", labelTr: "İnşaat ve Gayrimenkul" },
  { id: "retail", labelEn: "Retail", labelTr: "Perakende" },
  { id: "ecommerce", labelEn: "E-commerce", labelTr: "E-ticaret" },
  { id: "media", labelEn: "Media & Entertainment", labelTr: "Medya ve Eğlence" },
  { id: "marketing", labelEn: "Advertising & Marketing", labelTr: "Reklam ve Pazarlama" },
  { id: "creative", labelEn: "Design & Creative Industries", labelTr: "Tasarım ve Yaratıcı Endüstriler" },
  { id: "tourism", labelEn: "Tourism & Hospitality", labelTr: "Turizm ve Konaklama" },
  { id: "logistics", labelEn: "Logistics & Transportation", labelTr: "Lojistik ve Ulaşım" },
  { id: "telecommunications", labelEn: "Telecommunications", labelTr: "Telekomünikasyon" },
  { id: "agriculture_food", labelEn: "Agriculture & Food", labelTr: "Tarım ve Gıda" },
  { id: "sports", labelEn: "Sports", labelTr: "Spor" },
  { id: "gaming", labelEn: "Gaming", labelTr: "Oyun" },
  { id: "cybersecurity", labelEn: "Cybersecurity", labelTr: "Siber Güvenlik" },
  { id: "professional_services", labelEn: "Professional Services", labelTr: "Profesyonel Hizmetler" },
  { id: "other", labelEn: "Other", labelTr: "Diğer" },
  { id: "unsure", labelEn: "Not sure yet", labelTr: "Henüz emin değilim" },
];

const DEFAULT_INTEL = {
  atsKeywords: ["İletişim", "Analiz", "Proje yönetimi", "Paydaş yönetimi", "Excel", "Sunum"],
  suggestedJobs: ["İş Analisti", "Proje Koordinatörü", "Operasyon Uzmanı"],
  marketNoteTr: "Sektörünü netleştirmek, CV ve mülakat hazırlığını odaklı tutar.",
  marketNoteEn: "A clear sector keeps CV and interview prep focused.",
  cvTipsTr: ["2 somut proje ile kanıt göster", "Hedef rolü CV başlığında netleştir"],
  cvTipsEn: ["Prove impact with 2 concrete projects", "Clarify target role in CV headline"],
};

/** Sector-specific intelligence for Career OS, ATS, and GPS */
export const INDUSTRY_INTEL = {
  technology: {
    atsKeywords: ["Agile", "SQL", "Product roadmap", "Stakeholder", "A/B testing", "API"],
    suggestedJobs: ["Junior Ürün Yöneticisi", "İş Analisti", "Growth Associate", "QA Engineer"],
    marketNoteTr: "Teknoloji pazarında ürün, veri ve büyüme rolleri en hızlı işe alım döngüsüne sahip.",
    marketNoteEn: "Tech hiring cycles are fastest for product, data, and growth roles.",
    cvTipsTr: ["Her projede metrik ve kullanıcı etkisini yaz", "Tech stack ve araçları net listele"],
    cvTipsEn: ["Quantify user impact per project", "List tools and stack explicitly"],
  },
  finance: {
    atsKeywords: ["Financial modeling", "Excel", "Risk", "Compliance", "DCF", "Reporting"],
    suggestedJobs: ["Finans Analisti", "Risk Analisti", "Denetim Stajyeri", "Strateji Analisti"],
    marketNoteTr: "Finans rollerinde analitik netlik ve regülasyon farkındalığı kritik.",
    marketNoteEn: "Finance roles reward analytical clarity and regulatory awareness.",
    cvTipsTr: ["Modelleme ve raporlama örnekleri ekle", "Sayısal sonuçları vurgula"],
    cvTipsEn: ["Add modeling and reporting examples", "Highlight numerical outcomes"],
  },
  healthcare: {
    atsKeywords: ["Clinical workflow", "EHR", "Patient outcomes", "Healthcare analytics", "HIPAA"],
    suggestedJobs: ["Sağlık Bilişimi Analisti", "Klinik Operasyon Koordinatörü", "Medikal Satış"],
    marketNoteTr: "Sağlık sektöründe operasyon ve veri rolleri hızla büyüyor.",
    marketNoteEn: "Healthcare operations and data roles are growing quickly.",
    cvTipsTr: ["Hasta/operasyon etkisini anlat", "Sağlık teknolojisi araçlarını belirt"],
    cvTipsEn: ["Describe patient/operations impact", "Mention health-tech tools"],
  },
  consulting: {
    atsKeywords: ["Case interview", "Frameworks", "Client delivery", "Problem structuring"],
    suggestedJobs: ["İş Analisti", "Danışmanlık Stajyeri", "Strateji Analisti"],
    marketNoteTr: "Danışmanlıkta yapılandırılmış düşünme ve iletişim öne çıkar.",
    marketNoteEn: "Consulting favors structured thinking and communication.",
    cvTipsTr: ["Case study formatında 2 proje yaz", "Paydaş yönetimini vurgula"],
    cvTipsEn: ["Write 2 projects as mini case studies", "Emphasize stakeholder management"],
  },
  marketing: {
    atsKeywords: ["CAC", "ROAS", "CRM", "Campaign", "Brand", "Conversion", "SEO"],
    suggestedJobs: ["Growth Associate", "Performans Pazarlama Uzmanı", "CRM Analisti"],
    marketNoteTr: "Pazarlama rollerinde kanıtlanmış kampanya sonuçları fark yaratır.",
    marketNoteEn: "Marketing roles need proven campaign results.",
    cvTipsTr: ["Kampanya metriklerini yaz", "Kanalları (Meta, Google, CRM) belirt"],
    cvTipsEn: ["Include campaign metrics", "Name channels (Meta, Google, CRM)"],
  },
  education: {
    atsKeywords: ["LMS", "Curriculum", "Student engagement", "Program design", "EdTech"],
    suggestedJobs: ["EdTech Ürün Uzmanı", "Program Koordinatörü", "Öğretim Tasarımcısı"],
    marketNoteTr: "Eğitim teknolojisi ve operasyon rolleri kampüs–mezuniyet geçişinde güçlü.",
    marketNoteEn: "EdTech and academic operations bridge campus to career.",
    cvTipsTr: ["Öğrenci/program sonuçlarını ölç", "EdTech araç deneyimini ekle"],
    cvTipsEn: ["Measure student/program outcomes", "Add EdTech tool experience"],
  },
  government: {
    atsKeywords: ["Policy", "Public sector", "Compliance", "Digital government", "Stakeholder"],
    suggestedJobs: ["Politika Analisti", "Kamu Yönetimi Uzmanı", "Dijital Dönüşüm Analisti"],
    marketNoteTr: "Kamu rollerinde süreç, politika ve dijital dönüşüm birlikte değerlendirilir.",
    marketNoteEn: "Public sector roles blend process, policy, and digital transformation.",
    cvTipsTr: ["Politika/proje etkisini somutlaştır", "Dijital dönüşüm örnekleri ekle"],
    cvTipsEn: ["Make policy/project impact concrete", "Add digital transformation examples"],
  },
  logistics: {
    atsKeywords: ["Supply chain", "Inventory", "Procurement", "WMS", "Forecasting"],
    suggestedJobs: ["Tedarik Zinciri Analisti", "Lojistik Koordinatörü", "Operasyon Analisti"],
    marketNoteTr: "Lojistikte operasyon verimliliği ve tedarik zinciri görünürlüğü aranan beceriler.",
    marketNoteEn: "Logistics values operational efficiency and supply-chain visibility.",
    cvTipsTr: ["Maliyet/süre iyileştirmelerini yaz", "ERP/WMS araçlarını belirt"],
    cvTipsEn: ["Note cost/time improvements", "List ERP/WMS tools"],
  },
  gaming: {
    atsKeywords: ["LiveOps", "Retention", "Monetization", "Game design", "Community", "F2P"],
    suggestedJobs: ["Game Producer Associate", "Community Manager", "LiveOps Analyst"],
    marketNoteTr: "Oyun sektöründe topluluk, LiveOps ve ürün rolleri birlikte büyür.",
    marketNoteEn: "Gaming combines community, LiveOps, and product growth.",
    cvTipsTr: ["Oyun/metric sonuçlarını paylaş", "Topluluk veya LiveOps deneyimini vurgula"],
    cvTipsEn: ["Share game/metric outcomes", "Highlight community or LiveOps work"],
  },
  ecommerce: {
    atsKeywords: ["GMV", "Conversion", "Marketplace", "Category", "Merchandising", "CRM"],
    suggestedJobs: ["E-ticaret Operasyon Uzmanı", "Kategori Analisti", "Marketplace Associate"],
    marketNoteTr: "E-ticarette büyüme, kategori ve operasyon rolleri yoğun talep görür.",
    marketNoteEn: "E-commerce demand is strong for growth, category, and ops roles.",
    cvTipsTr: ["Satış/dönüşüm metriklerini yaz", "Pazar yeri deneyimini belirt"],
    cvTipsEn: ["Include sales/conversion metrics", "Note marketplace experience"],
  },
  ai: {
    atsKeywords: ["LLM", "Prompt engineering", "ML pipeline", "AI product", "Automation", "RAG"],
    suggestedJobs: ["AI Product Associate", "Prompt Engineer", "ML Engineer Intern"],
    marketNoteTr: "Yapay zeka rollerinde ürün, operasyon ve prompt becerileri öne çıkıyor.",
    marketNoteEn: "AI hiring favors product, ops, and prompt engineering skills.",
    cvTipsTr: ["AI projelerinde kullanım senaryosunu anlat", "Model/otomasyon çıktılarını göster"],
    cvTipsEn: ["Explain AI use cases in projects", "Show model/automation outputs"],
  },
  law: {
    atsKeywords: ["Compliance", "KVKK", "GDPR", "Contract", "Legal research", "Regulation"],
    suggestedJobs: ["Hukuk Stajyeri", "Legal Operations Analyst", "Uyum Uzmanı"],
    marketNoteTr: "Hukuk ve uyum rollerinde regülasyon bilgisi ve dikkat kritik.",
    marketNoteEn: "Law and compliance roles require regulatory awareness and precision.",
    cvTipsTr: ["Staj ve araştırma çıktılarını listele", "Uyum projelerini vurgula"],
    cvTipsEn: ["List internship and research outputs", "Highlight compliance projects"],
  },
  media: {
    atsKeywords: ["Content", "Social media", "Video", "PR", "Brand", "Community"],
    suggestedJobs: ["İçerik Üreticisi", "Sosyal Medya Uzmanı", "PR Stajyeri"],
    marketNoteTr: "Medya rollerinde portfolyo ve içerik kanıtı öne çıkar.",
    marketNoteEn: "Media roles favor portfolio and content proof.",
    cvTipsTr: ["Portfolyo linki ekle", "Erişim/etkileşim metriklerini yaz"],
    cvTipsEn: ["Add portfolio link", "Include reach/engagement metrics"],
  },
  hr: {
    atsKeywords: ["Recruitment", "Talent", "HRIS", "Employer branding", "L&D", "People analytics"],
    suggestedJobs: ["Talent Acquisition Intern", "HR Operations Associate", "People Analytics Analyst"],
    marketNoteTr: "İK rollerinde iletişim, veri ve aday deneyimi birlikte değerlendirilir.",
    marketNoteEn: "HR roles blend communication, data, and candidate experience.",
    cvTipsTr: ["İK projelerinde süreç iyileştirmesini yaz", "People analytics örnekleri ekle"],
    cvTipsEn: ["Note process improvements in HR projects", "Add people analytics examples"],
  },
  tourism: {
    atsKeywords: ["Hospitality", "Guest experience", "Revenue management", "Events", "Operations"],
    suggestedJobs: ["Otel Operasyon Stajyeri", "Misafir İlişkileri Uzmanı", "Etkinlik Koordinatörü"],
    marketNoteTr: "Turizmde operasyon ve misafir deneyimi odaklı roller güçlü.",
    marketNoteEn: "Tourism favors operations and guest-experience roles.",
    cvTipsTr: ["Müşteri memnuniyeti örneklerini yaz", "Sezonluk operasyon deneyimini belirt"],
    cvTipsEn: ["Describe customer satisfaction wins", "Note seasonal operations experience"],
  },
  retail: {
    atsKeywords: ["Store operations", "Merchandising", "Sales", "CRM", "Inventory", "Category"],
    suggestedJobs: ["Mağaza Operasyon Uzmanı", "Kategori Analisti", "Satış Temsilcisi"],
    marketNoteTr: "Perakendede satış, kategori ve operasyon rolleri yoğun.",
    marketNoteEn: "Retail demand is strong for sales, category, and ops roles.",
    cvTipsTr: ["Satış hedefi/performansını yaz", "Mağaza operasyon örnekleri ekle"],
    cvTipsEn: ["Note sales targets/performance", "Add store operations examples"],
  },
  operations: {
    atsKeywords: ["Process improvement", "KPI", "Lean", "Quality", "Efficiency", "Project management"],
    suggestedJobs: ["Operasyon Analisti", "Süreç İyileştirme Uzmanı", "Kalite Uzmanı"],
    marketNoteTr: "Operasyon rollerinde verimlilik ve süreç netliği aranan beceriler.",
    marketNoteEn: "Operations roles value efficiency and process clarity.",
    cvTipsTr: ["Verimlilik kazanımlarını ölç", "Süreç haritalama örnekleri ekle"],
    cvTipsEn: ["Quantify efficiency gains", "Add process mapping examples"],
  },
  entrepreneurship: {
    atsKeywords: ["Startup", "Growth", "Fundraising", "MVP", "Go-to-market", "Pitch"],
    suggestedJobs: ["Founder Associate", "İş Geliştirme Stajyeri", "Growth Intern"],
    marketNoteTr: "Girişimcilik yolunda kanıt, hız ve çok yönlülük öne çıkar.",
    marketNoteEn: "Entrepreneurship paths favor proof, speed, and versatility.",
    cvTipsTr: ["Kurduğun/katıldığın projeleri anlat", "Metrik ve öğrenimleri vurgula"],
    cvTipsEn: ["Describe projects you built or joined", "Highlight metrics and learnings"],
  },
  other: DEFAULT_INTEL,
};

export function getIndustryLabel(id, lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  const row = INDUSTRIES.find((i) => i.id === id);
  if (!row) return id || "";
  return tr ? row.labelTr : row.labelEn;
}

export function getRolesForIndustry(industryId) {
  const id = industryId && ROLES_BY_INDUSTRY[industryId] ? industryId : "other";
  return [...ROLES_BY_INDUSTRY[id]];
}

/** Merge unique role values from multiple selected sectors; fallback when none selected */
export function getRolesForIndustries(industryIds = []) {
  const merged = getMergedRolesForIndustries(industryIds);
  const roles = merged.length ? merged : [...ROLES_BY_INDUSTRY.other];
  if (roles.includes("founder")) return roles;
  return [roles[0], "founder", ...roles.slice(1)].filter(Boolean);
}

const FOUNDER_PRIORITY_ROLES = [
  "founder",
  "product_manager",
  "strategy_analyst",
  "business_analyst",
  "business_development",
  "general_strategy",
];

function prioritizeRolesForDisplay(roles = []) {
  const prioritized = [];
  const seen = new Set();
  for (const role of FOUNDER_PRIORITY_ROLES) {
    if (roles.includes(role) && !seen.has(role)) {
      seen.add(role);
      prioritized.push(role);
    }
  }
  for (const role of roles) {
    if (!seen.has(role)) {
      seen.add(role);
      prioritized.push(role);
    }
  }
  return prioritized;
}

/** Top roles for onboarding chips — Founder stays visible with Product / Strategy / Business paths */
export function getTopRolesForIndustries(industryIds = [], limit = 10) {
  return prioritizeRolesForDisplay(getRolesForIndustries(industryIds)).slice(0, limit);
}

export function getRemainingRolesForIndustries(industryIds = [], skip = 10) {
  return prioritizeRolesForDisplay(getRolesForIndustries(industryIds)).slice(skip);
}

/** Normalize career goals for persistence + Career OS */
export function normalizeCareerGoals(g = {}) {
  const industries = (g.industries || [])
    .map((id) => String(id).trim())
    .filter(Boolean)
    .slice(0, MAX_TARGET_ROLES);
  const primaryIndustry = industries[0] || g.primaryIndustry || "";
  const secondaryIndustry = industries[1] || "";
  const tertiaryIndustry = industries[2] || "";
  const lookingFor = normalizeLookingFor(g.lookingFor).slice(0, MAX_TARGET_ROLES);
  const allowed = new Set(getRolesForIndustries(industries));
  const pool = normalizeRoleList(g.targetRoles || g.roleIds || [])
    .filter((r) => !industries.length || allowed.has(r))
    .slice(0, MAX_TARGET_ROLES);
  let primaryRole = normalizeRoleValue(g.primaryRole);
  let secondaryRole = normalizeRoleValue(g.secondaryRole);
  let tertiaryRole = normalizeRoleValue(g.tertiaryRole);
  if (primaryRole && industries.length && !allowed.has(primaryRole)) primaryRole = "";
  if (secondaryRole && industries.length && !allowed.has(secondaryRole)) secondaryRole = "";
  if (tertiaryRole && industries.length && !allowed.has(tertiaryRole)) tertiaryRole = "";

  if (!primaryRole && pool[0]) primaryRole = pool[0];
  if (!secondaryRole && pool[1] && pool[1] !== primaryRole) secondaryRole = pool[1];
  if (!tertiaryRole && pool[2] && pool[2] !== primaryRole && pool[2] !== secondaryRole) {
    tertiaryRole = pool[2];
  }

  const targetRoles = normalizeRoleList([primaryRole, secondaryRole, tertiaryRole, ...pool])
    .filter((r) => !industries.length || allowed.has(r))
    .slice(0, MAX_TARGET_ROLES);
  primaryRole = targetRoles[0] || "";
  secondaryRole = targetRoles[1] || "";
  tertiaryRole = targetRoles[2] || "";

  const experienceLevels = normalizeExperienceLevels(
    g.experienceLevels ?? g.experienceLevel ?? g.seniority
  );
  const experienceLevel = primaryExperienceLevel(experienceLevels);
  const workMode = Array.isArray(g.workMode) ? g.workMode : g.workPreferences || [];
  const stageIds = new Set(COMPANY_STAGE_OPTIONS.map((option) => option.id));
  const companyIndustryIds = new Set(COMPANY_INDUSTRY_OPTIONS.map((option) => option.id));
  const legacyCompanyTypes = Array.isArray(g.companyTypes) ? g.companyTypes : [];
  const normalizeLegacy = (value) => String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
  const stageFromLegacy = legacyCompanyTypes.map((value) => {
    const normalized = normalizeLegacy(value);
    if (/early/.test(normalized)) return "early_stage";
    if (/scale/.test(normalized)) return "scale_up";
    if (/enterprise|bigtech|kurumsal|kobi/.test(normalized)) return "enterprise";
    if (/startup/.test(normalized)) return "startup";
    return "";
  });
  const industryFromLegacy = legacyCompanyTypes.map((value) => {
    const normalized = normalizeLegacy(value);
    if (/fintech/.test(normalized)) return "fintech";
    if (/saas/.test(normalized)) return "saas";
    if (/consult|danış|danis|big4|boutique/.test(normalized)) return "consulting";
    if (/health|sağlık|saglik/.test(normalized)) return "healthtech";
    if (/gaming|oyun/.test(normalized)) return "gaming";
    if (/education|edtech|eğitim|egitim/.test(normalized)) return "education";
    if (/media|medya|ajans/.test(normalized)) return "media";
    return "";
  });
  const companyStages = [...new Set([...(g.companyStages || []), ...stageFromLegacy])]
    .filter((value) => stageIds.has(value));
  const companyIndustries = [...new Set([...(g.companyIndustries || []), ...industryFromLegacy])]
    .filter((value) => companyIndustryIds.has(value))
    .slice(0, MAX_TARGET_ROLES);
  const companyTypes = companyStages;
  const companySizes = normalizeCompanySizes(g.companySizes || []);

  return {
    ...g,
    lookingFor,
    industries,
    sectorIds: industries,
    selectedIndustries: industries,
    primaryIndustry,
    secondaryIndustry,
    tertiaryIndustry,
    industryPriority: {
      primary: primaryIndustry,
      secondary: secondaryIndustry,
      tertiary: tertiaryIndustry,
    },
    lookingForPriority: {
      primary: lookingFor[0] || "",
      secondary: lookingFor[1] || "",
      tertiary: lookingFor[2] || "",
    },
    primaryRole,
    secondaryRole,
    tertiaryRole,
    roleIds: targetRoles,
    targetRoles,
    selectedRoles: targetRoles,
    rolePriority: {
      primary: primaryRole,
      secondary: secondaryRole,
      tertiary: tertiaryRole,
    },
    experienceLevels,
    experienceLevel,
    seniority: experienceLevel,
    workMode,
    workModels: workMode,
    workPreferences: workMode,
    companyTypes,
    companyStages,
    companyIndustries,
    companyIndustryPriority: {
      primary: companyIndustries[0] || "",
      secondary: companyIndustries[1] || "",
      tertiary: companyIndustries[2] || "",
    },
    companyPreferences: {
      stages: companyStages,
      industries: companyIndustries,
      sizes: companySizes,
    },
    companySizes,
    targetCountries: g.targetCountries || [],
    targetCities: g.targetCities || [],
  };
}

/** Canonical Career GPS input payload saved on onboarding complete */
export function buildCareerGpsInputs(goals = {}) {
  const g = normalizeCareerGoals(goals);
  return {
    selectedIndustries: g.selectedIndustries || g.industries || [],
    selectedRoles: g.selectedRoles || g.targetRoles || [],
    rolePriority: g.rolePriority || {
      primary: g.primaryRole || "",
      secondary: g.secondaryRole || "",
      tertiary: g.tertiaryRole || "",
    },
    experienceLevels: g.experienceLevels || [],
    workModels: g.workModels || g.workMode || [],
    companyTypes: g.companyTypes || [],
    companyStages: g.companyStages || [],
    companyIndustries: g.companyIndustries || [],
    companyPreferences: g.companyPreferences || {},
    companySizes: g.companySizes || [],
  };
}

export function filterRolesForIndustry(selectedRoles = [], industryId) {
  const allowed = new Set(getRolesForIndustry(industryId));
  return normalizeRoleList(selectedRoles).filter((r) => allowed.has(r));
}

export function filterRolesForIndustries(selectedRoles = [], industryIds = []) {
  const allowed = new Set(getRolesForIndustries(industryIds));
  return normalizeRoleList(selectedRoles).filter((r) => allowed.has(r));
}

export function flattenAllRoles() {
  return flattenAllRoleValues();
}

export function getIndustryContext(industryId, { targetRoles = [], goals = null, lang = "TR" } = {}) {
  const id = ROLES_BY_INDUSTRY[industryId] ? industryId : "other";
  const intel = INDUSTRY_INTEL[id] || DEFAULT_INTEL;
  const isTr = String(lang || "").toUpperCase() === "TR";
  const prioritized = goals ? getPrioritizedRoles(goals) : normalizeRoleList(targetRoles);
  const roles = normalizeRoleList(
    prioritized.length ? prioritized : getRolesForIndustry(id).slice(0, 4)
  );

  const roleScores = roles.map((roleValue, idx) => ({
    role: getRoleLabel(roleValue, lang),
    roleValue,
    score: Math.max(52, 88 - idx * 8),
    label: getRoleLabel(roleValue, lang),
  }));

  return {
    industryId: id,
    industryLabel: getIndustryLabel(id, lang),
    atsKeywords: intel.atsKeywords,
    suggestedJobs: intel.suggestedJobs,
    marketIntelligence: isTr ? intel.marketNoteTr : intel.marketNoteEn,
    cvImprovementTips: isTr ? intel.cvTipsTr : intel.cvTipsEn,
    roleScores,
  };
}

/** Normalize lookingFor — supports legacy string or array */
export function normalizeLookingFor(value) {
  const allowed = new Set(["internship", "part-time", "full-time", "freelance", "unsure"]);
  const raw = Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value.trim()] : [];
  return raw.map((item) => String(item || "").trim()).filter((item) => allowed.has(item));
}

export function includesLookingFor(goals, key) {
  const list = normalizeLookingFor(goals?.lookingFor);
  return list.includes(key);
}

export function primaryLookingFor(goals) {
  const list = normalizeLookingFor(goals?.lookingFor);
  return list[0] || "full-time";
}
