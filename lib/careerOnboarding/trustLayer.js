/**
 * Trust Layer V1 — explain predictions from existing intelligence only.
 */

import { getIndustryLabel, getRoleLabel } from "./industries.js";
import { normalizeTraitScoresTo100 } from "../careerIntelligence/evidenceDimensions.js";
import { buildWhyThisRole, isGenericExplanation } from "./snapshotWow.js";

export { isGenericExplanation };

function isTr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

const FAMILY_LABEL = {
  PRODUCT: { en: "Product, Startup and Innovation-focused", tr: "Product, Startup ve İnovasyon odaklı" },
  OPERATIONS: { en: "Operations, Program and Delivery-focused", tr: "Operasyon, Program ve Teslimat odaklı" },
  BUSINESS: { en: "Strategy, Consulting and Business-focused", tr: "Strateji, Danışmanlık ve İş odaklı" },
  DATA: { en: "Data, Analytics and Insight-focused", tr: "Veri, Analitik ve İçgörü odaklı" },
  SOFTWARE: { en: "Software, Engineering and Technical", tr: "Yazılım, Mühendislik ve Teknik" },
  MARKETING: { en: "Growth, Marketing and Market-facing", tr: "Growth, Pazarlama ve Pazar odaklı" },
  HR: { en: "People, Talent and HR-focused", tr: "People, Talent ve İK odaklı" },
  FINANCE: { en: "Finance, Modeling and Investment-focused", tr: "Finans, Modelleme ve Yatırım odaklı" },
};

function industryBullet(id, lang) {
  const tr = isTr(lang);
  const label = getIndustryLabel(id, lang);
  if (/entrepreneurship|startup/i.test(id)) return tr ? "Girişimcilik ilgisi" : "Entrepreneurship interest";
  if (id === "ai") return tr ? "AI sektörü" : "AI sector";
  if (id === "technology") return tr ? "Teknoloji sektörü" : "Technology sector";
  return tr ? `${label} sektörü` : `${label} sector`;
}

function roleBullet(roleId, lang) {
  const tr = isTr(lang);
  const label = getRoleLabel(roleId, lang);
  if (/product/i.test(roleId)) return tr ? "Ürün odaklı roller" : "Product-oriented roles";
  if (/founder/i.test(roleId)) return tr ? "Founder yönelimi" : "Founder direction";
  return tr ? `${label} hedefi` : `${label} selected`;
}

/** Feature 1 — Why This Prediction? */
export function buildWhyThisPrediction({
  goals = {},
  roleFamily = "BUSINESS",
  identityTitle = "",
  lang = "EN",
} = {}) {
  const tr = isTr(lang);
  const bullets = [];
  for (const id of goals.industries || []) {
    bullets.push(industryBullet(id, lang));
  }
  const roles = [goals.primaryRole, ...(goals.targetRoles || [])].filter(Boolean);
  const seen = new Set(bullets.map((b) => b.toLowerCase()));
  for (const roleId of roles.slice(0, 3)) {
    const b = roleBullet(roleId, lang);
    if (!seen.has(b.toLowerCase())) {
      bullets.push(b);
      seen.add(b.toLowerCase());
    }
  }
  if (identityTitle && bullets.length < 4) {
    bullets.push(tr ? `${identityTitle} kimliği` : `${identityTitle} identity`);
  }

  const familyRow = FAMILY_LABEL[roleFamily] || FAMILY_LABEL.BUSINESS;
  const closing = tr
    ? `Bu y?n, recruiter taraf?ndan ${familyRow.tr} rollerinde daha h?zl? okunur.`
    : `This direction is easier to read in ${familyRow.en} careers.`;

  return {
    title: tr ? "Bu Tahmin Neden?" : "Why This Prediction?",
    intro: tr
      ? "Bu sonucu en ?ok ?u se?imlerin etkiliyor:"
      : "This prediction is mainly influenced by:",
    bullets: bullets.slice(0, 4),
    closing,
  };
}

function levelFromScore(score) {
  const n = Number(score) || 0;
  if (n >= 68) return "High";
  if (n >= 48) return "Medium";
  return "Low";
}

const SIGNAL_ROWS = [
  { key: "ownership", en: "Ownership", tr: "Sahiplenme" },
  { key: "execution", en: "Execution", tr: "Execution" },
  { key: "analytics", en: "Analytical Thinking", tr: "Analitik Düşünme" },
  { key: "leadership", en: "Leadership", tr: "Liderlik" },
  { key: "communication", en: "Communication", tr: "İletişim" },
];

/** Feature 2 — Strongest Signals breakdown */
export function buildSignalBreakdown({ evidence = {}, traitScores = {}, lang = "EN" } = {}) {
  const tr = isTr(lang);
  const traitNorm = normalizeTraitScoresTo100(traitScores);
  const traitFallback = {
    ownership: traitNorm.execution * 0.5 + traitNorm.leadership * 0.3 + traitNorm.risk_taking * 0.2,
    execution: traitNorm.execution,
    analytics: traitNorm.analytical_thinking,
    leadership: traitNorm.leadership,
    communication: traitNorm.communication,
  };

  const rows = SIGNAL_ROWS.map(({ key, en, tr: trLabel }) => {
    const score = evidence[key] ?? traitFallback[key] ?? 0;
    const level = levelFromScore(score);
    return {
      key,
      label: tr ? trLabel : en,
      level,
      levelLabel: tr
        ? { High: "Yüksek", Medium: "Orta", Low: "Düşük" }[level]
        : level,
      score: Math.round(Number(score) || 0),
    };
  }).sort((a, b) => b.score - a.score);

  return {
    title: tr ? "En Güçlü Sinyaller" : "Strongest Signals",
    rows,
  };
}

const MATCH_FACTORS = {
  PRODUCT: {
    en: (f) => `${f} increase Product Manager alignment.`,
    tr: (f) => `${f} Product Manager uyumunu artırıyor.`,
  },
  OPERATIONS: {
    en: (f) => `${f} strengthen Operations and Program fit.`,
    tr: (f) => `${f} Operasyon ve Program uyumunu güçlendiriyor.`,
  },
  BUSINESS: {
    en: (f) => `${f} make strategy and business analyst direction easier to read.`,
    tr: (f) => `${f} strateji ve business analyst uyumunu güçlendiriyor.`,
  },
  DATA: {
    en: (f) => `${f} make data and analytics direction easier to read.`,
    tr: (f) => `${f} veri ve analitik rol uyumunu güçlendiriyor.`,
  },
  SOFTWARE: {
    en: (f) => `${f} make software engineering direction easier to read.`,
    tr: (f) => `${f} yazılım mühendisliği uyumunu güçlendiriyor.`,
  },
  MARKETING: {
    en: (f) => `${f} make growth and marketing direction easier to read.`,
    tr: (f) => `${f} growth ve marketing uyumunu güçlendiriyor.`,
  },
  HR: {
    en: (f) => `${f} make talent and people operations direction easier to read.`,
    tr: (f) => `${f} talent ve people operations uyumunu güçlendiriyor.`,
  },
  FINANCE: {
    en: (f) => `${f} make finance and modeling direction easier to read.`,
    tr: (f) => `${f} finans ve modelleme uyumunu güçlendiriyor.`,
  },
};

function matchFactorBullets({ goals, evidence, roleFamily, identityTitle, topMatch, lang }) {
  const tr = isTr(lang);
  const bullets = [];
  for (const id of goals.industries || []) {
    if (/entrepreneurship|startup/i.test(id)) bullets.push(tr ? "Girişimcilik seçildi" : "Entrepreneurship selected");
    else bullets.push(industryBullet(id, lang));
  }
  const roles = [goals.primaryRole, ...(goals.targetRoles || [])].filter(Boolean);
  for (const roleId of roles.slice(0, 2)) {
    bullets.push(tr ? `${getRoleLabel(roleId, lang)} seçildi` : `${getRoleLabel(roleId, lang)} selected`);
  }
  if (/startup|founder/i.test((goals.industries || []).join(" ") + identityTitle)) {
    bullets.push(tr ? "Startup tercihi" : "Startup preference");
  }
  if ((evidence.execution || 0) >= 55 || (evidence.ownership || 0) >= 55) {
    bullets.push(tr ? "Uygulama odaklı profil" : "Execution-oriented profile");
  }
  if ((evidence.analytics || 0) >= 55 && ["DATA", "FINANCE", "BUSINESS"].includes(roleFamily)) {
    bullets.push(tr ? "Analitik kanıt sinyali" : "Analytical evidence signal");
  }
  if ((evidence.technical_depth || 0) >= 55 && roleFamily === "SOFTWARE") {
    bullets.push(tr ? "Teknik derinlik sinyali" : "Technical depth signal");
  }
  if (topMatch?.strongSignals?.[0]) {
    bullets.push(topMatch.strongSignals[0]);
  }
  return [...new Set(bullets)].slice(0, 4);
}

/** Feature 3 — What Increased This Match? */
export function buildWhatIncreasedMatch({
  roleName = "",
  roleFamily = "BUSINESS",
  goals = {},
  evidence = {},
  identityTitle = "",
  topMatch = null,
  lang = "EN",
} = {}) {
  const tr = isTr(lang);
  const whyRole = buildWhyThisRole({ roleName, roleFamily, goals, evidence, identityTitle, lang });
  const factors = matchFactorBullets({ goals, evidence, roleFamily, identityTitle, topMatch, lang });
  const familyClosing = MATCH_FACTORS[roleFamily] || MATCH_FACTORS.BUSINESS;
  const factorText = factors.slice(0, 3).join(tr ? ", " : ", ");
  const closing = familyClosing[tr ? "tr" : "en"](factorText || (tr ? "Seçimlerin" : "Your selections"));

  return {
    title: tr ? `${roleName} rolü neden?` : `Why ${roleName}?`,
    intro: tr ? "En etkili faktörler:" : "Most influential factors:",
    bullets: factors.length ? factors : whyRole.bullets,
    closing,
    text: `${tr ? `${roleName} rolü neden?` : `Why ${roleName}?`} ${whyRole.intro} ${(factors.length ? factors : whyRole.bullets).join(", ")}. ${closing}`,
  };
}

/** Feature 4 — Enhanced gap trust block */
function gapProofBullets(gapKey, gapTitle, lang) {
  const tr = isTr(lang);
  const text = String(gapKey || gapTitle || "").toLowerCase();
  if (/product ownership|roadmap/.test(text)) {
    return tr
      ? ["Roadmap sahipliği", "Önceliklendirme kararları", "Ürün metrikleri"]
      : ["Roadmap ownership", "Prioritization decisions", "Product metrics"];
  }
  if (/financial model|forecast/.test(text)) {
    return tr
      ? ["Varsayım tablosu", "Senaryo analizi", "Variance yorumu"]
      : ["Assumption table", "Scenario analysis", "Variance commentary"];
  }
  if (/recruitment|interview process/.test(text)) {
    return tr
      ? ["Aday pipeline", "Mülakat scorecard", "İşe alım sonucu"]
      : ["Candidate pipeline", "Interview scorecard", "Hiring outcome"];
  }
  if (/github|technical project|deployment/.test(text)) {
    return tr
      ? ["İncelenebilir repository", "Canlı deployment", "Teknik karar dokümantasyonu"]
      : ["Inspectable repository", "Live deployment", "Technical decision documentation"];
  }
  if (/sql|dashboard|analytics/.test(text)) {
    return tr
      ? ["SQL sorgusu", "Dashboard çıktısı", "Veriden iş kararı"]
      : ["SQL query", "Dashboard output", "Business decision from data"];
  }
  return [];
}

function enhanceWhyItMatters(gapKey, gapTitle, whyItMatters, lang) {
  if (whyItMatters) return whyItMatters;
  const tr = isTr(lang);
  const text = String(gapKey || gapTitle || "").toLowerCase();
  if (/product ownership|roadmap/.test(text)) {
    return tr
      ? "Recruiter'lar fikirden uygulamaya ürün kararlarını taşıdığını kanıt arar."
      : "Recruiters want proof that you carried product decisions from idea to execution.";
  }
  return whyItMatters;
}

export function buildGapTrust({
  gapDetails = {},
  topMatch = null,
  fastestProof = "",
  lang = "EN",
} = {}) {
  const tr = isTr(lang);
  const expanded = gapProofBullets(gapDetails.key, gapDetails.title, lang);
  const missingProof = (topMatch?.missingSignals || []).slice(0, 3);
  if (gapDetails.evidenceMissing && !missingProof.includes(gapDetails.evidenceMissing)) {
    missingProof.unshift(gapDetails.evidenceMissing);
  }
  const bullets = expanded.length ? expanded : missingProof.slice(0, 3);
  if (!bullets.length && gapDetails.title) {
    bullets.push(gapDetails.title);
  }

  return {
    title: tr ? "Mevcut Açık" : "Current Gap",
    gapTitle: gapDetails.title || topMatch?.missingSignals?.[0] || "",
    whyItMatters: enhanceWhyItMatters(gapDetails.key, gapDetails.title, gapDetails.whyItMatters, lang),
    missingProof: bullets,
    fastestProof: fastestProof || gapDetails.action || "",
  };
}

/** Feature 5 — Prediction confidence explanation */
export function buildConfidenceTrust({
  confidence = "Low",
  confidenceSignals = {},
  confidenceReasons = [],
  lang = "EN",
} = {}) {
  const tr = isTr(lang);
  const limiting = [];
  const s = confidenceSignals;

  if (!s.hasCv) limiting.push(tr ? "Henüz CV yüklenmedi" : "No CV uploaded yet");
  if (s.matchConfidence === "Low" || s.matchConfidence === "Medium") {
    limiting.push(
      tr
        ? `${s.roleName || "Hedef rol"} için role özel kanıt sınırlı`
        : `Limited role-specific proof for ${s.roleName || "target role"}`
    );
  }
  if (!s.experienceAnswered || !s.hasExperienceProof) {
    limiting.push(tr ? "Deneyim verisi eksik veya sınırlı" : "Experience data is incomplete or limited");
  }
  if (!s.projectsAnswered || !s.hasProjectProof) {
    limiting.push(tr ? "Proje kanıtı henüz yeterli değil" : "Project proof is not yet sufficient");
  }
  if (!s.hasSector) limiting.push(tr ? "Sektör odağı eksik" : "Industry focus is missing");
  if (s.dnaCount < 4) limiting.push(tr ? "Career DNA henüz tamamlanmadı" : "Career DNA is not complete yet");

  const reasons =
    confidence === "High"
      ? confidenceReasons.slice(0, 3)
      : [...new Set(limiting)].slice(0, 3);

  const title =
    confidence === "High"
      ? tr ? "Güven neden yüksek?" : "Why is confidence high?"
      : confidence === "Medium"
        ? tr ? "Güven neden orta?" : "Why is confidence medium?"
        : tr ? "Güven neden düşük?" : "Why is confidence low?";

  const footer =
    confidence === "High"
      ? tr
        ? "Mevcut kanıtlar tahmini güçlü biçimde destekliyor."
        : "Current evidence strongly supports this prediction."
      : tr
        ? "Ek kariyer kanıtları eklendikçe tahmin daha isabetli hale gelir."
        : "The prediction will become more accurate after adding additional career evidence.";

  return {
    level: confidence,
    title,
    reasons,
    footer,
  };
}

/** Assemble full preview trust layer */
export function buildPreviewTrustLayer(ctx = {}) {
  const {
    goals,
    roleFamily,
    identityTitle,
    evidence,
    traitScores,
    topMatch,
    gapDetails,
    confidence,
    confidenceSignals,
    confidenceReasons,
    fastestProof,
    lang,
  } = ctx;

  return {
    whyThisPrediction: buildWhyThisPrediction({ goals, roleFamily, identityTitle, lang }),
    signalBreakdown: buildSignalBreakdown({ evidence, traitScores, lang }),
    whatIncreasedMatch: buildWhatIncreasedMatch({
      roleName: topMatch?.roleName || "",
      roleFamily,
      goals,
      evidence,
      identityTitle,
      topMatch,
      lang,
    }),
    gapTrust: buildGapTrust({
      gapDetails,
      topMatch,
      fastestProof,
      lang,
    }),
    confidenceTrust: buildConfidenceTrust({
      confidence,
      confidenceSignals,
      confidenceReasons,
      lang,
    }),
  };
}
