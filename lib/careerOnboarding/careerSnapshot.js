/**
 * Career Snapshot + first-analysis helpers from onboarding profile data.
 */

import { getIndustryLabel, getRoleLabel, getIndustryContext, getPrioritizedRoles } from "./industries.js";
import { getReadinessPillarLabel } from "./readinessBenchmarks.js";
import {
  EXPERIENCE_LEVELS,
  WORK_MODE_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from "./onboardingOptions.js";
import { buildIdentityEngineV3 } from "../careerIntelligence/identityEngineV3.js";
import {
  buildCoreIntelligence,
  evaluateEvidenceForRole,
  evidenceLabels,
} from "../careerIntelligence/coreIntelligenceEngine.js";
import { buildRoleMatchExplanation } from "../careerIntelligence/roleMatchEvidence.js";
import { normalizeTraitScoresTo100 } from "../careerIntelligence/evidenceDimensions.js";
import { buildWeightedFitFoundation } from "./weightedFitEngine.js";
import { buildRecruiterView } from "./recruiterView.js";
import {
  buildGrowthPotentialWow,
  buildIdentityWow,
  buildWhyThisRole,
  buildWhatHireFitNoticed,
} from "./snapshotWow.js";
import { buildPreviewTrustLayer } from "./trustLayer.js";
import { scoreCareerDnaAnswers } from "./careerDna.js";
import { buildCareerReadiness } from "../careerIntelligence/buildIntelligence.js";
import {
  EXPERIENCE_SIGNAL_OPTIONS,
  LEADERSHIP_SIGNAL_OPTIONS,
  normalizeSignalSelection,
} from "./careerSignalSchema.js";

function isTr(lang) {
  return String(lang || "").toUpperCase() === "TR";
}

function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAny(text, patterns) {
  return patterns.some((re) => re.test(String(text || "")));
}

function optionLabel(options, id, lang) {
  const row = options.find((o) => o.id === id);
  if (!row) return id || "";
  return isTr(lang) ? row.labelTr : row.labelEn;
}

function humanRoleLabel(id, lang) {
  const label = getRoleLabel(id, lang);
  if (label && label !== id) return label;
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function resolvePillars(profile) {
  const readiness = profile?.career_readiness || {};
  if (Array.isArray(readiness.pillars) && readiness.pillars.length) {
    return readiness.pillars.map((p) => ({
      key: p.key,
      label: p.label || getReadinessPillarLabel(p.key, langCode(profile)),
      score: p.score ?? 0,
    }));
  }
  const lang = langCode(profile);
  const benchmarks = readiness.benchmarks || readiness.readinessAnswers || {};
  return Object.keys(benchmarks).map((key) => ({
    key,
    label: getReadinessPillarLabel(key, lang),
    score: 50,
  }));
}

function langCode(profileOrLang) {
  if (typeof profileOrLang === "string") {
    return profileOrLang.toUpperCase() === "TR" ? "TR" : "EN";
  }
  return "TR";
}

function resolveCareerIdentity(profile, goals, lang) {
  const tr = isTr(lang);
  const basic = profile?.basic_profile || {};
  const dna = profile?.career_dna || {};
  const scores = dna.scores || dna.traitScores || {};
  const text = norm([
    goals.primaryRole,
    ...(goals.targetRoles || []),
    ...(profile?.best_fit_roles || []),
    profile?.career_identity,
    basic.department,
    basic.degree,
    basic.university,
  ].join(" "));
  const builder = Number(scores.builder || 0);
  const analyst = Number(scores.analyst || scores.strategist || 0);
  const creator = Number(scores.creator || 0);
  const operator = Number(scores.operator || 0);

  if (builder >= 4 || hasAny(text, [/founder|giri[sş]im|startup|builder|product/])) {
    if (hasAny(text, [/product|urun|pm/])) return tr ? "Product-Oriented Generalist" : "Product-Oriented Generalist";
    return tr ? "Builder" : "Builder";
  }
  if (hasAny(text, [/data|analiz|analysis|analyst|sql|analytics/]) || analyst >= 4) {
    return tr ? "Analytical Operator" : "Analytical Operator";
  }
  if (hasAny(text, [/growth|marketing|gtm|pazarlama|buyume/]) || creator >= 4) {
    return tr ? "Growth Explorer" : "Growth Explorer";
  }
  if (hasAny(text, [/engineer|developer|software|technical|yazilim|muhendis/])) {
    return tr ? "Technical Problem Solver" : "Technical Problem Solver";
  }
  if (operator >= 4) return tr ? "Analytical Operator" : "Analytical Operator";
  return tr ? "Product-Oriented Generalist" : "Product-Oriented Generalist";
}

function topRoleDirections(profile, goals, lang) {
  const roles = [
    goals.primaryRole,
    goals.secondaryRole,
    goals.tertiaryRole,
    ...(goals.targetRoles || []),
    ...(profile?.best_fit_roles || []),
  ].filter(Boolean);
  const unique = [...new Set(roles)].slice(0, 3);
  if (unique.length) return unique.map((id) => humanRoleLabel(id, lang)).filter(Boolean);
  return ["Product Manager", "Product Analyst", "Growth Associate"];
}

function strongestSignalFromProfile(profile, pillars, lang) {
  const tr = isTr(lang);
  const basic = profile?.basic_profile || {};
  const goals = profile?.career_goals || {};
  const dna = profile?.career_dna || {};
  const scores = dna.scores || dna.traitScores || {};
  const traitNorm = normalizeTraitScoresTo100(scores);
  const evidence = dna.evidence || profile?.career_gps?.evidence || {};
  const roles = [goals.primaryRole, ...(goals.targetRoles || [])].join(" ");
  const founderContext =
    /founder/i.test(roles) ||
    /founder|co-?founder|startup|venture|giri[sş]im/i.test(basic.leadershipRole || "") ||
    profile?.career_readiness?.benchmarks?.leadership === "founder_cofounder";
  const productContext = /product|project_manager|pm\b/i.test(roles);

  if (founderContext) return tr ? "Kurucu / builder sahiplenmesi" : "Founder / builder ownership";
  if (productContext && (evidence.ownership >= 60 || traitNorm.execution >= 58)) {
    return tr ? "Ürün sahiplenmesi" : "Product ownership";
  }

  const text = [profile?.career_identity, basic.experienceLevel, basic.currentStatus, basic.leadershipRole]
    .map((x) => String(x || ""))
    .join(" ");
  const hasFounderProof =
    /founder|co-?founder|startup|venture|giri[sş]im/i.test(text) ||
    profile?.career_readiness?.benchmarks?.leadership === "founder_cofounder";
  if (hasFounderProof) {
    return tr ? "Kurucu deneyimi" : "Founder Experience";
  }
  const strongest = [...pillars].sort((a, b) => b.score - a.score)[0];
  if (strongest?.key === "leadership" || traitNorm.leadership >= 68) return tr ? "Liderlik" : "Leadership";
  if (traitNorm.execution >= 62) return tr ? "Proje sahipliği" : "Project Ownership";
  if (strongest?.key === "projects" || traitNorm.execution >= 55) return tr ? "Teknik projeler" : "Technical Projects";
  if (strongest?.key === "english" && !productContext) return tr ? "İletişim" : "Communication";
  if (strongest?.key === "experience" || basic.experienceLevel) return tr ? "Staj deneyimi" : "Internship Experience";
  return strongest?.label || (tr ? "Uygulama" : "Execution");
}

function readinessLabel(score, _lang) {
  const n = clamp(score ?? 0);
  if (n <= 39) return "Early Stage";
  if (n <= 59) return "Building Foundation";
  if (n <= 74) return "Emerging Candidate";
  if (n <= 89) return "Strong Direction";
  return "Highly Ready";
}

const ROLE_FAMILIES = {
  PRODUCT: {
    label: "Product",
    identity: "Product Builder",
    roles: [
      "product_manager",
      "product_operations",
      "ai_product_management",
      "fintech_product_manager",
      "game_product_management",
      "product_marketing",
      "customer_success",
      "ui_ux_designer",
    ],
    industries: ["technology", "ai", "gaming", "ecommerce", "entrepreneurship"],
    terms: /product|pm|roadmap|user|customer|ux|ai_product|fintech_product|ürün|urun/i,
  },
  OPERATIONS: {
    label: "Operations",
    identity: "Operations Builder",
    roles: [
      "operations_analyst",
      "operations_management",
      "process_improvement",
      "project_management",
      "project_manager",
      "program_management",
      "business_analysis",
      "product_operations",
      "logistics_operations",
      "supply_chain",
      "sales_operations",
      "general_operations",
      "ai_operations",
    ],
    industries: ["operations", "logistics", "retail", "ecommerce", "healthcare"],
    terms: /operations|operation|operasyon|process|workflow|project|program|logistics|supply|delivery/i,
  },
  BUSINESS: {
    label: "Business",
    identity: "Business Strategist",
    roles: [
      "business_analyst",
      "business_analysis",
      "strategy_analyst",
      "strategy_consulting",
      "management_consulting",
      "operations_consulting",
      "transformation_consulting",
      "general_strategy",
      "business_development",
      "general_consulting",
    ],
    industries: ["consulting", "entrepreneurship", "finance", "operations"],
    terms: /strategy|consulting|business|market|case|stakeholder|growth|strateji|danışman|danisman/i,
  },
  DATA: {
    label: "Data",
    identity: "Data Analyst",
    roles: [
      "data_analyst",
      "business_analyst",
      "healthcare_data_analyst",
      "people_analytics",
      "operations_analyst",
      "ai_business_analyst",
      "market_research",
      "risk_analyst",
    ],
    industries: ["ai", "technology", "finance", "healthcare"],
    terms: /data|analytics|analyst|analysis|sql|dashboard|statistics|bi|veri|analiz/i,
  },
  SOFTWARE: {
    label: "Software",
    identity: "Technical Builder",
    roles: [
      "software_engineer",
      "machine_learning",
      "automation_specialist",
      "prompt_engineering",
      "solutions_architect",
      "qa_tester",
    ],
    industries: ["technology", "ai", "gaming"],
    terms: /software|engineer|developer|backend|full.?stack|machine|automation|prompt|api|code|yazılım|yazilim/i,
  },
  MARKETING: {
    label: "Marketing",
    identity: "Growth Creator",
    roles: [
      "growth",
      "growth_manager",
      "digital_marketing",
      "performance_marketing",
      "product_marketing",
      "brand_management",
      "crm",
      "market_research",
      "content_strategy",
      "social_media",
      "general_marketing",
    ],
    industries: ["marketing", "ecommerce", "media", "gaming", "entrepreneurship"],
    terms: /growth|marketing|gtm|campaign|brand|crm|seo|content|social|pazarlama|büyüme|buyume/i,
  },
  HR: {
    label: "HR",
    identity: "People Operator",
    roles: [
      "talent_acquisition",
      "hr_operations",
      "people_analytics",
      "employer_branding",
      "learning_development",
      "organizational_development",
    ],
    industries: ["hr", "education"],
    terms: /hr|human|people|talent|recruit|employer|learning|psychology|organizational|ik|insan/i,
  },
  FINANCE: {
    label: "Finance",
    identity: "Finance Analyst",
    roles: [
      "financial_analyst",
      "investment_analyst",
      "risk_analyst",
      "corporate_finance",
      "fintech_product_manager",
      "strategy_analyst",
    ],
    industries: ["finance"],
    terms: /finance|financial|investment|risk|fp&a|excel|valuation|economics|economy|finans|ekonomi/i,
  },
};

const ROLE_TO_FAMILY = Object.entries(ROLE_FAMILIES).reduce((map, [family, cfg]) => {
  for (const roleId of cfg.roles) {
    if (!map[roleId]) map[roleId] = family;
  }
  return map;
}, {});

function roleFamilyFor(roleIdOrLabel) {
  const raw = String(roleIdOrLabel || "");
  if (ROLE_TO_FAMILY[raw]) return ROLE_TO_FAMILY[raw];
  const n = norm(raw);
  for (const [family, cfg] of Object.entries(ROLE_FAMILIES)) {
    if (cfg.roles.some((roleId) => norm(roleId) === n) || cfg.terms.test(raw)) return family;
  }
  return "BUSINESS";
}

function roleKind(roleIdOrLabel) {
  const family = roleFamilyFor(roleIdOrLabel);
  if (family === "PRODUCT") return "product";
  if (family === "MARKETING") return "growth";
  if (family === "DATA" || family === "FINANCE") return "analysis";
  if (family === "BUSINESS") return "strategy";
  if (family === "OPERATIONS") return "operations";
  if (family === "SOFTWARE") return "technical";
  return "general";
}

function familyLabel(family) {
  return ROLE_FAMILIES[family]?.label || "Business";
}

function detectRoleFamilies(profile, goals) {
  const basic = profile?.basic_profile || {};
  const dna = profile?.career_dna || {};
  const scores = dna.scores || dna.traitScores || {};
  const selectedRoles = [
    goals.primaryRole,
    goals.secondaryRole,
    goals.tertiaryRole,
    ...(goals.targetRoles || []),
    ...(profile?.target_roles || []),
  ].filter(Boolean);
  const industries = goals.industries || profile?.industries || [];
  const text = [
    basic.department,
    basic.degree,
    basic.currentStatus,
    basic.experienceLevel,
    profile?.career_identity,
    ...(profile?.strong_signals || []),
    ...(profile?.skills || []),
  ].join(" ");
  const familyScores = Object.fromEntries(Object.keys(ROLE_FAMILIES).map((family) => [family, 0]));

  selectedRoles.forEach((roleId, idx) => {
    const family = roleFamilyFor(roleId);
    familyScores[family] += idx === 0 || roleId === goals.primaryRole ? 68 : 18;
  });

  industries.forEach((industry) => {
    for (const [family, cfg] of Object.entries(ROLE_FAMILIES)) {
      if (cfg.industries.includes(industry)) familyScores[family] += 10;
    }
  });

  for (const [family, cfg] of Object.entries(ROLE_FAMILIES)) {
    if (cfg.terms.test(text)) familyScores[family] += 18;
  }

  familyScores.PRODUCT += Number(scores.risk_taking || 0) * 0.35 + Number(scores.ambiguity_tolerance || 0) * 0.25;
  familyScores.OPERATIONS += Number(scores.execution || 0) * 0.35 + Number(scores.collaboration || 0) * 0.2;
  familyScores.BUSINESS += Number(scores.analytical_thinking || 0) * 0.28 + Number(scores.communication || 0) * 0.2;
  familyScores.DATA += Number(scores.analytical_thinking || 0) * 0.42;
  familyScores.SOFTWARE += /computer|software|engineering|developer|yazılım|yazilim/i.test(text) ? 34 : 0;
  familyScores.MARKETING += Number(scores.creativity || 0) * 0.45 + Number(scores.communication || 0) * 0.18;
  familyScores.HR += Number(scores.communication || 0) * 0.25 + Number(scores.collaboration || 0) * 0.35;
  familyScores.FINANCE += /finance|economics|accounting|finans|ekonomi/i.test(text) ? 34 : 0;

  const ranked = Object.entries(familyScores).sort((a, b) => b[1] - a[1]);
  return {
    primary: ranked[0]?.[0] || "BUSINESS",
    secondary: ranked[1]?.[0] || "OPERATIONS",
    scores: Object.fromEntries(ranked.map(([family, score]) => [family, clamp(score, 0, 100)])),
    ranked: ranked.map(([family, score]) => ({ family, label: familyLabel(family), score: clamp(score, 0, 100) })),
  };
}

/** Exported for Identity Engine V3 + persistence pipeline */
export function detectRoleFamiliesFromProfile(profile, goals) {
  return detectRoleFamilies(profile, goals || profile?.career_goals || {});
}

function _topIdentityBlocks(scores = {}, familyDetection) {
  const traits = [
    ["Builder", Number(scores.risk_taking || 0) + Number(scores.ambiguity_tolerance || 0) + Number(scores.execution || 0) * 0.4],
    ["Strategist", Number(scores.analytical_thinking || 0) + Number(scores.ambiguity_tolerance || 0) * 0.8 + Number(scores.communication || 0) * 0.3],
    ["Operator", Number(scores.execution || 0) + Number(scores.collaboration || 0) * 0.7],
    ["Analyst", Number(scores.analytical_thinking || 0) * 1.2],
    ["Researcher", Number(scores.analytical_thinking || 0) + Number(scores.creativity || 0) * 0.45],
    ["Leader", Number(scores.leadership || 0) + Number(scores.communication || 0) * 0.55],
    ["Creator", Number(scores.creativity || 0) + Number(scores.communication || 0) * 0.35],
    ["Executor", Number(scores.execution || 0) * 1.15],
  ].sort((a, b) => b[1] - a[1]);

  const familyBlock = {
    PRODUCT: "Product Builder",
    OPERATIONS: "Operator",
    BUSINESS: "Strategist",
    DATA: "Data Analyst",
    SOFTWARE: "Technical Builder",
    MARKETING: "Growth Creator",
    HR: "People Leader",
    FINANCE: "Finance Analyst",
  }[familyDetection?.primary];

  const blocks = [];
  if (familyBlock) blocks.push(familyBlock);
  for (const [name] of traits) {
    const duplicatesMeaning = blocks.some((block) => {
      const current = norm(block);
      const candidate = norm(name);
      return current === candidate || current.includes(candidate) || candidate.includes(current);
    });
    if (!duplicatesMeaning) blocks.push(name);
    if (blocks.length >= 2) break;
  }
  return blocks;
}

function _identityExplanationFor(family, lang) {
  const tr = isTr(lang);
  const descriptions = {
    PRODUCT: tr
      ? "Ürün geliştirme, problem çözme ve iş tarafını birleştiren kariyerlere doğal yakınlık gösteriyorsun."
      : "You naturally lean toward careers that connect product building, problem solving, and business judgment.",
    OPERATIONS: tr
      ? "Süreçleri düzenleme, işi sonuca götürme ve ekipler arası koordinasyon gerektiren rollerde daha doğal okunuyorsun."
      : "You read naturally in roles that require process ownership, reliable delivery, and cross-team coordination.",
    BUSINESS: tr
      ? "Belirsiz problemleri yapılandırma, seçenekleri tartma ve iş kararlarını netleştirme tarafın öne çıkıyor."
      : "Your profile leans toward structuring ambiguous problems, weighing options, and clarifying business decisions.",
    DATA: tr
      ? "Veriden örüntü çıkarma, görünürlük oluşturma ve kararları analizle destekleme tarafın öne çıkıyor."
      : "You lean toward finding patterns in data, creating visibility, and supporting decisions with analysis.",
    SOFTWARE: tr
      ? "Teknik problem çözme, çalışan çıktılar üretme ve uygulama derinliği isteyen rollere doğal yakınlık gösteriyorsun."
      : "You naturally lean toward technical problem solving, shipped outputs, and roles that reward execution depth.",
    MARKETING: tr
      ? "Pazar iletişimi, büyüme denemeleri ve kullanıcı ilgisini harekete geçiren rollerde daha güçlü okunuyorsun."
      : "You read more strongly in roles built around market communication, growth experiments, and customer attention.",
    HR: tr
      ? "İnsanları anlama, iletişim kurma ve çalışan ya da aday süreçlerini sahiplenme tarafın öne çıkıyor."
      : "Your strengths lean toward understanding people, communicating clearly, and owning candidate or employee processes.",
    FINANCE: tr
      ? "Sayısal kararlar, finansal değerlendirme ve iş sonuçlarını analiz etme tarafında daha doğal okunuyorsun."
      : "You read naturally in work involving numerical decisions, financial judgment, and business performance analysis.",
  };
  return descriptions[family] || (tr
    ? "Seçimlerin, analitik düşünme ile uygulama tarafını birleştiren rollere yakınlık gösteriyor."
    : "Your choices point toward roles that combine analytical thinking with practical execution.");
}

function resolveCareerIdentityDetail(profile, goals, pillars, lang, familyDetection) {
  const stored = profile?.career_dna?.identity_v3;
  if (stored?.title && stored?.explanation) {
    return {
      title: stored.title,
      buildingBlocks: stored.buildingBlocks || [stored.primaryModifier, stored.secondaryCore].filter(Boolean),
      primaryRoleFamily: familyDetection?.primary,
      secondaryRoleFamily: familyDetection?.secondary,
      explanation: stored.explanation,
      identityV3: stored,
    };
  }

  const identityV3 = buildIdentityEngineV3({
    profile,
    roleFamily: familyDetection,
    lang,
  });

  return {
    title: identityV3.title,
    buildingBlocks: identityV3.buildingBlocks,
    primaryRoleFamily: familyDetection?.primary,
    secondaryRoleFamily: familyDetection?.secondary,
    explanation: identityV3.explanation,
    identityV3,
  };
}

function roleSpecificGap(family, weakestKey) {
  const gaps = {
    PRODUCT: {
      projects: "Product Metrics",
      experience: "Product Execution Experience",
      network: "Product Network",
      english: "Product Storytelling",
      leadership: "Product Ownership",
    },
    OPERATIONS: {
      projects: "Process Improvement Proof",
      experience: "Operational Delivery Experience",
      network: "Stakeholder Network",
      english: "Stakeholder Communication",
      leadership: "Execution Leadership",
    },
    BUSINESS: {
      projects: "Case Study Proof",
      experience: "Client or Business Exposure",
      network: "Consulting Network",
      english: "Executive Communication",
      leadership: "Structured Leadership",
    },
    DATA: {
      projects: "SQL / Dashboard Proof",
      experience: "Analytics Work Experience",
      network: "Analytics Network",
      english: "Insight Communication",
      leadership: "Analysis Ownership",
    },
    SOFTWARE: {
      projects: "Shipped Technical Project",
      experience: "Engineering Internship",
      network: "Engineering Network",
      english: "Technical Communication",
      leadership: "Technical Ownership",
    },
    MARKETING: {
      projects: "Campaign Metrics",
      experience: "Marketing Execution Experience",
      network: "Growth Network",
      english: "Market Communication",
      leadership: "Campaign Ownership",
    },
    HR: {
      projects: "Recruiting Process Proof",
      experience: "HR Internship Experience",
      network: "People / HR Network",
      english: "Candidate Communication",
      leadership: "People Process Ownership",
    },
    FINANCE: {
      projects: "Financial Modeling Proof",
      experience: "Finance Internship Experience",
      network: "Finance Network",
      english: "Business Reporting",
      leadership: "Deal or Analysis Ownership",
    },
  };
  return gaps[family]?.[weakestKey] || null;
}

function biggestGapFromProfile(profile, pillars, goals, lang, familyDetection) {
  const tr = isTr(lang);
  const weakest = [...pillars].sort((a, b) => a.score - b.score)[0];
  const familyGap = roleSpecificGap(familyDetection?.primary, weakest?.key);
  if (familyGap) return familyGap;
  const roleText = norm([goals.primaryRole, ...(goals.targetRoles || [])].join(" "));
  if (weakest?.key === "projects" && /product|pm|urun/.test(roleText)) return "Product Metrics";
  if (weakest?.key === "projects" && /data|analysis|analiz|analyst/.test(roleText)) return "SQL";
  if (weakest?.key === "projects") return tr ? "Case Studies" : "Case Studies";
  if (weakest?.key === "experience") return tr ? "Internship Experience" : "Internship Experience";
  if (weakest?.key === "network") return tr ? "Networking" : "Networking";
  if (weakest?.key === "english") return tr ? "Communication" : "Communication";
  return weakest?.label || (tr ? "Product Metrics" : "Product Metrics");
}

function _suggestedNextMove(gap, roles, _lang) {
  const primary = String(roles?.[0] || "").toLowerCase();
  const g = String(gap || "").toLowerCase();
  if (/financial|finance|modeling|reporting/.test(g)) return "Build one financial model and summarize the business decision.";
  if (/recruiting|candidate|hr|people/.test(g)) return "Document one recruiting or people-process case.";
  if (/technical|engineering|shipped/.test(g)) return "Ship one small technical project with a public link.";
  if (/campaign|growth|market/.test(g)) return "Publish one campaign or growth experiment with results.";
  if (/process|operational|stakeholder|execution/.test(g)) return "Write one process improvement case with before-after impact.";
  if (/network/.test(g)) return "Send two focused messages to people in your target role.";
  if (/sql/.test(g)) return "Build one SQL dashboard project.";
  if (/internship|experience/.test(g)) return "Apply to three tightly matched internships.";
  if (/communication/.test(g)) return "Rewrite your LinkedIn headline around one target role.";
  if (/product metrics|case/.test(g) || /product/.test(primary)) {
    return "Publish one product case study with a metric.";
  }
  return "Add one measurable outcome to your CV.";
}

function _actionsForGap(gap) {
  const g = String(gap || "").toLowerCase();
  if (/financial|finance|modeling|reporting/.test(g)) {
    return ["Build one 3-statement or KPI model", "Write the business decision it supports", "Add the model link to your CV"];
  }
  if (/recruiting|candidate|hr|people/.test(g)) {
    return ["Map one recruiting process", "Write 3 candidate-screening criteria", "Show the process as a portfolio case"];
  }
  if (/technical|engineering|shipped/.test(g)) {
    return ["Ship one scoped technical project", "Add a README with decisions and tradeoffs", "Publish the GitHub or demo link"];
  }
  if (/campaign|growth|market/.test(g)) {
    return ["Run one small campaign experiment", "Report one acquisition or conversion metric", "Add the result to your portfolio"];
  }
  if (/process|operational|stakeholder|execution/.test(g)) {
    return ["Map one workflow", "Show the bottleneck and fix", "Add one before-after metric"];
  }
  if (/network/.test(g)) {
    return ["Connect with 3 professionals", "Schedule 1 informational interview", "Attend 1 industry event"];
  }
  if (/product metrics/.test(g)) {
    return ["Write one product metric", "Show one user or funnel outcome", "Publish one PM case study"];
  }
  if (/sql/.test(g)) {
    return ["Build one SQL dashboard", "Explain one insight from the data", "Add the project link to your CV"];
  }
  if (/internship|experience/.test(g)) {
    return ["Apply to 3 focused internships", "Turn one project into work-like proof", "Add one measurable delivery outcome"];
  }
  if (/communication/.test(g)) {
    return ["Rewrite your headline around one role", "Add one English CV proof line", "Practice one role-specific pitch"];
  }
  if (/case/.test(g)) {
    return ["Publish one portfolio case study", "Show the problem, decision, and result", "Add it under projects"];
  }
  return ["Add one measurable outcome", "Connect it to your target role", "Make the proof visible in your CV"];
}

function expectedScoreIncreaseForGap(gap, pillars = []) {
  const g = String(gap || "").toLowerCase();
  const weakScore = [...pillars].sort((a, b) => a.score - b.score)[0]?.score ?? 50;
  let base = weakScore < 45 ? 6 : weakScore < 65 ? 4 : 3;
  if (/network|product metrics|sql|experience/.test(g)) base += 1;
  return clamp(base, 3, 8);
}

function learningFocusFromGap(gap, roles) {
  const primary = String(roles?.[0] || "");
  const g = String(gap || "").toLowerCase();
  if (/financial|finance|modeling|reporting/.test(g)) return "Financial Modeling";
  if (/recruiting|candidate|hr|people/.test(g)) return "Recruiting Operations";
  if (/technical|engineering|shipped/.test(g)) return "Technical Project Delivery";
  if (/campaign|growth|market/.test(g)) return "Growth Experimentation";
  if (/process|operational|stakeholder|execution/.test(g)) return "Process Improvement";
  if (/product metrics/.test(g)) return "Product Metrics";
  if (/sql/.test(g)) return "SQL";
  if (/network/.test(g)) return "Networking";
  if (/communication/.test(g)) return "Professional Communication";
  if (/internship|experience/.test(g)) return "Real-world Experience";
  if (/case/.test(g)) return "Portfolio Case Study";
  if (/product/i.test(primary)) return "Product Metrics";
  return "Stakeholder Management";
}

function scoreBreakdownFromPillars(pillars = [], readinessScore) {
  const byKey = Object.fromEntries((pillars || []).map((p) => [p.key, p]));
  const item = (key, label, fallback = 50) => {
    const score = clamp(byKey[key]?.score ?? fallback);
    return {
      key,
      label,
      points: clamp(score / 5, 0, 20),
      max: 20,
      sourceScore: score,
    };
  };
  const rows = [
    item("projects", "Projects"),
    item("experience", "Experience"),
    item("leadership", "Leadership"),
    item("english", "Communication"),
    item("network", "Networking"),
  ];
  const total = readinessScore != null ? clamp(readinessScore) : clamp(rows.reduce((sum, r) => sum + r.points, 0));
  return { rows, total, max: 100 };
}

function signalForWeight(key, candidateSignals = {}) {
  const s = candidateSignals;
  const avg = (...vals) => clamp(vals.reduce((sum, v) => sum + Number(v || 0), 0) / vals.length);
  const map = {
    productThinking: avg(s.projects, s.roleClarity, s.leadership),
    leadership: s.leadership,
    analytics: avg(s.projects, s.english, s.cvStatus),
    communication: avg(s.english, s.networking),
    execution: avg(s.experience, s.projects),
    growthThinking: avg(s.projects, s.networking, s.communication || s.english),
    creativity: avg(s.projects, s.english),
    structuredThinking: avg(s.roleClarity, s.projects, s.english),
    stakeholderWork: avg(s.networking, s.leadership, s.english),
    domainLearning: avg(s.projects, s.experience),
    ownership: avg(s.leadership, s.projects),
    ambiguityTolerance: avg(s.projects, s.roleClarity),
    executionSpeed: avg(s.experience, s.projects),
    productSense: avg(s.projects, s.roleClarity),
    roleClarity: s.roleClarity,
    repeatability: avg(s.experience, s.projects),
    analyticalProof: avg(s.projects, s.english),
    evidenceQuality: avg(s.cvStatus, s.projects, s.experience),
    learningSpeed: avg(s.projects, s.english),
    evidence: avg(s.cvStatus, s.projects),
    other: avg(s.experience, s.projects, s.english, s.roleClarity),
  };
  return clamp(map[key] ?? map.other ?? 50);
}

function missingSignalForRole(roleId, roleWeights = {}, candidateSignals = {}) {
  const family = roleFamilyFor(roleId);
  const familyGap = roleSpecificGap(family, weakestCandidateSignal(candidateSignals));
  if (familyGap) return familyGap;
  const entries = Object.keys(roleWeights).map((key) => ({
    key,
    score: signalForWeight(key, candidateSignals),
  }));
  const weak = entries.sort((a, b) => a.score - b.score)[0]?.key || "evidence";
  const labels = {
    productThinking: "Product metrics experience",
    analytics: "SQL or dashboard proof",
    execution: "Real-world delivery proof",
    leadership: "Project leadership",
    communication: "Professional communication proof",
    stakeholderWork: "Stakeholder experience",
    structuredThinking: "Case study proof",
    growthThinking: "Growth experiment proof",
    roleClarity: "Clear role narrative",
    evidenceQuality: "Portfolio proof",
    evidence: "Portfolio proof",
    repeatability: "Repeatable process proof",
    ownership: "Ownership proof",
    ambiguityTolerance: "Ambiguity proof",
  };
  return labels[weak] || "Measurable proof";
}

function roleFitReason(roleId, roleLabel, identityTitle, strongestSignal, candidateSignals, evidence = {}, lang = "EN") {
  const family = roleFamilyFor(roleId);
  if (evidence?.recruiterReasoning?.summary) {
    return evidence.recruiterReasoning.summary;
  }
  if (evidence?.dimensionEvidence && Object.keys(evidence.dimensionEvidence).length) {
    return buildRoleMatchExplanation({ roleName: roleLabel, family, evidence: evidence.dimensionEvidence, lang });
  }
  const fallback = strongestSignal || "your strongest current signal";
  if (family === "PRODUCT") return `${fallback} supports this because product roles reward ownership, prioritization, user problems, and shipped decisions.`;
  if (family === "OPERATIONS") return `${fallback} fits this lane when it becomes workflow ownership, delivery discipline, and repeatable execution.`;
  if (family === "BUSINESS") return `${fallback} supports this path when framed as structured decisions, market logic, and stakeholder judgment.`;
  if (family === "DATA") return `${fallback} transfers here when it becomes dashboard, SQL, reporting, or insight proof.`;
  if (family === "SOFTWARE") return `${fallback} helps here if the profile shows shipped code, technical depth, and clear engineering tradeoffs.`;
  if (family === "MARKETING") return `${fallback} fits this lane when it becomes campaign, acquisition, positioning, or experiment evidence.`;
  if (family === "HR") return `${fallback} fits here when it becomes candidate, people-process, or employee-experience proof.`;
  if (family === "FINANCE") return `${fallback} fits here when it becomes modeling, reporting, risk, or business-decision proof.`;
  return `${identityTitle} gives this role a starting point; the next proof should make the role connection obvious.`;
}

function weakestCandidateSignal(candidateSignals = {}) {
  const keys = ["projects", "experience", "leadership", "english", "networking"];
  const weak = keys
    .map((key) => [key === "networking" ? "network" : key, candidateSignals[key] ?? 50])
    .sort((a, b) => a[1] - b[1])[0]?.[0];
  return weak || "projects";
}

function familyReadinessScore(family, candidateSignals = {}) {
  const s = {
    projects: candidateSignals.projects ?? 50,
    experience: candidateSignals.experience ?? 50,
    leadership: candidateSignals.leadership ?? 50,
    english: candidateSignals.english ?? 50,
    network: candidateSignals.networking ?? 50,
    roleClarity: candidateSignals.roleClarity ?? 50,
    cvStatus: candidateSignals.cvStatus ?? 50,
  };
  const weights = {
    PRODUCT: { projects: 0.28, leadership: 0.18, experience: 0.18, roleClarity: 0.18, english: 0.1, network: 0.08 },
    OPERATIONS: { experience: 0.25, projects: 0.22, leadership: 0.2, roleClarity: 0.13, english: 0.1, network: 0.1 },
    BUSINESS: { english: 0.22, projects: 0.2, experience: 0.2, leadership: 0.16, network: 0.12, roleClarity: 0.1 },
    DATA: { projects: 0.34, experience: 0.2, english: 0.16, roleClarity: 0.12, leadership: 0.08, network: 0.1 },
    SOFTWARE: { projects: 0.36, experience: 0.24, roleClarity: 0.14, english: 0.1, leadership: 0.08, network: 0.08 },
    MARKETING: { projects: 0.25, english: 0.2, network: 0.18, experience: 0.15, leadership: 0.12, roleClarity: 0.1 },
    HR: { english: 0.24, network: 0.2, experience: 0.2, leadership: 0.18, projects: 0.1, roleClarity: 0.08 },
    FINANCE: { projects: 0.3, experience: 0.23, english: 0.18, roleClarity: 0.12, leadership: 0.07, network: 0.1 },
  }[family] || { projects: 0.22, experience: 0.22, english: 0.18, leadership: 0.16, network: 0.12, roleClarity: 0.1 };
  return Object.entries(weights).reduce((sum, [key, weight]) => sum + s[key] * weight, 0);
}

function hasFounderSignal(profile = {}) {
  const basic = profile.basic_profile || {};
  return (
    /founder|co-?founder|startup|venture|giri[sş]im/i.test(
      [profile.career_identity, basic.currentStatus, basic.experienceLevel, basic.leadershipRole].join(" ")
    ) ||
    profile?.career_readiness?.benchmarks?.leadership === "founder_cofounder"
  );
}

function hasEducationHint(profile = {}, re) {
  const basic = profile.basic_profile || {};
  return re.test([basic.department, basic.degree, basic.university].join(" "));
}

const ROLE_PROOF_PATTERNS = {
  PRODUCT: [/prd|product requirements?/i, /roadmap|backlog/i, /user research|customer interview/i, /activation|retention|product metric|a\/b test/i],
  OPERATIONS: [/workflow|process map|sop/i, /sla|cycle time|throughput/i, /cross-functional|stakeholder/i, /delivery|operations ownership/i],
  BUSINESS: [/business case|case study/i, /requirements?|process analysis/i, /sql|dashboard|power bi|tableau/i, /client|market analysis/i],
  DATA: [/sql|query/i, /dashboard|power bi|tableau/i, /analysis|analytics model/i, /insight|decision support/i],
  SOFTWARE: [/github|repository/i, /deploy|production|live/i, /api|backend|frontend/i, /test|ci\/cd|cloud/i],
  MARKETING: [/campaign|acquisition/i, /cac|roas|conversion/i, /crm|seo|funnel/i, /experiment|growth loop/i],
  HR: [/recruit|talent acquisition/i, /interview|scorecard/i, /ats|hris/i, /onboarding|people process/i],
  FINANCE: [/financial model|dcf|valuation/i, /forecast|budget/i, /reporting|variance/i, /risk|portfolio|investment/i],
};

function roleSpecificProof(profile = {}, family) {
  const basic = profile.basic_profile || {};
  const text = [
    ...(profile.strong_signals || []),
    ...(profile.strengths || []),
    ...(profile.skills || []),
    ...(basic.skills || []),
    ...(basic.projects || []),
    basic.projectDetails,
    basic.projectHighlights,
    profile?.career_dna?.summary,
  ].filter(Boolean).join(" ");
  const matches = (ROLE_PROOF_PATTERNS[family] || []).filter((pattern) => pattern.test(text));
  return { count: matches.length, hasRoleProof: matches.length >= 2 };
}

function roleArtifactGap(family) {
  return {
    PRODUCT: "User Research Proof",
    OPERATIONS: "Process Scaling Proof",
    BUSINESS: "Business Case Work",
    DATA: "Analytics Portfolio",
    SOFTWARE: "GitHub / Deployment Proof",
    MARKETING: "Campaign Experiment Proof",
    HR: "Interview Process Knowledge",
    FINANCE: "Forecasting Proof",
  }[family] || "Role-specific Proof";
}

function advancedRoleGap(family) {
  return {
    PRODUCT: "Product Scale / Repeatability Proof",
    OPERATIONS: "Operational Scale Proof",
    BUSINESS: "Decision Impact Proof",
    DATA: "Production Analytics Proof",
    SOFTWARE: "Reliability / Scale Proof",
    MARKETING: "Repeatable Growth Proof",
    HR: "Hiring Outcome Proof",
    FINANCE: "Financial Decision Impact",
  }[family] || "Repeatable Outcome Proof";
}

function roleEvidenceForRole(roleId, candidateSignals = {}, profile = {}, goals = {}) {
  const family = roleFamilyFor(roleId);
  const s = {
    projects: candidateSignals.projects ?? 50,
    experience: candidateSignals.experience ?? 50,
    leadership: candidateSignals.leadership ?? 50,
    english: candidateSignals.english ?? 50,
    network: candidateSignals.networking ?? 50,
    roleClarity: candidateSignals.roleClarity ?? 50,
    cvStatus: candidateSignals.cvStatus ?? 50,
  };
  const selected = [goals.primaryRole, goals.secondaryRole, goals.tertiaryRole, ...(goals.targetRoles || [])].includes(roleId);
  const founder = hasFounderSignal(profile);
  const roleProof = roleSpecificProof(profile, family);
  const addStrong = (arr, condition, label) => condition && arr.push(label);
  const addMissing = (arr, condition, label) => condition && arr.push(label);
  const strongSignals = [];
  const missingSignals = [];
  let evidenceQuality = 50;

  if (family === "PRODUCT") {
    evidenceQuality = s.projects * 0.3 + s.leadership * 0.2 + s.experience * 0.18 + s.roleClarity * 0.18 + s.english * 0.08 + s.network * 0.06;
    addStrong(strongSignals, founder, "Founder / builder ownership");
    addStrong(strongSignals, s.projects >= 70, "Product or project proof");
    addStrong(strongSignals, s.roleClarity >= 70, "Clear product direction");
    addMissing(missingSignals, s.leadership < 75, "Product Ownership");
    addMissing(missingSignals, s.projects < 80, "Product Metrics");
    addMissing(missingSignals, s.projects < 72, "User Research Proof");
    addMissing(missingSignals, Math.min(s.leadership, s.network) < 68, "Stakeholder Communication");
  } else if (family === "OPERATIONS") {
    evidenceQuality = s.experience * 0.28 + s.projects * 0.24 + s.leadership * 0.2 + s.roleClarity * 0.12 + s.english * 0.08 + s.network * 0.08;
    addStrong(strongSignals, s.experience >= 70, "Operational work exposure");
    addStrong(strongSignals, s.projects >= 65, "Workflow or project proof");
    addStrong(strongSignals, s.leadership >= 70, "Execution leadership");
    addMissing(missingSignals, s.projects < 75, "Process Improvement");
    addMissing(missingSignals, s.leadership < 70, "Cross-functional ownership");
    addMissing(missingSignals, s.experience < 70, "Operational delivery experience");
  } else if (family === "BUSINESS") {
    evidenceQuality = s.english * 0.22 + s.projects * 0.22 + s.experience * 0.2 + s.leadership * 0.15 + s.roleClarity * 0.11 + s.network * 0.1;
    addStrong(strongSignals, s.english >= 75, "Executive communication");
    addStrong(strongSignals, s.projects >= 65, "Case or business proof");
    addStrong(strongSignals, s.experience >= 70, "Business exposure");
    if (/business_analyst|business_analysis|ai_business_analyst/i.test(roleId)) {
      addMissing(missingSignals, s.projects < 80, "SQL Proof");
      addMissing(missingSignals, s.projects < 75, "Analytics Portfolio");
      addMissing(missingSignals, s.experience < 75, "Business Case Work");
    } else {
      addMissing(missingSignals, s.projects < 78, "Business Case Work");
      addMissing(missingSignals, s.experience < 70, "Client or Business Exposure");
      addMissing(missingSignals, s.network < 70, "Consulting Network");
    }
  } else if (family === "DATA") {
    evidenceQuality = s.projects * 0.38 + s.experience * 0.2 + s.english * 0.14 + s.roleClarity * 0.12 + s.network * 0.08 + s.leadership * 0.08;
    addStrong(strongSignals, s.projects >= 75, "Analytics project proof");
    addStrong(strongSignals, hasEducationHint(profile, /statistics|data|mis|economics|finance|engineering/i), "Analytical education base");
    addStrong(strongSignals, s.english >= 70, "Insight communication");
    addMissing(missingSignals, s.projects < 80, "SQL / Dashboard Proof");
    addMissing(missingSignals, s.experience < 70, "Analytics work experience");
    addMissing(missingSignals, s.english < 70, "Insight communication");
  } else if (family === "SOFTWARE") {
    evidenceQuality = s.projects * 0.4 + s.experience * 0.24 + s.roleClarity * 0.12 + s.english * 0.1 + s.leadership * 0.08 + s.network * 0.06;
    addStrong(strongSignals, hasEducationHint(profile, /computer|software|engineering|cs|yazılım|yazilim/i), "Technical education base");
    addStrong(strongSignals, s.projects >= 75, "Shipped technical projects");
    addStrong(strongSignals, s.experience >= 70, "Engineering work exposure");
    addMissing(missingSignals, s.projects < 82, "GitHub Proof");
    addMissing(missingSignals, s.projects < 72, "Technical Projects");
    addMissing(missingSignals, s.experience < 75, "Deployment Experience");
  } else if (family === "MARKETING") {
    evidenceQuality = s.projects * 0.28 + s.english * 0.22 + s.network * 0.18 + s.experience * 0.15 + s.leadership * 0.1 + s.roleClarity * 0.07;
    addStrong(strongSignals, s.english >= 70, "Market communication");
    addStrong(strongSignals, s.projects >= 65, "Campaign or content proof");
    addStrong(strongSignals, s.network >= 65, "Distribution awareness");
    addMissing(missingSignals, s.projects < 78, "Campaign Metrics");
    addMissing(missingSignals, s.experience < 70, "Marketing execution experience");
    addMissing(missingSignals, s.network < 70, "Growth network");
  } else if (family === "HR") {
    evidenceQuality = s.english * 0.24 + s.network * 0.2 + s.experience * 0.2 + s.leadership * 0.18 + s.projects * 0.1 + s.roleClarity * 0.08;
    addStrong(strongSignals, hasEducationHint(profile, /psychology|organizational|human/i), "People-focused education base");
    addStrong(strongSignals, s.english >= 70, "Candidate communication");
    addStrong(strongSignals, s.leadership >= 65, "People process ownership");
    addMissing(missingSignals, s.experience < 72, "Recruitment Exposure");
    addMissing(missingSignals, s.projects < 72, "Interview Process Knowledge");
    addMissing(missingSignals, s.network < 70, "People / HR network");
  } else if (family === "FINANCE") {
    evidenceQuality = s.projects * 0.32 + s.experience * 0.24 + s.english * 0.16 + s.roleClarity * 0.12 + s.network * 0.08 + s.leadership * 0.08;
    addStrong(strongSignals, hasEducationHint(profile, /finance|economics|accounting|business/i), "Finance education base");
    addStrong(strongSignals, s.projects >= 70, "Modeling or analysis proof");
    addStrong(strongSignals, s.experience >= 70, "Finance work exposure");
    addMissing(missingSignals, s.projects < 80, "Financial Modeling");
    addMissing(missingSignals, s.english < 75, "Financial Reporting");
    addMissing(missingSignals, s.experience < 78, "Forecasting Proof");
  }

  addMissing(missingSignals, !roleProof.hasRoleProof, roleArtifactGap(family));

  if (selected) addStrong(strongSignals, true, "Explicit target role selection");
  const uniqueStrong = [...new Set(strongSignals)].slice(0, 4);
  const uniqueMissing = [...new Set(missingSignals)].slice(0, 4);
  const confidence =
    evidenceQuality >= 76 && uniqueMissing.length <= 2
      ? "High"
      : evidenceQuality >= 58 && uniqueMissing.length <= 3
        ? "Medium"
        : "Low";

  return {
    strongSignals: uniqueStrong.length ? uniqueStrong : ["Role direction is selected"],
    missingSignals: uniqueMissing.length ? uniqueMissing : [advancedRoleGap(family)],
    evidenceQuality: clamp(evidenceQuality),
    confidence,
    roleProofCount: roleProof.count,
    hasRoleProof: roleProof.hasRoleProof,
  };
}

function scoreRoleFit(roleId, candidateSignals = {}, selectedRoles = [], goals = {}, familyDetection = null, profile = {}, evidenceOverride = null) {
  const family = roleFamilyFor(roleId);
  const familyScore = familyReadinessScore(family, candidateSignals);
  const familyConfidence = familyDetection?.scores?.[family] ?? 45;
  const evidence = evidenceOverride || roleEvidenceForRole(roleId, candidateSignals, profile, goals);
  let score = familyScore * 0.25 + evidence.evidenceQuality * 0.55 + familyConfidence * 0.2;
  if (roleId === goals.primaryRole) score += 3;
  else if (roleId === goals.secondaryRole || roleId === goals.tertiaryRole) score += 2;
  else if (selectedRoles.includes(roleId)) score += 1;
  if (family === familyDetection?.primary) score += 2;
  else score -= 18;
  score += Math.min(4, evidence.roleProofCount * 2);

  let calibrated = clamp(score, 20, 94);
  if (evidence.evidenceQuality < 55) calibrated = Math.min(calibrated, 68);
  else if (evidence.evidenceQuality < 70) calibrated = Math.min(calibrated, 82);
  if (family !== familyDetection?.primary && family !== familyDetection?.secondary) calibrated = Math.min(calibrated, 72);
  if (evidence.confidence === "Low") calibrated = Math.min(calibrated, 66);
  if (roleId !== goals.primaryRole) calibrated = Math.min(calibrated, 88);
  if (!evidence.hasRoleProof) calibrated = Math.min(calibrated, 89);
  if ((candidateSignals.projects ?? 0) < 80 || (candidateSignals.experience ?? 0) < 75) calibrated = Math.min(calibrated, 88);
  return calibrated;
}

function defaultRoleWeightsForRole(roleIdOrLabel) {
  const kind = roleKind(roleIdOrLabel);
  if (kind === "product") return { productThinking: 28, ownership: 20, execution: 18, analytics: 14, communication: 10, other: 10 };
  if (kind === "strategy") return { structuredThinking: 28, analytics: 20, communication: 16, stakeholderWork: 14, evidenceQuality: 12, other: 10 };
  if (kind === "operations") return { execution: 26, repeatability: 22, stakeholderWork: 16, analytics: 14, roleClarity: 12, other: 10 };
  if (kind === "analysis") return { analytics: 30, structuredThinking: 20, evidenceQuality: 16, communication: 12, execution: 12, other: 10 };
  if (kind === "growth") return { growthThinking: 28, analytics: 18, communication: 18, execution: 14, creativity: 12, other: 10 };
  if (kind === "technical") return { evidenceQuality: 24, execution: 20, analytics: 18, learningSpeed: 16, roleClarity: 12, other: 10 };
  return { roleClarity: 22, evidenceQuality: 20, execution: 18, communication: 14, learningSpeed: 14, other: 12 };
}

function buildRoleMatches(profile, goals, lang, weightedFitFoundation, identityTitle, strongestSignal, familyDetection, coreIntelligence = null) {
  const selectedRoles = [
    ...getPrioritizedRoles(goals),
    ...(profile?.target_roles || []),
  ].filter(Boolean);
  const familyRoles = [
    ...(ROLE_FAMILIES[familyDetection?.primary]?.roles || []),
    ...(ROLE_FAMILIES[familyDetection?.secondary]?.roles || []),
  ];
  const compatibleBestFits = (profile?.best_fit_roles || []).filter((roleId) =>
    [familyDetection?.primary, familyDetection?.secondary].includes(roleFamilyFor(roleId))
  );
  const roleIds = [...new Set([...selectedRoles, ...familyRoles, ...compatibleBestFits])].slice(0, 12);
  const candidateSignals = weightedFitFoundation?.candidateSignals || {};
  const targetRole = goals.primaryRole || selectedRoles[0] || "";
  const baseCore = coreIntelligence?.evidence?.records
    ? coreIntelligence
    : buildCoreIntelligence({
      profile,
      targetRole,
      roleFamily: familyDetection?.primary,
      lang,
    });
  const matches = roleIds.map((roleId) => {
    const roleName = humanRoleLabel(roleId, lang);
    const roleWeights =
      weightedFitFoundation?.roleWeights?.[roleName] ||
      weightedFitFoundation?.roleWeights?.[humanRoleLabel(roleId, "EN")] ||
      defaultRoleWeightsForRole(`${roleId} ${roleName}`);
    const legacyEvidence = roleEvidenceForRole(roleId, candidateSignals, profile, goals);
    const roleEvaluation = evaluateEvidenceForRole(baseCore, {
      roleFamily: roleFamilyFor(roleId),
      targetRole: roleId,
      lang,
    });
    const labels = evidenceLabels(roleEvaluation, lang);
    const evidence = {
      ...legacyEvidence,
      strongSignals: labels.strong,
      missingSignals: labels.missing,
      evidenceQuality: roleEvaluation.evidenceQuality,
      confidence: roleEvaluation.confidence.band,
      roleProofCount: roleEvaluation.requirements.filter((requirement) => requirement.supported).length,
      hasRoleProof: roleEvaluation.requirements.some((requirement) => requirement.supported),
      confidenceScore: roleEvaluation.confidence.score,
      recruiterReasoning: roleEvaluation.recruiterReasoning,
      evidenceOpportunity: roleEvaluation.opportunity,
      evidenceRecommendation: roleEvaluation.recommendation,
      dimensionEvidence: roleEvaluation.dimensions.scores,
    };
    const roleFitScore = scoreRoleFit(roleId, candidateSignals, selectedRoles, goals, familyDetection, profile, evidence);
    const distanceToRole = clamp(90 - roleFitScore, 0, 60);
    return {
      roleId,
      roleName,
      roleFamily: familyLabel(roleFamilyFor(roleId)),
      roleFitScore,
      fitPercentage: roleFitScore,
      confidence: evidence.confidence,
      evidenceQuality: evidence.evidenceQuality,
      confidenceScore: evidence.confidenceScore,
      evidenceOpportunity: evidence.evidenceOpportunity,
      evidenceRecommendation: evidence.evidenceRecommendation,
      strongSignals: evidence.strongSignals,
      missingSignals: evidence.missingSignals,
      distanceToRole,
      estimatedGap: distanceToRole,
      whyItFits: roleFitReason(roleId, roleName, identityTitle, strongestSignal, candidateSignals, evidence, lang),
      missingSignal: evidence.missingSignals[0] || missingSignalForRole(roleId, roleWeights, candidateSignals),
    };
  });
  return matches
    .sort((a, b) => b.roleFitScore - a.roleFitScore)
    .slice(0, 3)
    .map((match, idx) => ({
      ...match,
      recommendationType: idx === 0 ? "Best Fit" : idx === 1 ? "Second Best" : "Stretch Role",
    }));
}

export function roleFitBand(score, lang = "TR") {
  const tr = isTr(lang);
  const value = clamp(score);
  if (value >= 92) return { key: "very_strong", label: tr ? "Çok Güçlü Eşleşme" : "Very Strong Match" };
  if (value >= 76) return { key: "strong", label: tr ? "Güçlü Eşleşme" : "Strong Match" };
  if (value >= 56) return { key: "emerging", label: tr ? "Gelişen Eşleşme" : "Emerging Match" };
  return { key: "early", label: tr ? "Erken Aşama Eşleşme" : "Early Match" };
}

function previewConfidence({ matchConfidence, signals }) {
  const completeness = [
    signals.hasTarget,
    signals.hasSector,
    signals.experienceAnswered,
    signals.projectsAnswered,
    signals.leadershipAnswered,
    signals.dnaCount >= 7,
    signals.hasCv,
  ].filter(Boolean).length;
  if (completeness >= 7 && matchConfidence === "High" && signals.hasCv) return "High";
  if (completeness >= 4 && signals.hasTarget && signals.hasSector && matchConfidence !== "Low") return "Medium";
  return "Low";
}

function isPositiveBenchmark(value) {
  return Boolean(value) && !/^(none|0_5|basic)$/i.test(String(value));
}

function _previewWhy({ roleName, family, strongestSignal, goals, readinessAnswers, lang }) {
  const tr = isTr(lang);
  const supports = [];
  const industries = (goals.industries || [])
    .slice(0, 2)
    .map((industry) => getIndustryLabel(industry, lang))
    .filter(Boolean);
  if (industries.length) supports.push(tr ? `${industries.join(" ve ")} sektör odağın` : `your focus on ${industries.join(" and ")}`);
  if (isPositiveBenchmark(readinessAnswers.projects)) supports.push(tr ? "proje deneyimin" : "your project experience");
  if (isPositiveBenchmark(readinessAnswers.leadership)) supports.push(tr ? "sahiplenme sinyalin" : "your ownership signal");
  if (goals.primaryRole) supports.push(tr ? "rol önceliğin" : "your stated role priority");
  if (!supports.length && strongestSignal) supports.push(strongestSignal);
  const evidence = supports.slice(0, 3).join(tr ? ", " : ", ");
  const role = roleName || familyLabel(family);
  return tr
    ? `${role} eşleşmesi; ${evidence || "mevcut seçimlerin"} aynı kariyer hattını desteklediği için öne çıkıyor.`
    : `${role} stands out because ${evidence || "your current choices"} reinforce the same career direction.`;
}

function confidenceReasons({ confidence, signals, lang }) {
  const tr = isTr(lang);
  const positive = [];
  const limiting = [];

  (signals.hasTarget ? positive : limiting).push(signals.hasTarget
    ? (tr ? `${signals.roleName} hedefi net` : `${signals.roleName} target is clear`)
    : (tr ? "Kariyer hedefi henüz net değil" : "Career target is still forming"));
  if (signals.hasTarget && !signals.hasPrimaryRole) {
    limiting.push(tr ? "Hedef roller seçildi ancak ana rol sırası henüz netleşmedi" : "Target roles are selected, but the primary role order is not final yet");
  }
  (signals.hasSector ? positive : limiting).push(signals.hasSector
    ? (tr ? "Sektör odağı seçildi" : "Industry focus is selected")
    : (tr ? "Sektör odağı eksik" : "Industry focus is missing"));
  (signals.hasCv ? positive : limiting).push(signals.hasCv
    ? (tr ? "CV kanıtı mevcut" : "CV evidence is available")
    : (tr ? "CV yüklenmedi" : "CV has not been uploaded"));
  if (!signals.experienceAnswered) {
    limiting.push(tr ? "Deneyim kanıtı henüz değerlendirilmedi" : "Experience evidence has not been assessed yet");
  } else if (signals.hasExperienceProof) {
    positive.push(tr ? "Deneyim geçmişi rolü destekliyor" : "Experience history supports the role");
  } else {
    limiting.push(tr ? "Gerçek iş deneyimi kanıtı sınırlı" : "Real-world experience evidence is limited");
  }
  if (!signals.projectsAnswered) {
    limiting.push(tr ? "Proje kanıtı henüz değerlendirilmedi" : "Project evidence has not been assessed yet");
  } else if (signals.hasProjectProof) {
    positive.push(tr ? "Proje geçmişi rolü destekliyor" : "Project history supports the role");
  } else {
    limiting.push(tr ? "Proje kanıtı sınırlı" : "Project evidence is limited");
  }
  if (signals.hasLeadershipProof) {
    positive.push(tr ? "Sahiplenme sinyali mevcut" : "Ownership evidence is present");
  }
  if (signals.dnaCount >= 7 && signals.matchConfidence !== "Low") {
    positive.unshift(tr ? `Birden fazla sinyal ${signals.roleName} yönünü destekliyor` : `Multiple signals support the ${signals.roleName} direction`);
  } else if (signals.dnaCount < 4) {
    limiting.push(tr ? "Career DNA sinyalleri henüz tamamlanmadı" : "Career DNA signals are not complete yet");
  }

  if (signals.matchConfidence === "Low") {
    limiting.unshift(tr ? `${signals.roleName} için role özel kanıtlar henüz sınırlı` : `Role-specific evidence for ${signals.roleName} is still limited`);
  } else if (signals.matchConfidence === "Medium") {
    limiting.push(tr ? `${signals.roleName} için bazı kanıtlar henüz doğrulanmadı` : `Some evidence for ${signals.roleName} is not verified yet`);
  }

  if (confidence === "High") {
    const highPriority = [
      positive.find((reason) => /Birden fazla|Multiple signals/.test(reason)),
      positive.find((reason) => /Proje geçmişi|Project history/.test(reason)),
      positive.find((reason) => /Deneyim geçmişi|Experience history/.test(reason)),
      positive.find((reason) => /Sahiplenme|Ownership/.test(reason)),
      positive.find((reason) => /hedefi net|target is clear/.test(reason)),
    ].filter(Boolean);
    return [...new Set(highPriority)].slice(0, 3);
  }
  if (confidence === "Low") return limiting.slice(0, 3);
  return [...limiting.slice(0, 2), ...positive.slice(0, 2)].slice(0, 3);
}

function confidenceSummary(confidence, lang) {
  const tr = isTr(lang);
  if (confidence === "High") return tr
    ? "Tahmin güçlü; farklı veri noktaları aynı kariyer yönünde birleşiyor."
    : "The prediction is strong because different data points converge on the same career direction.";
  if (confidence === "Medium") return tr
    ? "Kariyer yönü belirgin; bazı kanıtlar tamamlandıkça tahmin daha sağlam hale gelir."
    : "The career direction is visible; the prediction becomes firmer as the remaining evidence is completed.";
  return tr
    ? "Bu tahmin erken aşamada; henüz doğrulanmamış veya eksik kariyer kanıtları var."
    : "This is an early prediction because some career evidence is still missing or unverified.";
}

function previewGapLabel(gap, lang) {
  if (!isTr(lang)) return gap;
  const text = norm(gap);
  if (/product ownership/.test(text)) return "Ürün Sahipliği";
  if (/product network/.test(text)) return "Ürün Alanında Network";
  if (/product metrics/.test(text)) return "Ürün Metrikleri";
  if (/analysis ownership/.test(text)) return "Analizden Karara Geçiş Kanıtı";
  if (/engineering network/.test(text)) return "Yazılım Alanında Network";
  if (/finance network/.test(text)) return "Finans Alanında Network";
  if (/consulting network/.test(text)) return "Danışmanlık Network'ü";
  if (/recruiting process/.test(text)) return "İşe Alım Süreci Kanıtı";
  if (/case study/.test(text)) return "Vaka Çalışması Kanıtı";
  if (/stakeholder/.test(text)) return "Paydaş Yönetimi";
  if (/experience|internship/.test(text)) return "Role Özel Deneyim";
  if (/sql|dashboard/.test(text)) return "SQL / Dashboard Kanıtı";
  if (/campaign metrics/.test(text)) return "Kampanya Metrikleri";
  if (/product scale/.test(text)) return "Ürün Ölçeği ve Tekrarlanabilirlik";
  if (/operational scale/.test(text)) return "Operasyonel Ölçek Kanıtı";
  if (/decision impact/.test(text)) return "Karar Etkisi Kanıtı";
  if (/production analytics/.test(text)) return "Production Analitik Kanıtı";
  if (/reliability \/ scale/.test(text)) return "Güvenilirlik ve Ölçek Kanıtı";
  if (/repeatable growth/.test(text)) return "Tekrarlanabilir Büyüme Kanıtı";
  if (/hiring outcome/.test(text)) return "İşe Alım Sonucu Kanıtı";
  return gap;
}

function gapWhyItMatters(gap, roleName, lang) {
  const tr = isTr(lang);
  const text = norm(gap);
  if (/product ownership|roadmap/.test(text)) return tr ? "Recruiter, ürün kararlarını gerçekten taşıyıp taşımadığını bu kanıtla değerlendirir." : "Recruiters use this proof to judge whether you can truly carry product decisions.";
  if (/metric|reporting|forecast/.test(text)) return tr ? "Sonucu ölçemeyen bir profilin iş etkisini savunmak zorlaşır." : "Without measurement, it is difficult to defend the business impact of the profile.";
  if (/user research/.test(text)) return tr ? "Ürün kararlarının gerçek kullanıcı problemiyle bağını gösterir." : "It connects product decisions to a real user problem.";
  if (/stakeholder|process scaling|process improvement/.test(text)) return tr ? "Rol, tek başına iş yapmaktan çok ekipler arasında tekrarlanabilir sonuç üretmeyi gerektirir." : "The role requires producing repeatable outcomes across teams, not only working independently.";
  if (/sql|analytics portfolio|dashboard/.test(text)) return tr ? "Analitik rollerde düşünce kalitesi ancak görünür bir veri çıktısıyla güven yaratır." : "In analytical roles, reasoning builds trust only when it is backed by a visible data output.";
  if (/business case|client/.test(text)) return tr ? "İş problemini yapılandırıp karara çevirebildiğini kanıtlar." : "It proves that you can structure a business problem and turn it into a decision.";
  if (/github|technical project|deployment/.test(text)) return tr ? "Teknik bilgi, çalışan ve incelenebilir bir çıktı olduğunda işe alım kanıtına dönüşür." : "Technical knowledge becomes hiring proof when it produces a working, inspectable output.";
  if (/financial model/.test(text)) return tr ? "Finans rollerinde karar güveni modelin varsayımları ve doğruluğu üzerinden oluşur." : "In finance roles, decision confidence comes from the model's assumptions and accuracy.";
  if (/recruitment|interview process/.test(text)) return tr ? "İK bilgisinin gerçek aday ve mülakat sürecine dönüşebildiğini gösterir." : "It shows that HR knowledge can translate into a real candidate and interview process.";
  if (/campaign|growth/.test(text)) return tr ? "Büyüme iddiası ancak kanal, deney ve sonuç birlikte görünürse ikna yaratır." : "Growth claims become credible only when channel, experiment, and outcome appear together.";
  if (/scale|repeatability|production analytics|decision impact|hiring outcome/.test(text)) return tr ? "Güçlü tekil çıktıdan sonra recruiter, aynı sonucu tekrar veya daha büyük ölçekte üretip üretemeyeceğini görmek ister." : "After a strong single outcome, recruiters look for proof that it can be repeated or produced at greater scale.";
  return tr ? `${roleName} için recruiter güvenini oluşturacak role özel kanıt eksik.` : `Role-specific proof needed to build recruiter trust for ${roleName} is missing.`;
}

function gapEvidenceMissing(gap, lang) {
  const tr = isTr(lang);
  const text = norm(gap);
  if (/product ownership/.test(text)) return tr ? "PRD, roadmap veya önceliklendirme kararı görünmüyor." : "No PRD, roadmap, or prioritization decision is visible.";
  if (/product metric/.test(text)) return tr ? "Aktivasyon, retention, dönüşüm veya kullanım metriği görünmüyor." : "No activation, retention, conversion, or usage metric is visible.";
  if (/user research/.test(text)) return tr ? "Kullanıcı görüşmesi, problem doğrulama veya araştırma çıktısı görünmüyor." : "No user interview, problem validation, or research output is visible.";
  if (/stakeholder/.test(text)) return tr ? "Paydaş koordinasyonu ve verilen ortak karar görünmüyor." : "Stakeholder coordination and the resulting shared decision are not visible.";
  if (/process improvement|process scaling/.test(text)) return tr ? "Önce/sonra süresi, hata oranı veya kapasite etkisi gösteren süreç çıktısı görünmüyor." : "No process output shows before/after time, error rate, or capacity impact.";
  if (/sql proof|sql \/ dashboard/.test(text)) return tr ? "SQL sorgusu, dashboard ve bu analizden çıkan iş kararı görünmüyor." : "No SQL query, dashboard, and resulting business decision are visible.";
  if (/analytics portfolio/.test(text)) return tr ? "Dashboard, analiz dosyası veya karar notu görünmüyor." : "No dashboard, analysis file, or decision memo is visible.";
  if (/business case/.test(text)) return tr ? "Problem, analiz, öneri ve sonuç içeren iş vakası görünmüyor." : "No business case with problem, analysis, recommendation, and outcome is visible.";
  if (/github/.test(text)) return tr ? "İncelenebilir repository veya kod örneği görünmüyor." : "No inspectable repository or code sample is visible.";
  if (/technical project/.test(text)) return tr ? "Çalışan teknik proje ve kullanılan stack görünmüyor." : "No working technical project and its stack are visible.";
  if (/deployment/.test(text)) return tr ? "Canlıya alınmış uygulama veya production kullanımı görünmüyor." : "No deployed application or production usage is visible.";
  if (/financial model/.test(text)) return tr ? "Varsayımları ve çıktıları görünen finansal model yok." : "No financial model with visible assumptions and outputs is present.";
  if (/reporting/.test(text)) return tr ? "Düzenli raporlama veya variance analizi görünmüyor." : "No recurring reporting or variance analysis is visible.";
  if (/forecast/.test(text)) return tr ? "Forecast, bütçe veya senaryo çalışması görünmüyor." : "No forecast, budget, or scenario analysis is visible.";
  if (/recruitment/.test(text)) return tr ? "Aday bulma, screening veya işe alım süreci deneyimi görünmüyor." : "No sourcing, screening, or recruiting-process experience is visible.";
  if (/interview process/.test(text)) return tr ? "Mülakat akışı, scorecard veya değerlendirme kriteri görünmüyor." : "No interview flow, scorecard, or evaluation criteria are visible.";
  if (/campaign metric|campaign experiment/.test(text)) return tr ? "Kanal, deney hipotezi ve dönüşüm sonucu birlikte görünmüyor." : "Channel, experiment hypothesis, and conversion outcome are not visible together.";
  if (/scale|repeatability|production analytics|decision impact|hiring outcome/.test(text)) return tr ? "Tekrarlanan sonuç, daha büyük kapsam veya ölçülebilir iş etkisi görünmüyor." : "No repeated outcome, larger scope, or measurable business impact is visible.";
  return tr ? "Role özel, incelenebilir bir çıktı görünmüyor." : "No role-specific, inspectable output is visible.";
}

function buildGapDetails({
  gap,
  roleName,
  roleFamily,
  roleFit,
  readinessScore: _readinessScore,
  hasCv: _hasCv,
  lang,
}) {
  return {
    key: gap,
    title: previewGapLabel(gap, lang),
    whyItMatters: gapWhyItMatters(gap, roleName, lang),
    evidenceMissing: gapEvidenceMissing(gap, lang),
    action: previewNextMove({ roleName, roleFamily, roleFit, readinessScore: 100, biggestGap: gap, hasCv: true, lang }),
  };
}

function _gapExplanation(gap, roleName, lang) {
  const tr = isTr(lang);
  const text = norm(gap);
  if (/ownership|sahip/.test(text)) return tr ? "Henüz karar aldığını ve sonucu sahiplendiğini gösteren güçlü proje kanıtı görünmüyor." : "Strong proof that you made decisions and owned the outcome is not visible yet.";
  if (/network/.test(text)) return tr ? `Hedeflediğin ${roleName} rolüne yakın profesyonel bağlantıların sınırlı görünüyor.` : `Your professional network around ${roleName} currently appears limited.`;
  if (/metric|ölç|olc/.test(text)) return tr ? "Yaptığın işin etkisini sayı veya sonuçla gösteren kanıt henüz yeterince görünür değil." : "Evidence showing the impact of your work through metrics or outcomes is not visible enough yet.";
  if (/experience|internship|deneyim/.test(text)) return tr ? `CV'de ${roleName} işini gerçek ortamda yaptığını gösteren deneyim sınırlı.` : `The CV shows limited real-world experience doing ${roleName} work.`;
  if (/stakeholder|communication|iletişim|iletisim/.test(text)) return tr ? "Ekipler veya paydaşlarla nasıl çalıştığını gösteren somut örnek eksik." : "A concrete example of how you worked with teams or stakeholders is missing.";
  if (/sql|dashboard|analysis|analiz/.test(text)) return tr ? "Analiz yaptığını gösteren SQL, dashboard veya karar çıktısı henüz görünür değil." : "A visible SQL, dashboard, or decision-support output is still missing.";
  if (/case|portfolio|project|proje/.test(text)) return tr ? `${roleName} için yetkinliğini gösterecek güçlü bir vaka veya portföy çıktısı eksik.` : `A strong case study or portfolio artifact proving ${roleName} capability is missing.`;
  if (/roadmap|product/.test(text)) return tr ? "Ürün kararlarını nasıl önceliklendirdiğini gösteren roadmap, PRD veya vaka kanıtı eksik." : "Roadmap, PRD, or case evidence showing how you prioritized product decisions is missing.";
  return tr ? `${roleName} için recruiter'ın güveneceği somut ve role özel kanıt henüz yeterince görünür değil.` : `Concrete, role-specific proof a recruiter can trust for ${roleName} is not visible enough yet.`;
}

function previewNextMove({ roleName, roleFamily, roleFit, readinessScore, biggestGap, hasCv, lang }) {
  const tr = isTr(lang);
  const gap = norm(biggestGap);
  if (!hasCv && readinessScore < 55) return tr ? "CV'ni yükle ve mevcut deneyimlerini hedef rolle karşılaştır." : "Upload your CV and compare your current experience with the target role.";
  if (/network/.test(gap)) return tr ? `${roleName} rolünde çalışan biriyle 20 dakikalık kariyer görüşmesi planla.` : `Schedule a 20-minute career conversation with someone working in ${roleName}.`;
  if (roleFamily === "PRODUCT" && /ownership|roadmap|product/.test(gap)) return tr ? "Tek sayfalık bir ürün vaka çalışması hazırla ve aldığın kararları göster." : "Create a one-page product case study showing the decisions you made.";
  if (roleFamily === "PRODUCT" && /user research/.test(gap)) return tr ? "5 kullanıcı görüşmesi yap ve bulguları tek sayfalık problem notuna dönüştür." : "Run 5 user interviews and turn the findings into a one-page problem brief.";
  if (/ownership/.test(gap)) return tr ? `${roleName} için aldığın bir kararı ve sonucunu gösteren kısa bir vaka hazırla.` : `Create a short case showing one decision you made and its outcome in ${roleName}.`;
  if (/metric|ölç|olc/.test(gap) && !/campaign/.test(gap)) return tr ? "Bir projene tek ölçülebilir sonuç ekle." : "Add one measurable outcome to a project.";
  if (/sql|dashboard|analysis|analiz/.test(gap)) return tr ? "Portföyüne tek bir SQL veya dashboard çıktısı ekle." : "Add one SQL or dashboard output to your portfolio.";
  if (/github|technical project|deployment/.test(gap)) return tr ? "Küçük bir uygulamayı canlıya al ve GitHub README'sinde teknik kararlarını açıkla." : "Deploy a small application and explain your technical decisions in its GitHub README.";
  if (/financial model|reporting|forecast/.test(gap)) return tr ? "Üç senaryolu bir finansal model hazırla; varsayım ve sonuçları tek sayfada göster." : "Build a three-scenario financial model and show its assumptions and outcomes on one page.";
  if (/recruitment|interview process/.test(gap)) return tr ? "Bir rol için mülakat akışı ve değerlendirme scorecard'ı hazırla." : "Create an interview flow and evaluation scorecard for one role.";
  if (/process improvement|process scaling/.test(gap)) return tr ? "Bir süreci haritala ve süre, hata veya kapasite etkisini önce/sonra göster." : "Map one process and show before/after time, error, or capacity impact.";
  if (/campaign|growth/.test(gap)) return tr ? "Bir kampanya için hipotez, kanal, hedef metrik ve sonuç taslağı hazırla." : "Draft a campaign with a hypothesis, channel, target metric, and outcome.";
  if (/scale|repeatability|production analytics|decision impact|hiring outcome/.test(gap)) return tr ? "En güçlü çıktını ikinci bir örnek veya daha büyük kapsamla tekrar kanıtla." : "Prove your strongest outcome again through a second example or at a larger scale.";
  if (/case|portfolio|project|proje/.test(gap)) return tr ? `${roleName} için tek sayfalık bir vaka çalışması tamamla.` : `Complete a one-page case study for ${roleName}.`;
  if (/recruiting process|interview process/.test(gap)) return tr ? "Örnek bir işe alım sürecini adım adım tasarla ve portföyüne ekle." : "Design a sample recruiting process step by step and add it to your portfolio.";
  if (/stakeholder/.test(gap)) return tr ? "Bir projede yönettiğin paydaşları ve aldığın kararı tek örnekle anlat." : "Show one project example with the stakeholders you managed and the decision you made.";
  if (/experience|internship|deneyim/.test(gap)) return tr ? `${roleName} için bir staj veya gerçek iş brief'i bul.` : `Find one internship or real-world brief for ${roleName}.`;
  if (roleFit < 56) return tr ? `${roleName} için tek sayfalık bir vaka çalışması tamamla.` : `Complete a one-page case study for ${roleName}.`;
  return tr ? `LinkedIn başlığında ${roleName} yönünü netleştir.` : `Make ${roleName} explicit in your LinkedIn headline.`;
}

export function buildCareerPreview({
  basic = {},
  goals = {},
  dnaAnswers = {},
  readinessAnswers = {},
  cv = {},
  lang = "TR",
} = {}) {
  const traitScores = scoreCareerDnaAnswers(dnaAnswers, lang);
  const dna = { scores: traitScores, traitScores, answers: dnaAnswers };
  const hasCv = Boolean(
    cv?.cvExists ||
    cv?.cvUploaded ||
    cv?.cvFileName ||
    cv?.cvStatus === "current" ||
    basic?.cvExists ||
    basic?.cvUploaded ||
    basic?.cvFileName ||
    basic?.cvStatus === "current"
  );
  const careerReadiness = buildCareerReadiness({
    basic: { ...basic, ...cv },
    goals,
    dna,
    readinessAnswers,
    hasCv,
    lang,
  });
  const profile = {
    basic_profile: { ...basic, ...cv },
    career_goals: goals,
    career_dna: dna,
    career_readiness: careerReadiness,
    target_roles: goals.targetRoles || [],
    primary_industry: goals.industries?.[0] || goals.primaryIndustry || "",
  };
  const familyDetection = detectRoleFamilies(profile, goals);
  const identity = resolveCareerIdentityDetail(profile, goals, careerReadiness.pillars, lang, familyDetection);
  const weightedFitFoundation = buildWeightedFitFoundation(profile, lang);
  const coreIntelligence =
    identity.identityV3?.coreIntelligence ||
    buildCoreIntelligence({
      profile,
      targetRole: goals.primaryRole || goals.targetRoles?.[0],
      roleFamily: familyDetection.primary,
      lang,
    });
  const evidence = coreIntelligence.evidence.byDimension;
  const strongestSignal = strongestSignalFromProfile(profile, careerReadiness.pillars, lang);
  const biggestGap = biggestGapFromProfile(profile, careerReadiness.pillars, goals, lang, familyDetection);
  const rawRoleMatches = buildRoleMatches(
    profile,
    goals,
    lang,
    weightedFitFoundation,
    identity.title,
    strongestSignal,
    familyDetection,
    coreIntelligence
  );
  const answeredReadiness = READINESS_KEYS.reduce(
    (count, key) => count + (readinessAnswers?.[key] ? 1 : 0),
    0
  );
  const dnaCount = Object.values(dnaAnswers || {}).filter((value) => Number(value) >= 1 && Number(value) <= 5).length;
  const roleMatches = rawRoleMatches.map((match) => ({
    ...match,
    fitBand: roleFitBand(match.roleFitScore, lang),
  }));
  const rangeRadius = answeredReadiness >= 5 ? 3 : answeredReadiness >= 3 ? 6 : answeredReadiness >= 1 ? 10 : 15;
  const readinessScore = clamp(careerReadiness.score);
  const topMatch = roleMatches[0] || null;
  const secondaryMatch = roleMatches[1] || null;
  const roleName = topMatch?.roleName || (isTr(lang) ? "hedef rol" : "target role");
  const confidenceSignals = {
    hasPrimaryRole: Boolean(goals.primaryRole),
    hasTarget: Boolean(goals.primaryRole || goals.targetRoles?.length),
    hasSector: Boolean(goals.industries?.length || goals.primaryIndustry),
    experienceAnswered: Boolean(readinessAnswers?.experience),
    hasExperienceProof: isPositiveBenchmark(readinessAnswers?.experience) && readinessAnswers?.experience !== "club",
    projectsAnswered: Boolean(readinessAnswers?.projects),
    hasProjectProof: isPositiveBenchmark(readinessAnswers?.projects),
    leadershipAnswered: Boolean(readinessAnswers?.leadership),
    hasLeadershipProof: isPositiveBenchmark(readinessAnswers?.leadership),
    dnaCount,
    hasCv,
    matchConfidence: topMatch?.confidence,
    roleName,
  };
  const confidence = previewConfidence({ matchConfidence: topMatch?.confidence, signals: confidenceSignals });
  const confidenceReasonList = confidenceReasons({
    confidence,
    signals: confidenceSignals,
    lang,
  });
  const primaryGapKey = topMatch?.missingSignals?.[0] || biggestGap;
  const baseGapDetails = buildGapDetails({
    gap: primaryGapKey,
    roleName,
    roleFamily: familyDetection.primary,
    roleFit: topMatch?.roleFitScore || 0,
    readinessScore,
    hasCv,
    lang,
  });

  const evidenceOpportunity = topMatch?.evidenceOpportunity;
  const evidenceAction = topMatch?.evidenceRecommendation?.action;
  const gapDetails = evidenceOpportunity
    ? {
      ...baseGapDetails,
      key: evidenceOpportunity.id,
      title: evidenceOpportunity.title,
      whyItMatters: evidenceOpportunity.missingEvidence,
      evidenceMissing: evidenceOpportunity.missingEvidence,
      action: evidenceAction || evidenceOpportunity.action,
    }
    : baseGapDetails;
  const nextBestMove = evidenceAction || previewNextMove({
    roleName,
    roleFamily: familyDetection.primary,
    roleFit: topMatch?.roleFitScore || 0,
    readinessScore,
    biggestGap: primaryGapKey,
    hasCv,
    lang,
  });

  const trustLayer = buildPreviewTrustLayer({
    goals,
    roleFamily: familyDetection.primary,
    identityTitle: identity.title,
    evidence,
    traitScores,
    topMatch,
    gapDetails,
    confidence,
    confidenceSignals,
    confidenceReasons: confidenceReasonList,
    fastestProof: nextBestMove,
    lang,
  });

  return {
    identity: identity.title,
    identityExplanation: identity.explanation,
    topMatch,
    secondaryMatch,
    roleMatches,
    confidence,
    confidenceSummary: confidenceSummary(confidence, lang),
    confidenceReasons: confidenceReasonList,
    strongestSignal,
    biggestGap: gapDetails.title,
    biggestGapKey: gapDetails.key,
    biggestGapExplanation: gapDetails.whyItMatters,
    gapDetails,
    readinessScore,
    readinessRange: {
      min: clamp(readinessScore - rangeRadius),
      max: clamp(readinessScore + rangeRadius),
    },
    why: trustLayer.whatIncreasedMatch.text,
    nextBestMove,
    trustLayer,
    inputCoverage: {
      confidenceSignals: Object.values(confidenceSignals).filter(Boolean).length,
      readinessAnswers: answeredReadiness,
      dnaAnswers: dnaCount,
    },
  };
}

const READINESS_KEYS = ["english", "network", "experience", "projects", "leadership"];

function rolePracticeAction(family, roleName, lang) {
  const tr = isTr(lang);
  const actions = {
    PRODUCT: tr ? "3 ürünün onboarding akışını karşılaştır ve tek sayfalık önceliklendirme notu yaz." : "Compare the onboarding flows of 3 products and write a one-page prioritization memo.",
    OPERATIONS: tr ? "Tekrarlanan bir iş akışı için tek sayfalık SOP ve kontrol listesi hazırla." : "Create a one-page SOP and control checklist for a recurring workflow.",
    BUSINESS: tr ? `3 ${roleName} ilanını karşılaştır ve kanıt-gereksinim matrisi çıkar.` : `Compare 3 ${roleName} postings and build an evidence-requirement matrix.`,
    DATA: tr ? "Herkese açık bir dashboard'u incele ve buradan üç karar içgörüsü yaz." : "Review a public dashboard and write three decision insights from it.",
    SOFTWARE: tr ? "3 açık kaynak projenin mimarisini karşılaştır ve trade-off notu yaz." : "Compare the architecture of 3 public repositories and write a tradeoff note.",
    MARKETING: tr ? "3 rakibin acquisition funnel'ını karşılaştır ve test edilebilir tek bir boşluk bul." : "Compare 3 competitor acquisition funnels and identify one testable gap.",
    HR: tr ? "3 rol ilanını karşılaştır ve ortak yetkinlik matrisi hazırla." : "Compare 3 role descriptions and create a competency matrix.",
    FINANCE: tr ? "Halka açık bir finansal raporu incele ve tek sayfalık sapma notu yaz." : "Review one public financial report and write a one-page variance memo.",
  };
  return actions[family] || (tr ? `${roleName} için tek sayfalık role özel çalışma üret.` : `Create one role-specific one-page artifact for ${roleName}.`);
}

function buildCareerGps30Days({ topRole, gapDetails, readinessScore, hasCv, lang }) {
  const tr = isTr(lang);
  const roleName = topRole?.roleName || (tr ? "hedef rol" : "target role");
  const family = roleFamilyFor(topRole?.roleId || roleName);
  const lowReadiness = Number(readinessScore || 0) < 60;
  const candidates = [
    {
      action: tr ? `LinkedIn başlığında ${roleName} yönünü netleştir.` : `Make ${roleName} explicit in your LinkedIn headline.`,
      why: tr ? "Recruiter ilk okumada hedef rolünü daha hızlı anlar." : "A recruiter can identify your target role faster on the first read.",
    },
    {
      action: gapDetails.action,
      why: gapDetails.whyItMatters,
    },
    {
      action: rolePracticeAction(family, roleName, lang),
      why: tr ? `${roleName} için incelenebilir, role özel bir çıktı oluşturur.` : `It creates an inspectable, role-specific artifact for ${roleName}.`,
    },
    {
      action: !hasCv
        ? (tr ? "CV'ni yükle ve en güçlü iki deneyimini role göre kontrol et." : "Upload your CV and check your two strongest experiences against the role.")
        : lowReadiness
          ? (tr ? "CV'ndeki bir deneyimi görev değil, sonuç gösterecek şekilde yeniden yaz." : "Rewrite one CV experience around an outcome, not a responsibility.")
          : (tr ? "En güçlü deneyimine tek ölçülebilir sonuç ekle." : "Add one measurable outcome to your strongest experience."),
      why: tr ? "Recruiter, iddiadan çok görünür sonuç üzerinden güven oluşturur." : "Recruiter trust forms around visible outcomes rather than claims.",
    },
  ];
  return { actions: candidates.slice(0, 4) };
}

function _buildGrowthPotential(candidateSignals = {}, lang = "TR") {
  const tr = isTr(lang);
  const projects = candidateSignals.projects ?? 40;
  const experience = candidateSignals.experience ?? 40;
  const leadership = candidateSignals.leadership ?? 40;
  const learningVelocity = Math.round(((candidateSignals.projects ?? 40) + (candidateSignals.english ?? 40) + (candidateSignals.roleClarity ?? 40)) / 3);
  const score = clamp(projects * 0.3 + experience * 0.3 + leadership * 0.2 + learningVelocity * 0.2);
  const label = score >= 76 ? (tr ? "Yüksek" : "High") : score >= 50 ? (tr ? "Orta" : "Medium") : (tr ? "Düşük" : "Low");
  const strongest = [
    [projects, tr ? "proje üretimi" : "project output"],
    [experience, tr ? "deneyim birikimi" : "experience depth"],
    [leadership, tr ? "liderlik" : "leadership"],
    [learningVelocity, tr ? "öğrenme hızı" : "learning velocity"],
  ].sort((a, b) => b[0] - a[0])[0][1];
  const weakest = [
    [projects, tr ? "proje kanıtı" : "project proof"],
    [experience, tr ? "deneyim" : "experience"],
    [leadership, tr ? "liderlik" : "leadership"],
    [learningVelocity, tr ? "öğrenme hızı" : "learning velocity"],
  ].sort((a, b) => a[0] - b[0])[0][1];
  return {
    label,
    score,
    learningVelocity,
    why: tr ? `En hızlı büyüme sinyalin ${strongest}; büyümeyi sınırlayan alan ${weakest}.` : `Your strongest growth signal is ${strongest}; ${weakest} is the current limiter.`,
  };
}

function buildCareerDirection(snapshotParts) {
  const {
    identityTitle,
    primaryRole,
    nearestField,
    strongestSignal,
    biggestGap,
    nextMove,
  } = snapshotParts;
  const destination = primaryRole || nearestField || "your target role";
  return `Based on your profile, your fastest path is ${destination}: lead with the ${identityTitle} story, keep ${strongestSignal} visible, and close the ${biggestGap} gap with one concrete proof point. Start with: ${nextMove}`;
}

function buildFastestPath({ targetRole, strongestSignal, biggestGap, nextMove }) {
  return {
    targetRole: targetRole || "Target role",
    strengths: strongestSignal || "Strongest signal",
    gaps: biggestGap || "Biggest gap",
    nextMove: nextMove || "Add one measurable outcome to your CV.",
  };
}

/** Summary rows for the post-onboarding success card */
export function buildOnboardingSummaryRows(profile, lang = "TR") {
  const goals = profile?.career_goals || {};
  const tr = isTr(lang);
  const industries = goals.industries || profile?.industries || [];
  const roles = goals.targetRoles || profile?.target_roles || profile?.best_fit_roles || [];
  const expLevels = goals.experienceLevels || (goals.experienceLevel ? [goals.experienceLevel] : []);
  const workModes = goals.workModels || (goals.workMode ? [goals.workMode] : goals.preferredLocation ? [goals.preferredLocation] : []);
  const lookingFor = goals.lookingFor || [];
  const basic = profile?.basic_profile || {};
  const signalLabels = (values, options) =>
    normalizeSignalSelection(values, options)
      .map((id) => options.find((option) => option.id === id))
      .filter(Boolean)
      .map((option) => tr ? option.labelTr : option.labelEn);

  const workParts = [
    ...workModes.map((id) => optionLabel(WORK_MODE_OPTIONS, id, lang)),
    ...lookingFor.map((id) => optionLabel(LOOKING_FOR_OPTIONS, id, lang)),
  ].filter(Boolean);

  return {
    targetIndustries: industries.map((id) => getIndustryLabel(id, lang)).filter(Boolean),
    targetRoles: roles.slice(0, 6).map((id) => getRoleLabel(id, lang)).filter(Boolean),
    experienceSignals: signalLabels(basic.experienceSignals, EXPERIENCE_SIGNAL_OPTIONS),
    leadershipSignals: signalLabels(basic.leadershipSignals, LEADERSHIP_SIGNAL_OPTIONS),
    experienceLevel: expLevels.length
      ? expLevels.map((id) => optionLabel(EXPERIENCE_LEVELS, id, lang)).join(", ")
      : tr
        ? "Belirtilmedi"
        : "Not specified",
    workPreferences: workParts.length
      ? [...new Set(workParts)].join(" · ")
      : tr
        ? "Esnek"
        : "Flexible",
  };
}

/** Mini career report from DNA / readiness answers */
export function buildCareerSnapshot(profile, lang = "TR") {
  const tr = isTr(lang);
  const goals = profile?.career_goals || {};
  const readiness = profile?.career_readiness || {};
  const pillars = resolvePillars(profile);
  const sorted = [...pillars].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const industries = goals.industries || profile?.industries || [];
  const primaryIndustry = industries[0] || profile?.primary_industry || "";
  const roleId =
    goals.primaryRole ||
    goals.targetRoles?.[0] ||
    profile?.best_fit_roles?.[0] ||
    profile?.target_roles?.[0] ||
    "";
  const weightedFitFoundation = buildWeightedFitFoundation(profile, lang);
  const targetRoleDirection = topRoleDirections(profile, goals, lang);
  const roleFamily = detectRoleFamilies(profile, goals);
  const identity = resolveCareerIdentityDetail(profile, goals, pillars, lang, roleFamily);
  const careerIdentity = identity.title || resolveCareerIdentity(profile, goals, lang);
  const coreIntelligence =
    identity.identityV3?.coreIntelligence ||
    buildCoreIntelligence({
      profile,
      targetRole: roleId,
      roleFamily: roleFamily.primary,
      lang,
    });
  const evidence = coreIntelligence.evidence.byDimension;
  const readinessScore = readiness.score ?? Math.round(
    Object.values(weightedFitFoundation.candidateSignals || {}).reduce((sum, n) => sum + Number(n || 0), 0) /
      Math.max(1, Object.values(weightedFitFoundation.candidateSignals || {}).length)
  );
  const strongestSignal = strongestSignalFromProfile(profile, pillars, lang);
  const fallbackGap = biggestGapFromProfile(profile, pillars, goals, lang, roleFamily);
  const topRoleMatches = buildRoleMatches(profile, goals, lang, weightedFitFoundation, careerIdentity, strongestSignal, roleFamily, coreIntelligence)
    .map((match) => ({ ...match, fitBand: roleFitBand(match.roleFitScore, lang) }));
  const hasCv = Boolean(readiness.hasCv || profile?.cvExists || profile?.basic_profile?.cvExists || profile?.basic_profile?.cvStatus === "current");
  const primaryMatch = topRoleMatches[0] || null;
  const targetRoleName = primaryMatch?.roleName || (roleId ? humanRoleLabel(roleId, lang) : tr ? "hedef rol" : "target role");
  const primaryGapKey = primaryMatch?.missingSignals?.[0] || fallbackGap;
  const baseGapDetails = buildGapDetails({
    gap: primaryGapKey,
    roleName: targetRoleName,
    roleFamily: roleFamily.primary,
    roleFit: primaryMatch?.roleFitScore || 0,
    readinessScore,
    hasCv,
    lang,
  });
  const evidenceOpportunity = primaryMatch?.evidenceOpportunity;
  const evidenceAction = primaryMatch?.evidenceRecommendation?.action;
  const gapDetails = evidenceOpportunity
    ? {
      ...baseGapDetails,
      key: evidenceOpportunity.id,
      title: evidenceOpportunity.title,
      whyItMatters: evidenceOpportunity.missingEvidence,
      evidenceMissing: evidenceOpportunity.missingEvidence,
      action: evidenceAction || evidenceOpportunity.action,
    }
    : baseGapDetails;
  const biggestGap = gapDetails.title;
  const nextMove = evidenceAction || previewNextMove({
    roleName: targetRoleName,
    roleFamily: roleFamily.primary,
    roleFit: primaryMatch?.roleFitScore || 0,
    readinessScore,
    biggestGap: primaryGapKey,
    hasCv,
    lang,
  });
  const gapActions = [gapDetails.action];
  const expectedScoreIncrease = expectedScoreIncreaseForGap(primaryGapKey, pillars);
  const learningFocus = learningFocusFromGap(primaryGapKey, targetRoleDirection);
  const scoreBreakdown = scoreBreakdownFromPillars(pillars, readinessScore);
  const careerGps30Days = buildCareerGps30Days({
    topRole: primaryMatch,
    gapDetails,
    readinessScore,
    hasCv,
    lang,
  });
  const next30Days = careerGps30Days.actions.map((item) => item.action);
  const growthPotential = buildGrowthPotentialWow({
    candidateSignals: weightedFitFoundation.candidateSignals,
    readinessScore,
    evidence,
    profile,
    readinessAnswers: profile.career_readiness?.benchmarks || profile.career_readiness?.readinessAnswers || {},
    primaryMatch,
    lang,
  });
  const identityWow = buildIdentityWow({
    identityTitle: careerIdentity,
    roleFamily: roleFamily.primary,
    lang,
  });
  const whyThisRole = buildWhyThisRole({
    roleName: primaryMatch?.roleName || targetRoleName,
    roleFamily: roleFamily.primary,
    goals,
    evidence,
    identityTitle: careerIdentity,
    lang,
  });
  if (topRoleMatches[0]) {
    topRoleMatches[0] = { ...topRoleMatches[0], whyItFits: whyThisRole.text };
  }
  const nearestField = getIndustryLabel(primaryIndustry, lang) || (tr ? "Genel Kariyer" : "General career");
  const targetRole = roleId ? humanRoleLabel(roleId, lang) : topRoleMatches[0]?.roleName || "";
  const careerDirection = buildCareerDirection({
    identityTitle: careerIdentity,
    primaryRole: targetRole,
    nearestField,
    strongestSignal,
    biggestGap,
    nextMove,
  });
  const fastestPath = buildFastestPath({ targetRole, strongestSignal, biggestGap, nextMove });
  const confidenceLabel = tr
    ? ({ High: "Yüksek", Medium: "Orta", Low: "Düşük" }[primaryMatch?.confidence] || "Oluşuyor")
    : primaryMatch?.confidence || "Forming";
  const careerScoreWhy = tr
    ? `${strongest?.label || "En güçlü alan"} skoru yukarı taşırken ${weakest?.label || "gelişim alanı"} toplam hazırlığı sınırlıyor.`
    : `${strongest?.label || "The strongest pillar"} lifts the score while ${weakest?.label || "the weakest pillar"} limits overall readiness.`;
  const careerOsHome = {
    identity: { value: careerIdentity, why: identityWow.narrative },
    careerScore: { value: readinessScore, why: careerScoreWhy },
    biggestGap: gapDetails,
    nextAction: { value: nextMove, why: gapDetails.whyItMatters },
    careerGps: careerGps30Days,
    topRole: {
      value: primaryMatch?.roleName || targetRole,
      fitBand: primaryMatch?.fitBand,
      why: whyThisRole.text,
    },
    confidence: {
      value: confidenceLabel,
      why: primaryMatch?.confidence === "High"
        ? (tr ? `Güveni taşıyan kanıtlar: ${primaryMatch.strongSignals.slice(0, 2).join(", ")}.` : `Confidence is supported by: ${primaryMatch.strongSignals.slice(0, 2).join(", ")}.`)
        : primaryMatch?.confidence === "Medium"
          ? (tr ? `Yön görünür; güveni sınırlayan eksikler: ${primaryMatch.missingSignals.slice(0, 2).join(", ")}.` : `The direction is visible; confidence is limited by: ${primaryMatch.missingSignals.slice(0, 2).join(", ")}.`)
          : (tr ? `Tahmin erken aşamada; eksik kanıtlar: ${primaryMatch?.missingSignals?.slice(0, 2).join(", ") || "role özel proje ve deneyim"}.` : `The estimate is early; missing proof: ${primaryMatch?.missingSignals?.slice(0, 2).join(", ") || "role-specific projects and experience"}.`),
    },
    growthPotential,
  };
  const recruiterView = buildRecruiterView({
    lang,
    primaryMatch,
    roleFamily: roleFamily.primary,
    strongestSignal,
    gapDetails,
    targetRole,
  });
  const whatHireFitNoticed = buildWhatHireFitNoticed({
    identityWow,
    identityTitle: careerIdentity,
    roleFamily: roleFamily.primary,
    primaryMatch: topRoleMatches[0],
    gapDetails,
    evidence,
    goals,
    profile,
    lang,
  });

  const snapshotConfidence = {
    value: confidenceLabel,
    why: primaryMatch?.confidence === "High"
      ? (tr ? `Güveni taşıyan kanıtlar: ${primaryMatch.strongSignals.slice(0, 2).join(", ")}.` : `Confidence is supported by: ${primaryMatch.strongSignals.slice(0, 2).join(", ")}.`)
      : primaryMatch?.confidence === "Medium"
        ? (tr ? `Yön görünür; güveni sınırlayan eksikler: ${primaryMatch.missingSignals.slice(0, 2).join(", ")}.` : `The direction is visible; confidence is limited by: ${primaryMatch.missingSignals.slice(0, 2).join(", ")}.`)
        : (tr ? `Tahmin erken aşamada; eksik kanıtlar: ${primaryMatch?.missingSignals?.slice(0, 2).join(", ") || "role özel proje ve deneyim"}.` : `The estimate is early; missing proof: ${primaryMatch?.missingSignals?.slice(0, 2).join(", ") || "role-specific projects and experience"}.`),
  };

  return {
    analysisSources:
      profile?.analysis_sources ||
      profile?.basic_profile?.analysisSources ||
      [],
    careerIdentity,
    careerIdentityTitle: careerIdentity,
    careerIdentityExplanation: identityWow.fullText,
    identityWow,
    whyThisRole,
    whatHireFitNoticed,
    identity,
    roleFamily: {
      primary: roleFamily.primary,
      primaryLabel: familyLabel(roleFamily.primary),
      secondary: roleFamily.secondary,
      secondaryLabel: familyLabel(roleFamily.secondary),
      scores: roleFamily.scores,
      ranked: roleFamily.ranked,
    },
    targetRoleDirection,
    topRoleMatches,
    roleMatches: topRoleMatches,
    currentReadiness: readinessScore,
    readinessLabel: readinessLabel(readinessScore, lang),
    strongestSignal,
    biggestGap,
    gapDetails,
    biggestGapActions: gapActions,
    expectedScoreIncrease,
    suggestedNextMove: nextMove,
    recommendedNextMove: nextMove,
    learningFocus,
    next30Days,
    careerGps30Days,
    growthPotential,
    careerOsHome,
    recruiterView,
    snapshotConfidence,
    primaryRoleMatch: topRoleMatches[0] || null,
    careerDirection,
    fastestPath,
    scoreBreakdown,
    weightedFitFoundation,
    nearestField,
    nearestFieldId: primaryIndustry,
    readinessScore,
    strongestPillar: strongest?.label || (tr ? "Profil güçlü yönleri" : "Profile strengths"),
    weakestPillar: weakest?.label || (tr ? "Gelişim alanı" : "Growth area"),
    highInterestAreas: industries.slice(0, 5).map((id) => getIndustryLabel(id, lang)).filter(Boolean),
    targetRole,
    targetRoleId: roleId,
    updatedAt: profile?.updated_at || new Date().toISOString(),
  };
}

/** Synthetic JD from target role + sector for first free analysis */
export function buildSyntheticJobDescription(profile, lang = "TR") {
  const tr = isTr(lang);
  const goals = profile?.career_goals || {};
  const roleId =
    goals.primaryRole ||
    goals.targetRoles?.[0] ||
    profile?.best_fit_roles?.[0] ||
    "";
  const role = roleId ? getRoleLabel(roleId, lang) : tr ? "Hedef Rol" : "Target role";
  const industryId = goals.industries?.[0] || profile?.primary_industry || "technology";
  const ctx = getIndustryContext(industryId, { goals, lang });
  const expLevels = goals.experienceLevels || [];
  const expLabel = expLevels.length
    ? expLevels.map((id) => optionLabel(EXPERIENCE_LEVELS, id, lang)).join(", ")
    : goals.experienceLevel || goals.seniority || "";

  const bullets = ctx.atsKeywords.slice(0, 10).map((k) => `- ${k}`).join("\n");

  if (tr) {
    return `Pozisyon: ${role}
Sektör: ${ctx.industryLabel}

Aranan nitelikler:
${bullets}

Deneyim seviyesi: ${expLabel || "Junior–Mid"}

${ctx.marketIntelligence}

Bu ilan, Career DNA profiline göre oluşturulmuş hedef rol tanımıdır.`;
  }

  return `Role: ${role}
Industry: ${ctx.industryLabel}

Requirements:
${bullets}

Experience level: ${expLabel || "Junior–Mid"}

${ctx.marketIntelligence}

This job description is synthesized from your Career DNA target role.`;
}

/** DNA ↔ CV match — uses ATS payload when available, else heuristics */
export function buildCvDnaMatch(profile, cvText = "", lang = "TR", atsPayload = null) {
  const tr = isTr(lang);
  const goals = profile?.career_goals || {};
  const roleId =
    goals.primaryRole ||
    goals.targetRoles?.[0] ||
    profile?.best_fit_roles?.[0] ||
    "";
  const targetRole = roleId ? getRoleLabel(roleId, lang) : tr ? "Hedef rol" : "Target role";
  const industryId = goals.industries?.[0] || profile?.primary_industry || "technology";
  const ctx = getIndustryContext(industryId, { goals, lang });
  const pillars = resolvePillars(profile);
  const strongPillars = [...pillars].sort((a, b) => b.score - a.score).slice(0, 3).map((p) => p.label);

  if (atsPayload?.ATS) {
    const ats = atsPayload.ATS;
    const gaps = [
      ...(Array.isArray(ats.missing_keywords) ? ats.missing_keywords : []),
      ...(Array.isArray(ats.missing_skills) ? ats.missing_skills : []),
    ]
      .map((g) => String(g).trim())
      .filter(Boolean)
      .slice(0, 3);
    const strengths = [
      ...(Array.isArray(ats.matched_skills) ? ats.matched_skills : []),
      ...strongPillars,
    ]
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 3);

    return {
      targetRole,
      compatibilityScore: clamp(ats.ats_score ?? ats.keyword_match ?? 70),
      gaps: gaps.length ? gaps : ctx.cvImprovementTips.slice(0, 3),
      strengths: strengths.length ? strengths : strongPillars,
    };
  }

  const cvL = norm(cvText);
  const keywords = ctx.atsKeywords || [];
  const matched = keywords.filter((k) => cvL.includes(norm(k)));
  const missing = keywords.filter((k) => !cvL.includes(norm(k)));
  const readinessScore = profile?.career_readiness?.score ?? 62;
  const keywordRatio = keywords.length ? matched.length / keywords.length : 0.45;
  const compatibilityScore = clamp(readinessScore * 0.5 + keywordRatio * 50);

  return {
    targetRole,
    compatibilityScore,
    gaps: (missing.length ? missing : ctx.cvImprovementTips).slice(0, 3),
    strengths: (strongPillars.length ? strongPillars : matched).slice(0, 3),
  };
}

/** Strip full analyze-v2 response to onboarding teaser fields */
export function extractAnalysisTeaser(v2, profile, lang = "TR") {
  const tr = isTr(lang);
  const pillars = resolvePillars(profile);
  const topPillar = [...pillars].sort((a, b) => b.score - a.score)[0];
  const weakPillar = [...pillars].sort((a, b) => a.score - b.score)[0];

  const miss = [
    ...(Array.isArray(v2?.ATS?.missing_keywords) ? v2.ATS.missing_keywords : []),
    ...(Array.isArray(v2?.ATS?.missing_skills) ? v2.ATS.missing_skills : []),
    ...(Array.isArray(v2?.Gaps?.critical_gaps) ? v2.Gaps.critical_gaps : []),
    ...(Array.isArray(v2?.Gaps?.missing) ? v2.Gaps.missing : []),
  ]
    .map((g) => (typeof g === "string" ? g : g?.label || g?.skill || ""))
    .map((g) => String(g).trim())
    .filter(Boolean);

  const matched = (Array.isArray(v2?.ATS?.matched_skills) ? v2.ATS.matched_skills : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  const atsScore =
    v2?.ATS?.ats_score ??
    v2?.Output?.alignment_score ??
    v2?.Decision?.alignment_score ??
    null;

  return {
    atsScore: atsScore != null ? clamp(atsScore) : null,
    strongestArea:
      matched[0] ||
      topPillar?.label ||
      (tr ? "Profil güçlü yönleri" : "Profile strengths"),
    criticalGap:
      miss[0] ||
      weakPillar?.label ||
      (tr ? "CV'de hedef role kanıt" : "Role proof on CV"),
  };
}
