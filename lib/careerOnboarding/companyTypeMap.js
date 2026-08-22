/**
 * Dynamic company types by sector + target roles (Career DNA onboarding).
 * Labels are Turkish-first; used directly in UI chips.
 */

import { normalizeRoleList } from "./roleCatalog.js";

/** @typedef {{ industries: string[], roleMatch?: RegExp, types: string[] }} CompanyTypeRule */

/** @type {CompanyTypeRule[]} */
export const COMPANY_TYPE_RULES = [
  {
    industries: ["technology"],
    roleMatch:
      /product_manager|product_operations|growth_manager|software_engineer|ui_ux|data_analyst|business_analyst|solutions_architect|customer_success|project_manager|ai_product_management/i,
    types: ["Startup", "Scale-up", "SaaS", "BigTech", "Fintech", "Enterprise"],
  },
  {
    industries: ["finance"],
    roleMatch:
      /financial_analyst|investment_analyst|risk_analyst|fintech_product_manager|corporate_finance|strategy_analyst/i,
    types: ["Yatırım Bankası", "Fintech", "Banka", "Sigorta", "Portföy Yönetimi", "Danışmanlık"],
  },
  {
    industries: ["healthcare"],
    roleMatch:
      /hospital_operations|clinical_operations|healthcare_management|health_informatics|healthcare_data_analyst|public_health|medical_sales|general_operations/i,
    types: ["Hastane", "Sağlık Teknolojileri", "İlaç", "Medikal Cihaz", "Kamu Sağlık Kurumu"],
  },
  {
    industries: ["consulting"],
    types: ["Danışmanlık", "Big4", "Boutique Consulting", "Enterprise"],
  },
  {
    industries: ["marketing", "ecommerce"],
    types: ["Startup", "Dijital Ajans", "E-ticaret", "Enterprise", "KOBİ"],
  },
  {
    industries: ["gaming"],
    types: ["Oyun Stüdyosu", "Publisher", "Startup", "Scale-up"],
  },
  {
    industries: ["ai"],
    roleMatch: /ai_|prompt_engineering|machine_learning|automation_specialist/i,
    types: ["AI Startup", "BigTech", "SaaS", "Enterprise Ar-Ge"],
  },
  {
    industries: ["government"],
    types: ["Kamu Kurumu", "Belediye", "STK", "Uluslararası Kuruluş"],
  },
  {
    industries: ["education"],
    types: ["Üniversite", "EdTech", "Özel Eğitim Kurumu", "Kurumsal Eğitim"],
  },
  {
    industries: ["logistics"],
    types: ["Lojistik", "Tedarik Zinciri", "KOBİ", "Enterprise"],
  },
  {
    industries: ["law"],
    types: ["Hukuk Bürosu", "Kurumsal Hukuk", "Fintech", "Kamu"],
  },
  {
    industries: ["media"],
    types: ["Medya", "Ajans", "Startup", "Enterprise"],
  },
  {
    industries: ["hr"],
    types: ["Kurumsal", "Danışmanlık", "Tech", "KOBİ"],
  },
  {
    industries: ["tourism", "retail"],
    types: ["KOBİ", "Enterprise", "Franchise", "Startup"],
  },
  {
    industries: ["operations", "entrepreneurship"],
    types: ["Startup", "Scale-up", "KOBİ", "Enterprise"],
  },
];

const DEFAULT_COMPANY_TYPES = ["Startup", "Kurumsal", "KOBİ", "Ajans"];

/**
 * @param {string[]} industryIds
 * @param {string[]} roles - canonical role value keys
 * @returns {string[]}
 */
export function getCompanyTypesForSelection(industryIds = [], roles = []) {
  if (!industryIds?.length) return [];
  const types = new Set();
  const roleStr = normalizeRoleList(roles).join(" ");
  for (const rule of COMPANY_TYPE_RULES) {
    const industryHit = rule.industries.some((id) => industryIds.includes(id));
    if (!industryHit) continue;
    const roleHit = !rule.roleMatch || rule.roleMatch.test(roleStr);
    if (roleHit) (rule.types || []).forEach((t) => types.add(t));
  }
  if (!types.size) return [...DEFAULT_COMPANY_TYPES];
  return [...types];
}

const COMPANY_TYPE_GROUPS = [
  { id: "startup", labelTr: "Startup & Growth", labelEn: "Startup & Growth", match: /startup|scale-up|saas|edtech/i },
  { id: "consulting", labelTr: "Danışmanlık", labelEn: "Consulting", match: /danisman|consulting|big4|boutique/i },
  { id: "finance", labelTr: "Finans", labelEn: "Finance", match: /fintech|banka|bank|sigorta|portfoy|investment|finance/i },
  { id: "corporate", labelTr: "Kurumsal", labelEn: "Corporate", match: /enterprise|bigtech|kobi|kurumsal/i },
];

function normalizeCompanyType(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

export function groupCompanyTypesForDisplay(types = [], lang = "TR") {
  const tr = String(lang).toUpperCase() === "TR";
  const buckets = new Map(COMPANY_TYPE_GROUPS.map((group) => [group.id, { ...group, options: [] }]));
  const sectorSpecific = { id: "sector", labelTr: "Sektöre Özel", labelEn: "Industry-specific", options: [] };

  for (const type of types) {
    const searchable = normalizeCompanyType(type);
    const group = COMPANY_TYPE_GROUPS.find((candidate) => candidate.match.test(searchable));
    if (group) buckets.get(group.id).options.push(type);
    else sectorSpecific.options.push(type);
  }

  return [...buckets.values(), sectorSpecific]
    .filter((group) => group.options.length)
    .map((group) => ({
      id: group.id,
      label: tr ? group.labelTr : group.labelEn,
      options: [...new Set(group.options)],
    }));
}
