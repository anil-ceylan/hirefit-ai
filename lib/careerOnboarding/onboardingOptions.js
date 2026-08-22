/** Shared onboarding option lists (TR-first). */

export const LOOKING_FOR_OPTIONS = [
  { id: "internship", labelTr: "Staj", labelEn: "Internship" },
  { id: "part-time", labelTr: "Yarı zamanlı", labelEn: "Part-time" },
  { id: "full-time", labelTr: "Tam zamanlı", labelEn: "Full-time" },
  { id: "freelance", labelTr: "Freelance", labelEn: "Freelance" },
  { id: "unsure", labelTr: "Henüz emin değilim", labelEn: "Not sure yet" },
];

export const EXPERIENCE_LEVELS = [
  { id: "intern", labelTr: "Staj", labelEn: "Internship" },
  { id: "new_graduate", labelTr: "Yeni Mezun", labelEn: "New graduate" },
  { id: "entry", labelTr: "Junior", labelEn: "Junior" },
  { id: "mid", labelTr: "Orta Seviye", labelEn: "Mid level" },
  { id: "senior", labelTr: "Senior", labelEn: "Senior" },
  { id: "manager", labelTr: "Yönetici", labelEn: "Manager" },
];

export const COMPANY_SIZE_OPTIONS = [
  { id: "1-10", labelTr: "1-10 kişi", labelEn: "1-10 employees" },
  { id: "11-50", labelTr: "11-50 kişi", labelEn: "11-50 employees" },
  { id: "51-200", labelTr: "51-200 kişi", labelEn: "51-200 employees" },
  { id: "201-1000", labelTr: "201-1000 kişi", labelEn: "201-1000 employees" },
  { id: "1000+", labelTr: "1000+", labelEn: "1000+" },
];

const EXPERIENCE_RANK = {
  intern: 0,
  new_graduate: 1,
  entry: 2,
  junior: 2,
  mid: 3,
  senior: 4,
  manager: 5,
};

/** Legacy seniority ids → canonical experience level */
export const EXPERIENCE_LEVEL_ALIASES = {
  junior: "entry",
  "entry-level": "entry",
  "mid-level": "mid",
};

export const LIVING_SITUATION_OPTIONS = [
  { id: "with_family", labelTr: "Ailemle yaşıyorum", labelEn: "Living with family" },
  { id: "dorm", labelTr: "Yurtta kalıyorum", labelEn: "Dormitory" },
  { id: "student_house", labelTr: "Öğrenci evinde kalıyorum", labelEn: "Student housing" },
  { id: "alone", labelTr: "Tek yaşıyorum", labelEn: "Living alone" },
  { id: "shared", labelTr: "Paylaşımlı evde kalıyorum", labelEn: "Shared housing" },
];

export const WORK_MODE_OPTIONS = [
  { id: "onsite", labelTr: "Ofisten", labelEn: "Onsite" },
  { id: "hybrid", labelTr: "Hibrit", labelEn: "Hybrid" },
  { id: "remote", labelTr: "Uzaktan", labelEn: "Remote" },
  { id: "flexible", labelTr: "Fark etmez", labelEn: "Flexible" },
];

export const INTERNATIONAL_INTENT_OPTIONS = [
  { id: "no", labelTr: "Hayır", labelEn: "No" },
  { id: "yes", labelTr: "Evet", labelEn: "Yes" },
  { id: "maybe", labelTr: "Değerlendirebilirim", labelEn: "I would consider it" },
  { id: "unsure", labelTr: "Henüz emin değilim", labelEn: "Not sure yet" },
];

export const INTERNATIONAL_COUNTRY_GROUPS = [
  {
    id: "europe",
    labelTr: "Avrupa",
    labelEn: "Europe",
    countries: [
      "Almanya", "Hollanda", "Birleşik Krallık", "İrlanda", "Fransa", "İspanya", "Portekiz",
      "İsveç", "Danimarka", "Finlandiya", "Norveç", "İsviçre", "Avusturya", "Polonya", "Estonya",
    ],
  },
  { id: "north_america", labelTr: "Kuzey Amerika", labelEn: "North America", countries: ["ABD", "Kanada"] },
  { id: "middle_east", labelTr: "Orta Doğu", labelEn: "Middle East", countries: ["Birleşik Arap Emirlikleri", "Katar", "Suudi Arabistan"] },
  { id: "asia_pacific", labelTr: "Asya-Pasifik", labelEn: "Asia-Pacific", countries: ["Singapur", "Avustralya", "Yeni Zelanda", "Japonya", "Güney Kore"] },
  { id: "other", labelTr: "Diğer", labelEn: "Other", countries: ["Diğer", "Henüz emin değilim"] },
];

export const EDUCATION_STATUS_OPTIONS = [
  { id: "currently_studying", labelTr: "Eğitimime devam ediyorum", labelEn: "Currently studying" },
  { id: "graduate", labelTr: "Mezunum", labelEn: "Graduate" },
  { id: "masters_student", labelTr: "Yüksek lisans öğrencisiyim", labelEn: "Master's student" },
  { id: "phd_student", labelTr: "Doktora öğrencisiyim", labelEn: "PhD student" },
  { id: "other", labelTr: "Diğer", labelEn: "Other" },
];

export const COMPANY_STAGE_OPTIONS = [
  { id: "startup", labelTr: "Startup", labelEn: "Startup" },
  { id: "early_stage", labelTr: "Erken aşama", labelEn: "Early Stage" },
  { id: "scale_up", labelTr: "Scale-up", labelEn: "Scale-up" },
  { id: "enterprise", labelTr: "Kurumsal", labelEn: "Enterprise" },
];

export const COMPANY_INDUSTRY_OPTIONS = [
  { id: "ai", labelTr: "AI", labelEn: "AI" },
  { id: "saas", labelTr: "SaaS", labelEn: "SaaS" },
  { id: "fintech", labelTr: "FinTech", labelEn: "FinTech" },
  { id: "healthtech", labelTr: "HealthTech", labelEn: "HealthTech" },
  { id: "cybersecurity", labelTr: "Siber Güvenlik", labelEn: "Cybersecurity" },
  { id: "gaming", labelTr: "Oyun", labelEn: "Gaming" },
  { id: "consulting", labelTr: "Danışmanlık", labelEn: "Consulting" },
  { id: "ecommerce", labelTr: "E-ticaret", labelEn: "E-commerce" },
  { id: "education", labelTr: "Eğitim", labelEn: "Education" },
  { id: "manufacturing", labelTr: "Üretim", labelEn: "Manufacturing" },
  { id: "media", labelTr: "Medya", labelEn: "Media" },
  { id: "robotics", labelTr: "Robotik", labelEn: "Robotics" },
  { id: "cloud", labelTr: "Cloud", labelEn: "Cloud" },
  { id: "developer_tools", labelTr: "Developer Tools", labelEn: "Developer Tools" },
  { id: "marketplace", labelTr: "Marketplace", labelEn: "Marketplace" },
  { id: "automotive", labelTr: "Otomotiv", labelEn: "Automotive" },
  { id: "energy", labelTr: "Enerji", labelEn: "Energy" },
  { id: "climatetech", labelTr: "ClimateTech", labelEn: "ClimateTech" },
  { id: "telecommunications", labelTr: "Telekomünikasyon", labelEn: "Telecommunications" },
  { id: "defense", labelTr: "Savunma", labelEn: "Defense" },
  { id: "proptech", labelTr: "PropTech", labelEn: "PropTech" },
  { id: "biotech", labelTr: "BioTech", labelEn: "BioTech" },
  { id: "consumer_apps", labelTr: "Consumer Apps", labelEn: "Consumer Apps" },
  { id: "web3", labelTr: "Web3", labelEn: "Web3" },
  { id: "other", labelTr: "Diğer", labelEn: "Other" },
];

export function normalizeExperienceLevel(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  if (EXPERIENCE_LEVEL_ALIASES[v]) return EXPERIENCE_LEVEL_ALIASES[v];
  if (EXPERIENCE_LEVELS.some((o) => o.id === v)) return v;
  return v;
}

export function normalizeExperienceLevels(value) {
  const raw = Array.isArray(value) ? value : value != null && value !== "" ? [value] : [];
  return [...new Set(raw.map(normalizeExperienceLevel).filter(Boolean))];
}

/** Highest seniority band for Career GPS / legacy single field */
export function primaryExperienceLevel(levels = []) {
  const list = normalizeExperienceLevels(levels);
  if (!list.length) return "";
  return list.reduce((best, id) => {
    const rank = EXPERIENCE_RANK[id] ?? -1;
    const bestRank = EXPERIENCE_RANK[best] ?? -1;
    return rank > bestRank ? id : best;
  }, list[0]);
}

export function normalizeCompanySizes(value) {
  const raw = Array.isArray(value) ? value : [];
  const allowed = new Set(COMPANY_SIZE_OPTIONS.map((o) => o.id));
  return [...new Set(raw.map((id) => String(id).trim()).filter((id) => allowed.has(id)))];
}

export function getExperienceLabel(id, lang = "TR") {
  const row = EXPERIENCE_LEVELS.find((o) => o.id === id);
  if (!row) return id || "";
  return String(lang).toUpperCase() === "TR" ? row.labelTr : row.labelEn;
}

export const LANGUAGE_PROFICIENCY_OPTIONS = [
  { value: "native", labelTr: "Ana Dil", labelEn: "Native" },
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
];

export function getLanguageLevelLabel(value, lang = "TR") {
  const row = LANGUAGE_PROFICIENCY_OPTIONS.find((o) => o.value === value);
  if (!row) return value || "";
  if (row.label) return row.label;
  return String(lang).toUpperCase() === "TR" ? row.labelTr : row.labelEn;
}

export function getCompanySizeLabel(id, lang = "TR") {
  const row = COMPANY_SIZE_OPTIONS.find((o) => o.id === id);
  if (!row) return id || "";
  return String(lang).toUpperCase() === "TR" ? row.labelTr : row.labelEn;
}
