/**
 * Role-specific evidence explanations — uses normalized evidence, not generic comm/leadership.
 */

const SIGNAL_LABELS_EN = {
  ownership: "ownership",
  leadership: "leadership",
  execution: "execution",
  analytics: "analytics",
  communication: "communication",
  technical_depth: "technical depth",
  business_acumen: "business acumen",
  startup_exposure: "startup exposure",
  customer_exposure: "customer focus",
  project_complexity: "complex delivery",
  innovation: "innovation",
  collaboration: "collaboration",
  strategic_thinking: "strategic thinking",
  research_orientation: "research orientation",
  networking: "networking",
};

const SIGNAL_LABELS_TR = {
  ownership: "sahiplenme",
  leadership: "liderlik",
  execution: "uygulama",
  analytics: "analitik",
  communication: "iletişim",
  technical_depth: "teknik derinlik",
  business_acumen: "iş zekâsı",
  startup_exposure: "startup deneyimi",
  customer_exposure: "müşteri odaklılık",
  project_complexity: "karmaşık teslimat",
  innovation: "inovasyon",
  collaboration: "iş birliği",
  strategic_thinking: "stratejik düşünme",
  research_orientation: "araştırma",
  networking: "network",
};

const ROLE_EVIDENCE_PRIORITY = {
  PRODUCT: ["ownership", "execution", "customer_exposure", "business_acumen", "innovation", "strategic_thinking"],
  OPERATIONS: ["execution", "project_complexity", "ownership", "collaboration", "strategic_thinking"],
  BUSINESS: ["strategic_thinking", "business_acumen", "analytics", "communication", "ownership"],
  DATA: ["analytics", "research_orientation", "technical_depth", "execution", "communication"],
  SOFTWARE: ["technical_depth", "execution", "project_complexity", "ownership", "innovation"],
  MARKETING: ["customer_exposure", "innovation", "analytics", "execution", "communication"],
  HR: ["communication", "collaboration", "leadership", "networking", "customer_exposure"],
  FINANCE: ["analytics", "business_acumen", "research_orientation", "execution", "communication"],
};

const ROLE_FIT_TEMPLATES_EN = {
  PRODUCT: (signals, role) =>
    `${signals} align strongly with ${role} responsibilities around ownership, prioritization, and shipped product decisions.`,
  OPERATIONS: (signals, role) =>
    `${signals} support ${role} through delivery discipline, workflow ownership, and repeatable execution.`,
  BUSINESS: (signals, role) =>
    `${signals} fit ${role} when framed as structured decisions, market logic, and stakeholder judgment.`,
  DATA: (signals, role) =>
    `${signals} transfer to ${role} through analytical proof, insight generation, and evidence-based decisions.`,
  SOFTWARE: (signals, role) =>
    `${signals} strengthen ${role} fit through technical depth, shipped outputs, and hands-on problem solving.`,
  MARKETING: (signals, role) =>
    `${signals} connect to ${role} via growth experiments, market-facing work, and measurable outcomes.`,
  HR: (signals, role) =>
    `${signals} fit ${role} when backed by people-process ownership, candidate communication, and hiring outcomes.`,
  FINANCE: (signals, role) =>
    `${signals} align with ${role} through modeling rigor, financial judgment, and decision impact.`,
};

const ROLE_FIT_TEMPLATES_TR = {
  PRODUCT: (signals, role) =>
    `${signals}, ${role} sorumluluklarıyla (sahiplenme, önceliklendirme, ürün kararları) güçlü biçimde örtüşüyor.`,
  OPERATIONS: (signals, role) =>
    `${signals}, ${role} için teslimat disiplini, süreç sahipliği ve tekrarlanabilir uygulama sinyalleri veriyor.`,
  BUSINESS: (signals, role) =>
    `${signals}, ${role} yolunda yapılandırılmış karar, pazar mantığı ve paydaş yargısı olarak okunuyor.`,
  DATA: (signals, role) =>
    `${signals}, ${role} için analitik kanıt, içgörü üretimi ve kanıta dayalı karar sinyalleri taşıyor.`,
  SOFTWARE: (signals, role) =>
    `${signals}, ${role} uyumunu teknik derinlik, çıktı üretme ve pratik problem çözme ile güçlendiriyor.`,
  MARKETING: (signals, role) =>
    `${signals}, ${role} ile büyüme denemeleri, pazar yüzü ve ölçülebilir sonuçlar üzerinden bağlanıyor.`,
  HR: (signals, role) =>
    `${signals}, ${role} için insan süreçleri sahipliği, aday iletişimi ve işe alım sonuçlarıyla destekleniyor.`,
  FINANCE: (signals, role) =>
    `${signals}, ${role} ile modelleme titizliği, finansal yargı ve karar etkisi üzerinden hizalanıyor.`,
};

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function topRoleEvidenceSignals(evidence = {}, family = "BUSINESS", n = 3) {
  const priority = ROLE_EVIDENCE_PRIORITY[family] || ROLE_EVIDENCE_PRIORITY.BUSINESS;
  return priority
    .map((key) => ({ key, score: Number(evidence[key] || 0) }))
    .filter((row) => row.score >= 52)
    .sort((a, b) => {
      const ai = priority.indexOf(a.key);
      const bi = priority.indexOf(b.key);
      return b.score + (bi >= 0 ? (priority.length - bi) * 0.5 : 0) - (a.score + (ai >= 0 ? (priority.length - ai) * 0.5 : 0));
    })
    .slice(0, n);
}

export function buildRoleMatchExplanation({ roleName, family, evidence = {}, lang = "EN" }) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const labels = tr ? SIGNAL_LABELS_TR : SIGNAL_LABELS_EN;
  const templates = tr ? ROLE_FIT_TEMPLATES_TR : ROLE_FIT_TEMPLATES_EN;
  const top = topRoleEvidenceSignals(evidence, family, 3);
  const signalText = top.length
    ? capitalize(top.map((row) => labels[row.key] || row.key).join(tr ? ", " : ", "))
    : tr
      ? "Hedef rol odağın ve mevcut kanıtların"
      : "Your role focus and current evidence";

  const template = templates[family] || templates.BUSINESS;
  return template(signalText, roleName || family);
}

export { ROLE_EVIDENCE_PRIORITY, SIGNAL_LABELS_EN, SIGNAL_LABELS_TR };
