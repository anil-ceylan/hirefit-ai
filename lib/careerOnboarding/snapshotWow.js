/**
 * Career Snapshot WOW — personalized presentation layer.
 * Uses existing intelligence only; no new scoring engines.
 */

import { getIndustryLabel } from "./industries.js";

function isTr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

const GENERIC_PHRASES = [
  /communication supports/i,
  /supports this because product roles/i,
  /your role focus and current evidence/i,
  /hedef rol ve mevcut kanıtlar aynı hatta/i,
  /the target role and current evidence point in the same direction/i,
  /execution and analytical thinking/i,
  /uygulama ve analitik düşünme/i,
  /this pattern appears frequently among early-stage product leaders/i,
  /erken aşama ürün liderleri, startup operatörleri/i,
];

export function isGenericExplanation(text = "") {
  const s = String(text || "").trim();
  if (!s) return true;
  return GENERIC_PHRASES.some((re) => re.test(s));
}

/** Family-specific career paths — no cross-family sharing */
const CAREER_PATHS = {
  PRODUCT: ["Product Management", "Startup Operations", "Founder-track careers"],
  OPERATIONS: ["Operations Management", "Program Management", "Process Excellence"],
  BUSINESS: ["Strategy & Consulting", "Business Development", "Corporate Strategy"],
  DATA: ["Data Analytics", "Business Intelligence", "People Analytics"],
  SOFTWARE: ["Software Engineering", "Solutions Architecture", "Technical Product"],
  MARKETING: ["Growth Marketing", "Brand Strategy", "Performance Marketing"],
  HR: ["Talent Acquisition", "People Operations", "Organizational Development"],
  FINANCE: ["Financial Analysis", "Corporate Finance", "Investment Research"],
};

const IDENTITY_NARRATIVES = {
  PRODUCT: {
    builder: {
      en: "You naturally move toward creating, improving and owning products.",
      tr: "Doğal olarak ürün oluşturma, geliştirme ve sahiplenme yönüne ilerliyorsun.",
    },
    strategist: {
      en: "You connect user problems, business tradeoffs and product direction with clarity.",
      tr: "Kullanıcı problemlerini, iş trade-off'larını ve ürün yönünü net biçimde bağlıyorsun.",
    },
    operator: {
      en: "You turn product ideas into shipped outcomes through disciplined execution.",
      tr: "Ürün fikirlerini disiplinli uygulama ile somut çıktılara dönüştürüyorsun.",
    },
    default: {
      en: "You naturally move toward creating, improving and owning products.",
      tr: "Doğal olarak ürün oluşturma, geliştirme ve sahiplenme yönüne ilerliyorsun.",
    },
  },
  OPERATIONS: {
    default: {
      en: "You organize complexity into repeatable systems and reliable delivery.",
      tr: "Karmaşıklığı tekrarlanabilir sistemlere ve güvenilir teslimata dönüştürüyorsun.",
    },
  },
  BUSINESS: {
    default: {
      en: "You structure ambiguous problems into decisions stakeholders can act on.",
      tr: "Belirsiz problemleri paydaşların harekete geçebileceği kararlara dönüştürüyorsun.",
    },
  },
  DATA: {
    default: {
      en: "You turn raw information into insight that changes how decisions get made.",
      tr: "Ham bilgiyi kararları değiştiren içgörüye dönüştürüyorsun.",
    },
  },
  SOFTWARE: {
    default: {
      en: "You solve technical problems by shipping working systems, not just ideas.",
      tr: "Teknik problemleri fikirle değil, çalışan sistemler üreterek çözüyorsun.",
    },
  },
  MARKETING: {
    default: {
      en: "You connect audience attention, messaging and measurable growth experiments.",
      tr: "Kitle ilgisi, mesajlaşma ve ölçülebilir büyüme denemelerini birbirine bağlıyorsun.",
    },
  },
  HR: {
    default: {
      en: "You understand people dynamics and turn them into hiring and team outcomes.",
      tr: "İnsan dinamiklerini anlayıp işe alım ve ekip sonuçlarına dönüştürüyorsun.",
    },
  },
  FINANCE: {
    default: {
      en: "You evaluate business performance through models, numbers and disciplined judgment.",
      tr: "İş performansını modeller, rakamlar ve disiplinli yargı ile değerlendiriyorsun.",
    },
  },
};

function identityKeyword(title = "") {
  const t = String(title).toLowerCase();
  if (/strategist/.test(t)) return "strategist";
  if (/operator|executor/.test(t)) return "operator";
  if (/builder|innovator|creator/.test(t)) return "builder";
  if (/analyst|researcher/.test(t)) return "analyst";
  return "default";
}

function pathsForFamily(family, lang) {
  const tr = isTr(lang);
  const paths = CAREER_PATHS[family] || CAREER_PATHS.BUSINESS;
  if (!tr) return paths;
  const trMap = {
    "Product Management": "Product Management",
    "Startup Operations": "Startup Operasyonları",
    "Founder-track careers": "Founder-track kariyerler",
    "Operations Management": "Operasyon Yönetimi",
    "Program Management": "Program Yönetimi",
    "Process Excellence": "Süreç Mükemmelliği",
    "Strategy & Consulting": "Strateji & Danışmanlık",
    "Business Development": "Business Development",
    "Corporate Strategy": "Kurumsal Strateji",
    "Data Analytics": "Veri Analitiği",
    "Business Intelligence": "Business Intelligence",
    "People Analytics": "People Analytics",
    "Software Engineering": "Yazılım Mühendisliği",
    "Solutions Architecture": "Solutions Architecture",
    "Technical Product": "Technical Product",
    "Growth Marketing": "Growth Marketing",
    "Brand Strategy": "Marka Stratejisi",
    "Performance Marketing": "Performance Marketing",
    "Talent Acquisition": "Talent Acquisition",
    "People Operations": "People Operations",
    "Organizational Development": "Organizational Development",
    "Financial Analysis": "Finansal Analiz",
    "Corporate Finance": "Kurumsal Finans",
    "Investment Research": "Yatırım Araştırması",
  };
  return paths.map((p) => trMap[p] || p);
}

export function buildIdentityWow({ identityTitle = "", roleFamily = "BUSINESS", lang = "EN" } = {}) {
  const tr = isTr(lang);
  const family = roleFamily || "BUSINESS";
  const key = identityKeyword(identityTitle);
  const familyNarratives = IDENTITY_NARRATIVES[family] || IDENTITY_NARRATIVES.BUSINESS;
  const narrativeRow = familyNarratives[key] || familyNarratives.default || familyNarratives.builder;
  const narrative = tr ? narrativeRow.tr : narrativeRow.en;
  const careerPaths = pathsForFamily(family, lang);

  const whyTitle = tr ? "Bu kimlik neden?" : "Why this identity?";
  const pathsIntro = tr
    ? "Bu y\u00f6n genelde \u015fu kariyer hatlar\u0131nda daha rahat okunur:"
    : "People with this profile often appear in:";

  return {
    title: identityTitle,
    whyTitle,
    narrative,
    careerPaths,
    pathsIntro,
    fullText: `${narrative} ${pathsIntro} ${careerPaths.join(", ")}.`,
  };
}

function industryBullets(industries = [], lang) {
  const tr = isTr(lang);
  return industries.slice(0, 2).map((id) => {
    const label = getIndustryLabel(id, lang);
    if (/entrepreneurship|startup/i.test(id)) return tr ? "Startup ilgisi" : "Startup interest";
    if (/ai|technology/i.test(id)) return tr ? `${label} odağı` : `${label} focus`;
    return tr ? `${label} sektör odağı` : `${label} sector focus`;
  });
}

function roleBullets(goals = {}, lang) {
  const tr = isTr(lang);
  const roles = [goals.primaryRole, ...(goals.targetRoles || [])].filter(Boolean);
  const text = roles.join(" ");
  const bullets = [];
  if (/product|pm|product_manager/i.test(text)) bullets.push(tr ? "Ürün odaklı hedefler" : "Product-oriented targets");
  if (/founder/i.test(text)) bullets.push(tr ? "Founder yönelimi" : "Founder direction");
  if (/data|analyst|analytics/i.test(text)) bullets.push(tr ? "Analitik rol hedefleri" : "Analytics role targets");
  if (/growth|marketing/i.test(text)) bullets.push(tr ? "Büyüme / pazarlama hedefleri" : "Growth / marketing targets");
  if (/finance|financial/i.test(text)) bullets.push(tr ? "Finans rol hedefleri" : "Finance role targets");
  if (/engineer|software|developer/i.test(text)) bullets.push(tr ? "Teknik rol hedefleri" : "Technical role targets");
  if (/talent|hr|people/i.test(text)) bullets.push(tr ? "İK / people hedefleri" : "HR / people targets");
  if (/operations|project_manager/i.test(text)) bullets.push(tr ? "Operasyon / proje hedefleri" : "Operations / project targets");
  return bullets;
}

function evidenceBullets(evidence = {}, family = "BUSINESS", lang) {
  const tr = isTr(lang);
  const bullets = [];
  const e = evidence || {};
  if (e.ownership >= 58) bullets.push(tr ? "Sahiplenme sinyalleri" : "Ownership signals");
  if (e.execution >= 58) bullets.push(tr ? "Cross-functional execution" : "Cross-functional execution");
  if (e.startup_exposure >= 58) bullets.push(tr ? "Startup tarzı deneyim" : "Startup-style exposure");
  if (e.customer_exposure >= 58 && family === "PRODUCT") bullets.push(tr ? "Müşteri odaklı düşünme" : "Customer-focused thinking");
  if (e.analytics >= 58 && ["DATA", "FINANCE", "BUSINESS"].includes(family)) {
    bullets.push(tr ? "Analitik kanıt sinyalleri" : "Analytical proof signals");
  }
  if (e.technical_depth >= 58 && family === "SOFTWARE") bullets.push(tr ? "Teknik derinlik sinyalleri" : "Technical depth signals");
  if (e.innovation >= 58 && ["MARKETING", "PRODUCT"].includes(family)) {
    bullets.push(tr ? "Deneyim / inovasyon sinyali" : "Experimentation signal");
  }
  if (e.leadership >= 58) bullets.push(tr ? "Liderlik sinyalleri" : "Leadership signals");
  return bullets;
}

const WHY_CLOSING = {
  PRODUCT: {
    en: "This combination appears frequently in successful Product Manager profiles.",
    tr: "Bu kan?tlar Product Manager y?n?n? daha anla??l?r k?l?yor.",
  },
  OPERATIONS: {
    en: "This combination appears frequently in strong Operations and Program profiles.",
    tr: "Bu kan?tlar Operasyon ve Program y?n?n? daha anla??l?r k?l?yor.",
  },
  BUSINESS: {
    en: "This combination appears frequently in successful strategy and business analyst profiles.",
    tr: "Bu kan?tlar strateji ve i? analizi y?n?n? daha anla??l?r k?l?yor.",
  },
  DATA: {
    en: "This combination appears frequently in high-performing analytics profiles.",
    tr: "Bu kan?tlar analitik rol y?n?n? daha anla??l?r k?l?yor.",
  },
  SOFTWARE: {
    en: "This combination appears frequently in engineers who grow into senior technical roles.",
    tr: "Bu kan?tlar teknik rol y?n?n? daha anla??l?r k?l?yor.",
  },
  MARKETING: {
    en: "This combination appears frequently in growth and marketing profiles with measurable outcomes.",
    tr: "Bu kan?tlar growth ve marketing y?n?n? daha anla??l?r k?l?yor.",
  },
  HR: {
    en: "This combination appears frequently in people-focused hiring and HR profiles.",
    tr: "Bu kan?tlar i?e al?m ve people operations y?n?n? daha anla??l?r k?l?yor.",
  },
  FINANCE: {
    en: "This combination appears frequently in finance profiles with strong modeling discipline.",
    tr: "Bu kan?tlar finans ve modelleme y?n?n? daha anla??l?r k?l?yor.",
  },
};

export function buildWhyThisRole({
  roleName = "",
  roleFamily = "BUSINESS",
  goals = {},
  evidence = {},
  identityTitle = "",
  lang = "EN",
} = {}) {
  const tr = isTr(lang);
  const family = roleFamily || "BUSINESS";
  const industries = goals.industries || [];

  const bullets = [
    ...industryBullets(industries, lang),
    ...roleBullets(goals, lang),
    ...evidenceBullets(evidence, family, lang),
  ];

  if (identityTitle && bullets.length < 4) {
    bullets.push(tr ? `${identityTitle} kimliği` : `${identityTitle} identity`);
  }

  const unique = [...new Set(bullets)].slice(0, 4);
  const closingRow = WHY_CLOSING[family] || WHY_CLOSING.BUSINESS;
  const closing = tr ? closingRow.tr : closingRow.en;

  const title = tr ? `${roleName} rolü neden?` : `Why ${roleName}?`;
  const intro = tr ? "Profilin şunları birleştiriyor:" : "Because your profile combines:";

  const text = `${title} ${intro} ${unique.join(tr ? ", " : ", ")}. ${closing}`;

  return { title, intro, bullets: unique, closing, text };
}

/** Personalized snapshot intro — max 3 paragraphs, always explains why */
export function buildWhatHireFitNoticed({
  identityWow = {},
  identityTitle = "",
  roleFamily = "BUSINESS",
  primaryMatch = null,
  gapDetails = {},
  evidence = {},
  goals = {},
  profile = {},
  lang = "EN",
} = {}) {
  const tr = isTr(lang);
  const basic = profile?.basic_profile || {};
  const leadership = profile?.career_readiness?.benchmarks?.leadership || "";
  const isFounder =
    /founder/i.test(basic.leadershipRole || "") ||
    /founder/i.test([goals.primaryRole, ...(goals.targetRoles || [])].join(" ")) ||
    leadership === "founder_cofounder" ||
    (evidence.ownership || 0) >= 68;

  const paragraphs = [];

  if (isFounder) {
    paragraphs.push(
      tr
        ? "Kurucu / sahiplenme yönün güçlü görünüyor; ancak bu sinyalin recruiter tarafında daha ikna edici olması için somut karar ve sonuç kanıtı gerekiyor."
        : "You already demonstrate unusually strong founder ownership signals — proof that you make decisions and carry outcomes is the most distinctive part of your profile."
    );
  } else if (roleFamily === "PRODUCT" || /product|founder/i.test(goals.primaryRole || "")) {
    paragraphs.push(
      tr
        ? "Profilin doğal olarak ürün odaklı kariyerlerle hizalanıyor — seçtiğin roller ve davranış sinyallerin Product yönlü yolları destekliyor."
        : "Your profile naturally aligns with Product-oriented careers — your target roles and behavior signals support product-facing paths."
    );
  } else if (identityWow.narrative && !isGenericExplanation(identityWow.narrative)) {
    paragraphs.push(identityWow.narrative);
  } else if (identityTitle) {
    paragraphs.push(
      tr
        ? `${identityTitle} kimliği, Career DNA yanıtların ve hedeflerin birleşiminden çıktı — bu yön profilinde en tutarlı sinyal.`
        : `Your ${identityTitle} identity emerged from your Career DNA answers and goals — it is the most consistent signal in your profile.`
    );
  }

  if (primaryMatch?.roleName && primaryMatch?.strongSignals?.length) {
    const signals = primaryMatch.strongSignals.slice(0, 2).join(tr ? " ve " : " and ");
    paragraphs.push(
      tr
        ? `${primaryMatch.roleName} eşleşmen ${signals} kanıtlarıyla destekleniyor — bu sinyaller recruiter'ın ilk okumasında görünür olmalı.`
        : `Your ${primaryMatch.roleName} match is supported by ${signals} — these signals should be visible in a recruiter's first read.`
    );
  } else if (primaryMatch?.roleName) {
    paragraphs.push(
      tr
        ? `${primaryMatch.roleName} yönü hedeflerin ve Career DNA profilinle uyumlu; kanıtları güçlendirdikçe eşleşme netleşir.`
        : `${primaryMatch.roleName} aligns with your goals and Career DNA profile; the match sharpens as you strengthen proof.`
    );
  }

  if (gapDetails?.title) {
    const why = gapDetails.whyItMatters || "";
    paragraphs.push(
      tr
        ? `Recruiter güvenini şu an en çok sınırlayan faktör: ${gapDetails.title}.${why ? ` ${why}` : ""}`
        : `The largest factor reducing recruiter confidence is currently ${gapDetails.title}.${why ? ` ${why}` : ""}`
    );
  }

  const unique = [...new Set(paragraphs.filter((p) => p && !isGenericExplanation(p)))].slice(0, 3);

  return {
    title: tr ? "HireFit'in fark ettiği" : "What HireFit noticed",
    paragraphs: unique,
  };
}

export function buildGrowthPotentialWow({
  candidateSignals = {},
  readinessScore = 50,
  evidence = {},
  profile = {},
  readinessAnswers = {},
  primaryMatch = null,
  lang = "EN",
} = {}) {
  const tr = isTr(lang);
  const s = candidateSignals || {};
  const e = evidence || {};
  const basic = profile.basic_profile || {};
  const goals = profile.career_goals || {};

  const projects = s.projects ?? 45;
  const leadership = s.leadership ?? 45;
  const roleClarity = s.roleClarity ?? 45;
  const english = s.english ?? 45;

  const isFounder =
    /founder/i.test(basic.leadershipRole || "") ||
    /founder/i.test([goals.primaryRole, ...(goals.targetRoles || [])].join(" ")) ||
    readinessAnswers?.leadership === "founder_cofounder";

  const learningSignal = Math.round((projects + english + roleClarity) / 3);
  const confidenceBoost = primaryMatch?.confidence === "High" ? 6 : primaryMatch?.confidence === "Medium" ? 3 : 0;

  const score = clamp(
    projects * 0.22 +
      leadership * 0.18 +
      (e.ownership || 48) * 0.2 +
      (e.innovation || 45) * 0.12 +
      learningSignal * 0.18 +
      (isFounder ? 10 : 0) +
      confidenceBoost
  );

  const drivers = [];
  if (projects >= 52) drivers.push(tr ? "Güçlü proje aktivitesi" : "Strong project activity");
  if (isFounder) drivers.push(tr ? "Founder mindset" : "Founder mindset");
  if ((e.ownership || 0) >= 55) drivers.push(tr ? "Yüksek sahiplenme sinyalleri" : "High ownership signals");
  if ((e.innovation || 0) >= 55) drivers.push(tr ? "Deneyim odaklı düşünme" : "Experiment-driven thinking");
  if (leadership >= 55) drivers.push(tr ? "Liderlik potansiyeli" : "Leadership upside");
  if (learningSignal >= 55) drivers.push(tr ? "Hızlı öğrenme sinyali" : "Fast learning signal");

  const uniqueDrivers = [...new Set(drivers)].slice(0, 3);
  if (!uniqueDrivers.length) uniqueDrivers.push(tr ? "Proje ve hedef netliği" : "Project and goal clarity");

  const aboveAvg = score >= 72;
  const summary = tr
    ? aboveAvg
      ? "Mevcut hazırlığın hâlâ gelişiyor, ancak büyüme trajektorin ortalamanın belirgin üzerinde."
      : "Büyüme potansiyelin mevcut hazırlık seviyenden daha güçlü okunuyor; doğru kanıtlarla hızla yükselebilir."
    : aboveAvg
      ? "Your current readiness is still developing, but your growth trajectory is significantly above average."
      : "Your growth upside reads stronger than current readiness; the right proof could accelerate you quickly.";

  const label = score >= 76 ? (tr ? "Yüksek" : "High") : score >= 58 ? (tr ? "Güçlü" : "Strong") : tr ? "Gelişen" : "Emerging";

  return {
    score,
    label,
    drivers: uniqueDrivers,
    summary,
    readinessNote: tr
      ? `Hazırlık: ${readinessScore}/100 · Büyüme potansiyeli: ${score}/100`
      : `Readiness: ${readinessScore}/100 · Growth potential: ${score}/100`,
    why: summary,
  };
}

/** Filter recruiter signals to family-appropriate language */
const FAMILY_BLOCKED_TERMS = {
  PRODUCT: [/recruitment/i, /interview process/i, /hiring outcome/i, /candidate communication/i, /people process/i, /hr network/i],
  HR: [/product metrics/i, /user research/i, /roadmap/i, /prd/i, /product ownership/i, /product network/i, /pm experience/i],
  FINANCE: [/product metrics/i, /user research/i, /campaign metrics/i, /growth network/i, /roadmap/i],
  MARKETING: [/financial modeling/i, /forecasting proof/i, /recruitment exposure/i],
  SOFTWARE: [/recruitment/i, /financial reporting/i, /campaign metrics/i],
  DATA: [/recruitment/i, /campaign metrics/i, /employer branding/i],
  OPERATIONS: [/user research proof/i, /financial modeling/i],
  BUSINESS: [/recruitment exposure/i, /interview process/i],
};

export function filterSignalsForFamily(family, signals = []) {
  const blocked = FAMILY_BLOCKED_TERMS[family] || [];
  return signals.filter((s) => !blocked.some((re) => re.test(String(s))));
}

export function recruiterConfidencePercent(primaryMatch = {}) {
  const evidenceConfidence = Number(primaryMatch.confidenceScore);
  if (Number.isFinite(evidenceConfidence)) return clamp(evidenceConfidence, 24, 94);
  const eq = clamp(primaryMatch.evidenceQuality ?? 55);
  const level = primaryMatch.confidence || "Low";
  if (level === "High") return clamp(eq * 0.92 + 8, 68, 94);
  if (level === "Medium") return clamp(eq * 0.82, 52, 78);
  return clamp(eq * 0.68, 32, 62);
}

export { GENERIC_PHRASES };
