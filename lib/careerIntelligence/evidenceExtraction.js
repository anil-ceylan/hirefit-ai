import { scoreCareerDnaAnswers } from "../careerOnboarding/careerDna.js";
import { normalizeTraitScoresTo100 } from "./evidenceDimensions.js";
import { createEvidenceConfig } from "./evidenceConfig.js";

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%+.#/ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function textOf(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  return [
    value.title,
    value.name,
    value.role,
    value.company,
    value.description,
    value.details,
    value.outcome,
    value.impact,
    value.summary,
  ].filter(Boolean).join(" ");
}

function hash(value) {
  let result = 5381;
  for (const char of String(value || "")) result = ((result << 5) + result) ^ char.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function yearFrom(value) {
  const years = String(value || "").match(/\b(19|20)\d{2}\b/g);
  return years?.length ? Number(years[years.length - 1]) : null;
}

function specificityFor(text) {
  if (/\b\d+(?:[.,]\d+)?\s*(?:%|x|k|m|users?|customers?|clients?|hours?|days?|weeks?|months?|tl|usd|eur)?\b/i.test(text)) return "quantified";
  if (String(text || "").trim().length >= 45) return "specific";
  return "generic";
}

function splitEvidenceText(text) {
  return String(text || "")
    .split(/\r?\n|[•●▪]|\s+-\s+|(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
    .slice(0, 120);
}

const SIGNAL_PATTERNS = [
  ["founder", /founder|co-?founder|kurucu|giri[sş]imci/],
  ["product", /product|roadmap|backlog|prd|user stor|ürün/],
  ["internship", /intern|internship|staj/],
  ["hackathon", /hackathon/],
  ["leadership", /led|leadership|team lead|project lead|lider|yönet/],
  ["github", /github|repository|repo\b/],
  ["ai_project", /\bai\b|artificial intelligence|machine learning|yapay zeka/],
  ["presentation", /presented|presentation|sunum|pitch/],
  ["networking", /network|mentorship|community|topluluk/],
  ["analytics", /\bsql\b|dashboard|tableau|power bi|analytics|analiz/],
  ["customer", /customer|user research|interviewed users|müşteri|kullanıcı görüş/],
  ["execution", /launched|shipped|deployed|delivered|built|yayına ald|canlıya al|geliştird/],
];

const EVIDENCE_PATTERNS = [
  ["quantified_outcome", /\b\d+(?:[.,]\d+)?\s*(?:%|x|k|m|users?|customers?|clients?|hours?|days?|weeks?|months?|tl|usd|eur)\b|increased|reduced|grew|saved|iyileştir|artır|azalt|büyüt/],
  ["revenue_outcome", /revenue|sales|arr|mrr|gmv|profit|gelir|satış|ciro|monetiz/],
  ["shipped_product", /launched|shipped|deployed|released|live product|production|canlıya al|yayına al|ürünü çık|mvp/],
  ["customer_validation", /user research|customer interview|user interview|customer feedback|user feedback|müşteri görüş|kullanıcı görüş|geri bildirim/],
  ["cross_functional_delivery", /cross-functional|stakeholder|engineering and design|sales and product|fonksiyonlar arası|paydaş/],
  ["repeatable_system", /workflow|automation|sop|process design|operating model|repeatable|iş akışı|otomasyon|süreç tasar/],
  ["product_artifact", /\bprd\b|roadmap|backlog|user stor|prioriti[sz]|product requirement|ürün gereksin|önceliklendir/],
  ["analytics_artifact", /\bsql\b|dashboard|tableau|power bi|data model|forecast|variance|analiz|raporlama/],
  ["business_case", /business case|case study|market sizing|strategy case|iş vakası|vaka çalış|pazar analiz/],
  ["technical_project", /\bapi\b|backend|frontend|full stack|react|node|python|java|typescript|cloud|ci\/cd|software|yazılım/],
  ["research", /research|thesis|publication|survey|literature|araştırma|tez|yayın/],
  ["github", /github|repository|open source|repo\b|açık kaynak/],
  ["hackathon", /hackathon/],
  ["presentation", /presented|presentation|pitch|sunum|sundu/],
  ["internship", /intern|internship|staj/],
  ["leadership_outcome", /led a team|managed a team|team of \d+|project lead|ekip yön|takım lider|liderli/],
  ["startup_experience", /startup|early-stage|venture|girişim/],
  ["club_participation", /club member|society member|student club|kulüp üye|topluluk üye/],
  ["certification", /certificate|certification|certified|sertifika/],
  ["title_claim", /founder|co-?founder|head of|director|manager|lead\b|kurucu|direktör|müdür/],
];

function buildSignal(id, sourceIds) {
  const hypotheses = {
    founder: "Candidate may have ownership and ambiguity tolerance.",
    product: "Candidate may have product judgment and prioritization exposure.",
    internship: "Candidate may have real workplace exposure.",
    hackathon: "Candidate may execute under time pressure.",
    leadership: "Candidate may coordinate people or decisions.",
    github: "Candidate may have inspectable technical work.",
    ai_project: "Candidate may have applied AI exposure.",
    presentation: "Candidate may communicate decisions clearly.",
    networking: "Candidate may have market-facing relationship depth.",
    analytics: "Candidate may turn data into decisions.",
    customer: "Candidate may understand customer problems.",
    execution: "Candidate may turn plans into delivered work.",
  };
  return { id, hypothesis: hypotheses[id], sources: [...sourceIds] };
}

export function detectSignals({ profile = {}, cvText = "" } = {}) {
  const basic = profile.basic_profile || profile.basic || {};
  const goals = profile.career_goals || profile.goals || {};
  const readiness = profile.career_readiness?.benchmarks || profile.career_readiness?.readinessAnswers || {};
  const sourceText = {
    cv_text: cvText || profile.cvText || profile.cv_text || "",
    basic_profile: [
      basic.currentStatus,
      basic.experienceLevel,
      basic.leadershipRole,
      ...asArray(basic.experienceSignals),
      ...asArray(basic.leadershipSignals),
      ...asArray(basic.projects).map(textOf),
      ...asArray(basic.experiences).map(textOf),
      ...asArray(profile.skills),
    ].filter(Boolean).join(" "),
    career_goals: [goals.primaryRole, ...asArray(goals.targetRoles), ...asArray(goals.industries)].filter(Boolean).join(" "),
    readiness: Object.values(readiness).filter(Boolean).join(" "),
  };
  const found = new Map();
  for (const [sourceId, text] of Object.entries(sourceText)) {
    const normalized = norm(text);
    for (const [signalId, pattern] of SIGNAL_PATTERNS) {
      if (!pattern.test(normalized)) continue;
      if (!found.has(signalId)) found.set(signalId, new Set());
      found.get(signalId).add(sourceId);
    }
  }
  return [...found.entries()].map(([id, sourceIds]) => buildSignal(id, sourceIds));
}

function createCollector(config) {
  const records = [];
  const seen = new Set();
  return {
    add(type, claim, source, options = {}) {
      const definition = config.evidenceTypes[type];
      const cleanClaim = String(claim || "").replace(/\s+/g, " ").trim().slice(0, 260);
      if (!definition || !cleanClaim) return;
      const fingerprint = norm(cleanClaim);
      const duplicateKey = `${type}|${source.id}|${fingerprint}`;
      if (seen.has(duplicateKey)) return;
      seen.add(duplicateKey);
      records.push({
        id: `ev_${hash(duplicateKey)}`,
        type,
        claim: cleanClaim,
        dimensions: options.dimensions || definition.dimensions,
        tier: options.tier || definition.tier,
        specificity: options.specificity || specificityFor(cleanClaim),
        verification: options.verification || source.verification || "self_reported",
        source: {
          id: source.id,
          kind: source.kind,
          independentGroup: source.independentGroup || source.id,
        },
        occurredYear: options.occurredYear || yearFrom(cleanClaim),
        fingerprint,
        metadata: options.metadata || {},
      });
    },
    records,
  };
}

function classifyText(collector, text, source) {
  for (const line of splitEvidenceText(text)) {
    const normalized = norm(line);
    for (const [type, pattern] of EVIDENCE_PATTERNS) {
      if (pattern.test(normalized)) collector.add(type, line, source);
    }
  }
}

function addReadinessEvidence(collector, profile) {
  const readiness = profile.career_readiness?.benchmarks || profile.career_readiness?.readinessAnswers || {};
  const source = { id: "readiness", kind: "career_dna", independentGroup: "self_report", verification: "self_reported" };
  const project = norm(readiness.projects);
  if (/production|launched|live/.test(project)) collector.add("shipped_product", `Project level: ${readiness.projects}`, source, { specificity: "specific" });
  else if (/portfolio|personal/.test(project)) collector.add("portfolio_project", `Project level: ${readiness.projects}`, source);
  else if (/hackathon/.test(project)) collector.add("hackathon", `Project level: ${readiness.projects}`, source);

  const experience = norm(readiness.experience);
  if (/intern/.test(experience)) collector.add("internship", `Experience level: ${readiness.experience}`, source);
  else if (/full|professional|work/.test(experience)) collector.add("internship", `Professional experience level: ${readiness.experience}`, source, { tier: "high" });

  const leadership = norm(readiness.leadership);
  if (/founder|cofounder/.test(leadership)) collector.add("title_claim", `Leadership selection: ${readiness.leadership}`, source);
  else if (/lead|president|manager/.test(leadership)) collector.add("self_assessment", `Leadership selection: ${readiness.leadership}`, source, { dimensions: ["leadership", "collaboration"] });
}

function addTraitEvidence(collector, profile, lang) {
  const dna = profile.career_dna || {};
  const answers = dna.answers || {};
  const raw = dna.traitScores || dna.scores || scoreCareerDnaAnswers(answers, lang);
  const traits = normalizeTraitScoresTo100(raw);
  const mapping = {
    leadership: ["leadership"],
    communication: ["communication"],
    analytical_thinking: ["analytics", "strategic_thinking"],
    creativity: ["innovation"],
    execution: ["execution"],
    collaboration: ["collaboration"],
    ambiguity_tolerance: ["startup_exposure", "strategic_thinking"],
    risk_taking: ["startup_exposure"],
  };
  Object.entries(traits)
    .filter(([, value]) => Number(value) >= 65)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([trait]) => {
      collector.add(
        "self_assessment",
        `Career DNA self-assessment: ${trait}`,
        { id: "career_dna", kind: "career_dna", independentGroup: "self_report", verification: "self_reported" },
        { dimensions: mapping[trait] || ["communication"], specificity: "generic" }
      );
    });
}

function addGoalEvidence(collector, profile) {
  const goals = profile.career_goals || profile.goals || {};
  const roles = [goals.primaryRole, goals.secondaryRole, goals.tertiaryRole, ...asArray(goals.targetRoles)].filter(Boolean);
  for (const role of [...new Set(roles)].slice(0, 4)) {
    collector.add(
      "target_role",
      `Target role: ${role}`,
      { id: "career_goals", kind: "career_dna", independentGroup: "self_report", verification: "self_reported" },
      { specificity: "generic" }
    );
  }
}

function addStructuredEvidence(collector, profile) {
  const basic = profile.basic_profile || profile.basic || {};
  const source = { id: "basic_profile", kind: "profile", independentGroup: "self_report", verification: "self_reported" };
  const structured = [
    ...asArray(basic.projects),
    ...asArray(basic.experiences),
    ...asArray(profile.projects),
    ...asArray(profile.experiences),
    ...asArray(profile.achievements),
    ...asArray(profile.strong_signals),
  ].map(textOf).filter(Boolean);
  classifyText(collector, structured.join("\n"), source);

  const titleText = [basic.currentStatus, basic.experienceLevel, basic.leadershipRole, profile.career_identity].filter(Boolean).join(" ");
  if (titleText) classifyText(collector, titleText, source);
  if (basic.department || basic.degree) {
    collector.add("education", [basic.department, basic.degree, basic.university].filter(Boolean).join(" - "), source);
  }

  const links = [
    ["github", basic.githubUrl || basic.github || profile.githubUrl],
    ["portfolio", basic.portfolioUrl || basic.portfolio || profile.portfolioUrl],
    ["linkedin", basic.linkedinUrl || basic.linkedin || profile.linkedinUrl],
    ["website", basic.websiteUrl || basic.website || profile.websiteUrl],
  ];
  for (const [kind, url] of links) {
    if (!url) continue;
    const linkSource = { id: `${kind}_link`, kind, independentGroup: `${kind}_link`, verification: "provided" };
    if (kind === "github") collector.add("github", "GitHub link provided", linkSource, { specificity: "specific" });
    else collector.add("external_link", `${kind} link provided`, linkSource, { specificity: "specific" });
  }
}

export function extractEvidence({ profile = {}, cvText = "", config, lang = "TR" } = {}) {
  const collector = createCollector(config || createEvidenceConfig());
  const resumeText = cvText || profile.cvText || profile.cv_text || "";
  if (resumeText.trim()) {
    classifyText(collector, resumeText, {
      id: "cv_text",
      kind: "resume",
      independentGroup: "resume",
      verification: "provided",
    });
  }
  addStructuredEvidence(collector, profile);
  addReadinessEvidence(collector, profile);
  addTraitEvidence(collector, profile, lang);
  addGoalEvidence(collector, profile);
  const signalDimensions = {
    founder: ["ownership", "startup_exposure"],
    product: ["ownership", "customer_exposure"],
    internship: ["execution"],
    hackathon: ["innovation", "execution"],
    leadership: ["leadership", "collaboration"],
    github: ["technical_depth"],
    ai_project: ["technical_depth", "innovation"],
    presentation: ["communication"],
    networking: ["networking"],
    analytics: ["analytics"],
    customer: ["customer_exposure"],
    execution: ["execution"],
  };
  for (const signal of detectSignals({ profile, cvText })) {
    collector.add(
      "signal_observation",
      `Observed signal: ${signal.id}`,
      {
        id: signal.sources[0] || "profile",
        kind: "signal",
        independentGroup: "signal_observation",
        verification: "inferred",
      },
      { dimensions: signalDimensions[signal.id] || ["communication"], specificity: "generic" }
    );
  }
  return collector.records;
}

export { norm as normalizeEvidenceText };
