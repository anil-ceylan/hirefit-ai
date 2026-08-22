/**
 * Identity Engine V3 — evidence-oriented composite identities.
 * Composes domain modifier + core archetype from normalized evidence and role context.
 */

import { resolveCareerArchetype, scoreCareerDnaAnswers } from "../careerOnboarding/careerDna.js";
import { buildCvEvidenceLayer, rankEvidenceDimensions } from "./cvEvidenceLayer.js";
import { clampEvidence } from "./evidenceDimensions.js";
import { buildIdentityDebugReport } from "./identityDebug.js";

function isTr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

/** Domain modifiers — role/context flavored identity blocks */
const DOMAIN_IDENTITIES = [
  {
    id: "product_builder",
    labelEn: "Product Builder",
    labelTr: "Product Builder",
    weights: { ownership: 0.35, execution: 0.25, customer_exposure: 0.2, business_acumen: 0.12, innovation: 0.08 },
    families: ["PRODUCT"],
  },
  {
    id: "technical_builder",
    labelEn: "Technical Builder",
    labelTr: "Technical Builder",
    weights: { technical_depth: 0.35, execution: 0.25, project_complexity: 0.2, analytics: 0.1, ownership: 0.1 },
    families: ["SOFTWARE"],
  },
  {
    id: "startup_builder",
    labelEn: "Startup Builder",
    labelTr: "Startup Builder",
    weights: { startup_exposure: 0.35, ownership: 0.25, innovation: 0.2, execution: 0.1, risk: 0.1 },
    families: ["PRODUCT", "MARKETING"],
    industries: ["entrepreneurship", "ai"],
  },
  {
    id: "growth_builder",
    labelEn: "Growth Builder",
    labelTr: "Growth Builder",
    weights: { customer_exposure: 0.28, innovation: 0.28, analytics: 0.22, execution: 0.14, ownership: 0.08 },
    families: ["MARKETING"],
  },
  {
    id: "product_strategist",
    labelEn: "Product Strategist",
    labelTr: "Product Strategist",
    weights: { strategic_thinking: 0.28, ownership: 0.25, business_acumen: 0.22, customer_exposure: 0.15, execution: 0.1 },
    families: ["PRODUCT"],
  },
  {
    id: "business_strategist",
    labelEn: "Business Strategist",
    labelTr: "Business Strategist",
    weights: { strategic_thinking: 0.3, business_acumen: 0.3, analytics: 0.2, communication: 0.2 },
    families: ["BUSINESS"],
  },
  {
    id: "growth_strategist",
    labelEn: "Growth Strategist",
    labelTr: "Growth Strategist",
    weights: { strategic_thinking: 0.25, customer_exposure: 0.25, analytics: 0.25, innovation: 0.15, communication: 0.1 },
    families: ["MARKETING", "BUSINESS"],
  },
  {
    id: "operations_strategist",
    labelEn: "Operations Strategist",
    labelTr: "Operations Strategist",
    weights: { strategic_thinking: 0.25, execution: 0.25, business_acumen: 0.2, collaboration: 0.15, analytics: 0.15 },
    families: ["OPERATIONS"],
  },
  {
    id: "systems_operator",
    labelEn: "Systems Operator",
    labelTr: "Systems Operator",
    weights: { execution: 0.3, collaboration: 0.25, project_complexity: 0.2, analytics: 0.15, ownership: 0.1 },
    families: ["OPERATIONS"],
  },
  {
    id: "execution_operator",
    labelEn: "Execution Operator",
    labelTr: "Execution Operator",
    weights: { execution: 0.4, ownership: 0.25, project_complexity: 0.2, leadership: 0.15 },
    families: ["OPERATIONS", "PRODUCT"],
  },
  {
    id: "people_operator",
    labelEn: "People Operator",
    labelTr: "People Operator",
    weights: { collaboration: 0.28, leadership: 0.28, communication: 0.24, networking: 0.2 },
    families: ["HR"],
    requiresFamily: "HR",
  },
  {
    id: "data_analyst",
    labelEn: "Data Analyst",
    labelTr: "Data Analyst",
    weights: { analytics: 0.4, research_orientation: 0.25, technical_depth: 0.2, execution: 0.15 },
    families: ["DATA"],
  },
  {
    id: "business_analyst",
    labelEn: "Business Analyst",
    labelTr: "Business Analyst",
    weights: { analytics: 0.3, business_acumen: 0.3, communication: 0.2, strategic_thinking: 0.2 },
    families: ["BUSINESS", "DATA"],
  },
  {
    id: "financial_analyst",
    labelEn: "Financial Analyst",
    labelTr: "Financial Analyst",
    weights: { analytics: 0.35, business_acumen: 0.35, research_orientation: 0.15, execution: 0.15 },
    families: ["FINANCE"],
  },
  {
    id: "research_thinker",
    labelEn: "Research-Oriented Thinker",
    labelTr: "Research-Oriented Thinker",
    weights: { research_orientation: 0.4, analytics: 0.3, strategic_thinking: 0.15, innovation: 0.15 },
  },
  {
    id: "customer_thinker",
    labelEn: "Customer-Oriented Thinker",
    labelTr: "Customer-Oriented Thinker",
    weights: { customer_exposure: 0.38, innovation: 0.25, ownership: 0.2, business_acumen: 0.17 },
  },
];

/** Core archetype blocks — behavior pattern layer */
const CORE_IDENTITIES = [
  { id: "builder", labelEn: "Builder", labelTr: "Builder", weights: { ownership: 0.35, execution: 0.35, innovation: 0.15, startup_exposure: 0.15 } },
  { id: "strategist", labelEn: "Strategist", labelTr: "Strategist", weights: { strategic_thinking: 0.4, business_acumen: 0.3, analytics: 0.2, communication: 0.1 } },
  { id: "operator", labelEn: "Operator", labelTr: "Operator", weights: { execution: 0.4, collaboration: 0.3, project_complexity: 0.2, ownership: 0.1 } },
  { id: "analyst", labelEn: "Analyst", labelTr: "Analyst", weights: { analytics: 0.45, research_orientation: 0.3, strategic_thinking: 0.15, execution: 0.1 } },
  { id: "creator", labelEn: "Creator", labelTr: "Creator", weights: { innovation: 0.45, customer_exposure: 0.3, ownership: 0.15, execution: 0.1 } },
  { id: "leader", labelEn: "Leader", labelTr: "Leader", weights: { leadership: 0.4, ownership: 0.28, execution: 0.2, collaboration: 0.12 } },
  { id: "connector", labelEn: "Connector", labelTr: "Connector", weights: { networking: 0.32, collaboration: 0.32, communication: 0.24, customer_exposure: 0.12 } },
  { id: "innovator", labelEn: "Innovator", labelTr: "Innovator", weights: { innovation: 0.38, startup_exposure: 0.28, ownership: 0.22, execution: 0.12 } },
  { id: "founder_builder", labelEn: "Founder-Oriented Builder", labelTr: "Founder-Oriented Builder", weights: { startup_exposure: 0.32, ownership: 0.32, execution: 0.2, innovation: 0.16 } },
  { id: "executor", labelEn: "Executor", labelTr: "Executor", weights: { execution: 0.5, ownership: 0.25, project_complexity: 0.15, leadership: 0.1 } },
  { id: "researcher", labelEn: "Researcher", labelTr: "Researcher", weights: { research_orientation: 0.45, analytics: 0.35, strategic_thinking: 0.1, innovation: 0.1 } },
];

function scoreIdentity(def, evidence, traitNorm, familyBoost = 0) {
  let sum = 0;
  let wSum = 0;
  for (const [key, w] of Object.entries(def.weights || {})) {
    const v = key === "risk" ? traitNorm?.risk_taking : evidence?.[key];
    if (v != null) {
      sum += Number(v) * w;
      wSum += w;
    }
  }
  const base = wSum ? sum / wSum : 0;
  return clampEvidence(base + familyBoost);
}

function rankDomainIdentities(evidence, traitNorm, roleFamily, goals) {
  const primaryFamily = roleFamily?.primary || "BUSINESS";
  const industries = goals?.industries || [];
  const roles = [goals?.primaryRole, ...(goals?.targetRoles || [])].filter(Boolean);
  const founderHeavy = evidence.startup_exposure >= 62 || evidence.ownership >= 65;
  const productPrimary = ["PRODUCT", "SOFTWARE", "MARKETING"].includes(primaryFamily);
  const peopleAvg =
    (evidence.communication + evidence.leadership + evidence.networking + evidence.collaboration) / 4;
  const buildAvg =
    (evidence.ownership + evidence.execution + evidence.startup_exposure + evidence.innovation) / 4;

  return DOMAIN_IDENTITIES.map((def) => {
    let boost = 0;
    if (def.families?.includes(primaryFamily)) boost += 18;
    if (def.industries?.some((i) => industries.includes(i))) boost += 12;
    if (roleFamily?.secondary && def.families?.includes(roleFamily.secondary)) boost += 6;

    if (def.id === "startup_builder" && founderHeavy) boost += 16;
    if (def.id === "product_builder" && productPrimary) boost += 12;
    if (def.id === "product_strategist" && productPrimary && evidence.strategic_thinking >= 58) boost += 10;
    if (def.id === "execution_operator" && roles.some((r) => /project_manager|operations/i.test(r))) boost += 8;

    let score = scoreIdentity(def, evidence, traitNorm, boost);

    if (def.id === "people_operator") {
      if (def.requiresFamily && primaryFamily !== def.requiresFamily) score = clampEvidence(score - 28);
      else if (productPrimary && peopleAvg <= buildAvg + 8) score = clampEvidence(score - 22);
    }
    if (def.id === "customer_thinker" && productPrimary && founderHeavy) {
      score = clampEvidence(score - 10);
    }

    return { ...def, score, familyBoost: boost };
  }).sort((a, b) => b.score - a.score);
}

function rankCoreIdentities(evidence, traitNorm, dnaArchetypeId, context = {}) {
  const founderHeavy = context.founderHeavy;
  const productPrimary = context.productPrimary;

  const ranked = CORE_IDENTITIES.map((def) => {
    let score = scoreIdentity(def, evidence, traitNorm, 0);
    if (def.id === dnaArchetypeId) score = clampEvidence(score + 10);
    if (def.id === "founder_builder" && dnaArchetypeId === "founder") score = clampEvidence(score + 14);
    if (def.id === "builder" && dnaArchetypeId === "founder") score = clampEvidence(score + 8);
    if (def.id === "innovator" && dnaArchetypeId === "founder") score = clampEvidence(score + 6);
    if (def.id === "executor" && dnaArchetypeId === "builder") score = clampEvidence(score + 4);
    if (def.id === "researcher" && dnaArchetypeId === "analyst") score = clampEvidence(score + 4);

    if (founderHeavy || productPrimary) {
      if (def.id === "founder_builder") score = clampEvidence(score + 12);
      if (def.id === "builder") score = clampEvidence(score + 8);
      if (def.id === "executor") score = clampEvidence(score + 6);
      if (def.id === "operator") score = clampEvidence(score + 5);
      if (def.id === "leader") score = clampEvidence(score - 8);
      if (def.id === "connector") score = clampEvidence(score - 10);
    }

    return { ...def, score };
  }).sort((a, b) => b.score - a.score);
  return ranked;
}

function labelFor(def, lang) {
  return isTr(lang) ? def.labelTr || def.labelEn : def.labelEn;
}

function blocksSimilar(a, b) {
  const x = String(a || "").toLowerCase();
  const y = String(b || "").toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  const strip = (s) => s.replace(/\s+(builder|strategist|operator|analyst|thinker)$/i, "").trim();
  const xs = strip(x);
  const ys = strip(y);
  if (xs === ys) return true;
  if (xs.includes(ys) || ys.includes(xs)) return true;
  const shared = ["builder", "strategist", "operator", "analyst"];
  return shared.some((w) => x.includes(w) && y.includes(w) && x !== y);
}

const ARCHETYPE_CORE_MAP = {
  leader: "leader",
  founder: "founder_builder",
  builder: "builder",
  strategist: "strategist",
  operator: "operator",
  analyst: "analyst",
  creator: "creator",
  researcher: "researcher",
  communicator: "connector",
};

function pickCoreIdentity(domain, coreRanked, rankedArchetypes, lang, context = {}) {
  const domainLabel = labelFor(domain, lang);
  const preferBuild = context.founderHeavy || context.productPrimary;

  const ordered = preferBuild
    ? [...coreRanked].sort((a, b) => {
        const buildIds = new Set(["founder_builder", "builder", "executor", "operator", "innovator"]);
        const aBonus = buildIds.has(a.id) ? 5 : 0;
        const bBonus = buildIds.has(b.id) ? 5 : 0;
        return b.score + bBonus - (a.score + aBonus);
      })
    : coreRanked;

  for (const candidate of ordered) {
    if (!blocksSimilar(domainLabel, labelFor(candidate, lang))) return candidate;
  }
  for (const row of rankedArchetypes || []) {
    const coreId = ARCHETYPE_CORE_MAP[row.id] || row.id;
    const def = CORE_IDENTITIES.find((c) => c.id === coreId);
    if (def && !blocksSimilar(domainLabel, labelFor(def, lang))) {
      return { ...def, score: row.score };
    }
  }
  return coreRanked[0];
}

const EVIDENCE_PHRASES_EN = {
  ownership: "ownership and end-to-end accountability",
  leadership: "leadership and team direction",
  execution: "reliable execution under pressure",
  analytics: "analytical rigor and evidence-based decisions",
  communication: "clear communication across stakeholders",
  technical_depth: "technical depth and hands-on problem solving",
  business_acumen: "business judgment and commercial thinking",
  startup_exposure: "startup-style experimentation and ambiguity",
  customer_exposure: "customer empathy and market-facing work",
  project_complexity: "handling complex, multi-stakeholder projects",
  innovation: "experimentation and creative problem framing",
  collaboration: "cross-functional collaboration",
  strategic_thinking: "structured strategic thinking",
  research_orientation: "research-driven curiosity",
  networking: "relationship building and network leverage",
};

const EVIDENCE_PHRASES_TR = {
  ownership: "sahiplenme ve uçtan uca sorumluluk",
  leadership: "liderlik ve ekip yönlendirme",
  execution: "baskı altında güvenilir uygulama",
  analytics: "analitik titizlik ve kanıta dayalı karar",
  communication: "paydaşlar arası net iletişim",
  technical_depth: "teknik derinlik ve pratik problem çözme",
  business_acumen: "iş yargısı ve ticari düşünme",
  startup_exposure: "startup tarzı deneme-yanılma ve belirsizlik",
  customer_exposure: "müşteri empati ve pazar yüzü",
  project_complexity: "karmaşık, çok paydaşlı projeler",
  innovation: "deneyim ve yaratıcı problem çerçeveleme",
  collaboration: "fonksiyonlar arası iş birliği",
  strategic_thinking: "yapılandırılmış stratejik düşünme",
  research_orientation: "araştırma odaklı merak",
  networking: "ilişki kurma ve network kullanımı",
};

function buildIdentityExplanation({ domain, core, topEvidence, lang, context = {} }) {
  const tr = isTr(lang);
  const phrases = tr ? EVIDENCE_PHRASES_TR : EVIDENCE_PHRASES_EN;

  const priorityKeys =
    context.founderHeavy || context.productPrimary
      ? ["ownership", "execution", "startup_exposure", "customer_exposure", "innovation", "business_acumen"]
      : null;

  const ranked = priorityKeys
    ? [...topEvidence].sort((a, b) => {
        const ai = priorityKeys.indexOf(a.key);
        const bi = priorityKeys.indexOf(b.key);
        const aPri = ai >= 0 ? 100 - ai : 0;
        const bPri = bi >= 0 ? 100 - bi : 0;
        return b.score + bPri - (a.score + aPri);
      })
    : topEvidence;

  const signals = ranked
    .slice(0, 3)
    .map(({ key }) => phrases[key])
    .filter(Boolean);
  const signalText = signals.length
    ? signals.join(tr ? ", " : ", ")
    : tr
      ? "uygulama ve analitik düşünme"
      : "execution and analytical thinking";

  const domainLabel = labelFor(domain, lang);
  const coreLabel = labelFor(core, lang);

  if (tr) {
    return `${domainLabel} + ${coreLabel} profilin, ${signalText} sinyallerini tutarlı biçimde gösteriyor. Bu örüntü erken aşama ürün liderleri, startup operatörleri ve belirsizlikte sonuç üreten profillerde sık görülür.`;
  }
  return `Your ${domainLabel} + ${coreLabel} profile consistently shows signals of ${signalText}. This pattern appears frequently among early-stage product leaders, startup operators, and profiles that ship outcomes through ambiguity.`;
}

const STRENGTH_LABELS = {
  ownership: { en: "Ownership", tr: "Sahiplenme" },
  leadership: { en: "Leadership", tr: "Liderlik" },
  execution: { en: "Execution", tr: "Uygulama" },
  analytics: { en: "Analytics", tr: "Analitik" },
  communication: { en: "Communication", tr: "İletişim" },
  technical_depth: { en: "Technical Depth", tr: "Teknik Derinlik" },
  business_acumen: { en: "Business Acumen", tr: "İş Zekâsı" },
  startup_exposure: { en: "Startup Exposure", tr: "Startup Deneyimi" },
  customer_exposure: { en: "Customer Focus", tr: "Müşteri Odaklılık" },
  project_complexity: { en: "Complex Delivery", tr: "Karmaşık Teslimat" },
  innovation: { en: "Innovation", tr: "İnovasyon" },
  collaboration: { en: "Collaboration", tr: "İş Birliği" },
  strategic_thinking: { en: "Strategic Thinking", tr: "Stratejik Düşünme" },
  research_orientation: { en: "Research", tr: "Araştırma" },
  networking: { en: "Networking", tr: "Network" },
};

function buildStrengthProfile(evidence, lang) {
  const tr = isTr(lang);
  const ranked = rankEvidenceDimensions(evidence, 15);
  const label = (key) => {
    const row = STRENGTH_LABELS[key];
    return tr ? row?.tr || key : row?.en || key;
  };

  const top = ranked.filter((r) => r.score >= 62).slice(0, 3).map((r) => label(r.key));
  const emerging = ranked.filter((r) => r.score >= 48 && r.score < 62).slice(0, 2).map((r) => label(r.key));
  const growth = ranked
    .filter((r) => r.score < 48)
    .slice(-3)
    .reverse()
    .map((r) => label(r.key));

  if (!top.length && ranked[0]) top.push(label(ranked[0].key));
  if (!growth.length) {
    const weak = [...ranked].sort((a, b) => a.score - b.score).slice(0, 2);
    growth.push(...weak.map((r) => label(r.key)));
  }

  return {
    topStrengths: top,
    emergingStrengths: emerging,
    growthAreas: growth,
    rankedEvidence: ranked,
  };
}

/**
 * Resolve ranked archetypes (top 3) — replaces winner-take-all collapse for internal use.
 */
export function resolveRankedArchetypes(traitScores) {
  const s = traitScores || {};
  const pick = (weights) =>
    Object.entries(weights).reduce((sum, [k, w]) => sum + (s[k] || 0) * w, 0);

  return [
    { id: "leader", score: pick({ leadership: 3, communication: 2, collaboration: 2 }) },
    { id: "founder", score: pick({ risk_taking: 3, leadership: 2, execution: 2 }) },
    { id: "builder", score: pick({ execution: 3, risk_taking: 2, ambiguity_tolerance: 1 }) },
    { id: "strategist", score: pick({ analytical_thinking: 3, ambiguity_tolerance: 2, communication: 1 }) },
    { id: "operator", score: pick({ execution: 3, collaboration: 2, analytical_thinking: 1 }) },
    { id: "analyst", score: pick({ analytical_thinking: 4, execution: 1 }) },
    { id: "creator", score: pick({ creativity: 4, communication: 1, risk_taking: 1 }) },
    { id: "researcher", score: pick({ analytical_thinking: 3, creativity: 2, execution: 1 }) },
    { id: "communicator", score: pick({ communication: 4, collaboration: 2, creativity: 1 }) },
  ]
    .sort((a, b) => b.score - a.score)
    .map((row, idx) => ({ ...row, rank: idx + 1 }));
}

/**
 * Main Identity Engine V3 entry.
 */
export function buildIdentityEngineV3({
  profile = {},
  roleFamily = null,
  dnaAnswers = null,
  readinessAnswers = null,
  cvText = "",
  lang = "TR",
} = {}) {
  const goals = profile.career_goals || {};
  const { evidence, sources, traitNorm, coreIntelligence } = buildCvEvidenceLayer({
    profile,
    dnaAnswers,
    readinessAnswers,
    cvText,
    roleFamily: roleFamily?.primary,
    targetRole: goals.primaryRole || goals.targetRoles?.[0],
    lang,
  });

  const answers = dnaAnswers || profile.career_dna?.answers || {};
  const traitRaw = profile.career_dna?.traitScores || profile.career_dna?.scores || scoreCareerDnaAnswers(answers, lang);
  const archetype = resolveCareerArchetype(traitRaw);
  const rankedArchetypes = resolveRankedArchetypes(traitRaw);

  const founderHeavy = evidence.startup_exposure >= 62 || evidence.ownership >= 65;
  const productPrimary = ["PRODUCT", "SOFTWARE", "MARKETING"].includes(roleFamily?.primary);
  const context = { founderHeavy, productPrimary };

  const domainRanked = rankDomainIdentities(evidence, traitNorm, roleFamily, goals);
  const coreRanked = rankCoreIdentities(evidence, traitNorm, archetype.id, context);

  const domain = domainRanked[0];
  const core = pickCoreIdentity(domain, coreRanked, rankedArchetypes, lang, context);

  const domainLabel = labelFor(domain, lang);
  const coreLabel = labelFor(core, lang);
  const title = blocksSimilar(domainLabel, coreLabel) ? domainLabel : `${domainLabel} + ${coreLabel}`;

  const topEvidence = rankEvidenceDimensions(evidence, 8);
  const explanation = buildIdentityExplanation({ domain, core, topEvidence, lang, context });
  const strengthProfile = buildStrengthProfile(evidence, lang);
  const debugReport = buildIdentityDebugReport({
    domain,
    core,
    domainRanked,
    coreRanked,
    evidence,
    traitNorm,
    title,
  });

  const result = {
    version: "identity-engine-v3.1",
    title,
    primaryModifier: domainLabel,
    secondaryCore: coreLabel,
    buildingBlocks: [domainLabel, coreLabel].filter((v, i, arr) => v && arr.indexOf(v) === i),
    domainId: domain.id,
    coreId: core.id,
    archetypeId: archetype.id,
    archetypeRanked: rankedArchetypes.slice(0, 3),
    domainRanked: domainRanked.slice(0, 4).map((d) => ({ id: d.id, score: d.score })),
    coreRanked: coreRanked.slice(0, 4).map((c) => ({ id: c.id, score: c.score })),
    explanation,
    evidence,
    evidenceSources: sources,
    strengthProfile,
    traitNorm,
    debugReport,
    signalContext: context,
  };
  Object.defineProperty(result, "coreIntelligence", {
    value: coreIntelligence,
    enumerable: false,
  });
  return result;
}

export { DOMAIN_IDENTITIES, CORE_IDENTITIES };
export { buildIdentityDebugReport } from "./identityDebug.js";
