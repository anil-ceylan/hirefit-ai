/**
 * Core evidence configuration.
 * Named tiers are the stable contract. Numeric calibration stays internal and
 * can be replaced per role, company, or market without changing engine code.
 */

export const EVIDENCE_TIERS = Object.freeze({
  VERY_LOW: "very_low",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  VERY_HIGH: "very_high",
});

const EVIDENCE_TYPES = {
  quantified_outcome: { tier: "very_high", labelEn: "Quantified impact", labelTr: "Ölçülebilir etki", dimensions: ["execution", "business_acumen", "project_complexity"] },
  shipped_product: { tier: "very_high", labelEn: "Shipped product", labelTr: "Canlıya alınmış ürün", dimensions: ["ownership", "execution", "project_complexity", "innovation"] },
  revenue_outcome: { tier: "very_high", labelEn: "Revenue outcome", labelTr: "Gelir etkisi", dimensions: ["business_acumen", "execution", "customer_exposure"] },
  customer_validation: { tier: "very_high", labelEn: "Customer validation", labelTr: "Müşteri doğrulaması", dimensions: ["customer_exposure", "communication", "business_acumen"] },
  cross_functional_delivery: { tier: "very_high", labelEn: "Cross-functional delivery", labelTr: "Fonksiyonlar arası teslimat", dimensions: ["collaboration", "leadership", "execution"] },
  repeatable_system: { tier: "very_high", labelEn: "Repeatable system", labelTr: "Tekrarlanabilir sistem", dimensions: ["execution", "project_complexity", "ownership"] },
  product_artifact: { tier: "high", labelEn: "Product decision artifact", labelTr: "Ürün kararı çıktısı", dimensions: ["ownership", "customer_exposure", "strategic_thinking"] },
  analytics_artifact: { tier: "high", labelEn: "Analytics artifact", labelTr: "Analiz çıktısı", dimensions: ["analytics", "technical_depth", "business_acumen"] },
  business_case: { tier: "high", labelEn: "Business case", labelTr: "İş vakası", dimensions: ["strategic_thinking", "analytics", "business_acumen"] },
  leadership_outcome: { tier: "high", labelEn: "Leadership outcome", labelTr: "Liderlik sonucu", dimensions: ["leadership", "ownership", "collaboration"] },
  internship: { tier: "high", labelEn: "Relevant internship", labelTr: "İlgili staj", dimensions: ["execution", "collaboration", "business_acumen"] },
  startup_experience: { tier: "high", labelEn: "Startup execution", labelTr: "Startup uygulama deneyimi", dimensions: ["startup_exposure", "ownership", "execution"] },
  portfolio_project: { tier: "high", labelEn: "Portfolio project", labelTr: "Portföy projesi", dimensions: ["project_complexity", "execution", "ownership"] },
  technical_project: { tier: "high", labelEn: "Technical project", labelTr: "Teknik proje", dimensions: ["technical_depth", "execution", "project_complexity"] },
  research: { tier: "medium", labelEn: "Research work", labelTr: "Araştırma çalışması", dimensions: ["research_orientation", "analytics", "strategic_thinking"] },
  github: { tier: "medium", labelEn: "Inspectable GitHub work", labelTr: "İncelenebilir GitHub çalışması", dimensions: ["technical_depth", "execution"] },
  hackathon: { tier: "medium", labelEn: "Hackathon proof", labelTr: "Hackathon kanıtı", dimensions: ["innovation", "execution", "collaboration"] },
  presentation: { tier: "medium", labelEn: "Presentation proof", labelTr: "Sunum kanıtı", dimensions: ["communication", "strategic_thinking"] },
  external_link: { tier: "low", labelEn: "Provided external link", labelTr: "Paylaşılan dış bağlantı", dimensions: ["communication"] },
  education: { tier: "low", labelEn: "Education background", labelTr: "Eğitim geçmişi", dimensions: ["research_orientation"] },
  certification: { tier: "low", labelEn: "Certification", labelTr: "Sertifika", dimensions: ["technical_depth", "research_orientation"] },
  club_participation: { tier: "low", labelEn: "Club participation", labelTr: "Kulüp katılımı", dimensions: ["collaboration", "networking"] },
  title_claim: { tier: "very_low", labelEn: "Title claim", labelTr: "Unvan beyanı", dimensions: ["leadership"] },
  target_role: { tier: "very_low", labelEn: "Target-role preference", labelTr: "Hedef rol tercihi", dimensions: ["strategic_thinking"] },
  self_assessment: { tier: "very_low", labelEn: "Self-assessment", labelTr: "Öz değerlendirme", dimensions: ["communication"] },
  signal_observation: { tier: "very_low", labelEn: "Unvalidated signal", labelTr: "Doğrulanmamış sinyal", dimensions: ["communication"] },
};

const ROLE_CONTEXT = {
  PRODUCT: {
    core: ["shipped_product", "customer_validation", "product_artifact", "quantified_outcome", "cross_functional_delivery"],
    supporting: ["startup_experience", "portfolio_project", "analytics_artifact", "leadership_outcome"],
  },
  OPERATIONS: {
    core: ["repeatable_system", "cross_functional_delivery", "quantified_outcome", "leadership_outcome"],
    supporting: ["internship", "startup_experience", "analytics_artifact", "portfolio_project"],
  },
  BUSINESS: {
    core: ["business_case", "analytics_artifact", "quantified_outcome", "cross_functional_delivery"],
    supporting: ["research", "presentation", "internship", "leadership_outcome"],
  },
  DATA: {
    core: ["analytics_artifact", "quantified_outcome", "technical_project", "github"],
    supporting: ["research", "portfolio_project", "business_case"],
  },
  SOFTWARE: {
    core: ["technical_project", "github", "shipped_product", "repeatable_system"],
    supporting: ["portfolio_project", "quantified_outcome", "cross_functional_delivery"],
  },
  MARKETING: {
    core: ["customer_validation", "revenue_outcome", "quantified_outcome", "analytics_artifact"],
    supporting: ["portfolio_project", "presentation", "startup_experience"],
  },
  HR: {
    core: ["cross_functional_delivery", "leadership_outcome", "quantified_outcome", "repeatable_system"],
    supporting: ["presentation", "internship", "customer_validation"],
  },
  FINANCE: {
    core: ["analytics_artifact", "business_case", "quantified_outcome", "repeatable_system"],
    supporting: ["research", "internship", "presentation"],
  },
};

const ROLE_REQUIREMENTS = {
  PRODUCT: [
    { id: "product_execution", titleEn: "Product execution proof", titleTr: "Ürün uygulama kanıtı", types: ["shipped_product", "portfolio_project"], dimensions: ["ownership", "execution"], impact: "very_high", effort: "medium", actionEn: "Publish one product case showing the problem, decision, release, and result.", actionTr: "Problem, karar, yayın ve sonucu gösteren tek bir ürün vakası yayınla." },
    { id: "customer_discovery", titleEn: "Customer discovery proof", titleTr: "Kullanıcı araştırması kanıtı", types: ["customer_validation"], dimensions: ["customer_exposure"], impact: "high", effort: "low", actionEn: "Document five user conversations and the product decision they changed.", actionTr: "Beş kullanıcı görüşmesini ve değiştirdiği ürün kararını belgele." },
    { id: "product_metrics", titleEn: "Product metrics proof", titleTr: "Ürün metriği kanıtı", types: ["quantified_outcome", "analytics_artifact"], dimensions: ["analytics"], impact: "very_high", effort: "low", actionEn: "Add one product metric with a baseline, action, and measured outcome.", actionTr: "Başlangıç değeri, aksiyon ve sonucu olan tek bir ürün metriği ekle." },
  ],
  OPERATIONS: [
    { id: "process_ownership", titleEn: "Process ownership proof", titleTr: "Süreç sahipliği kanıtı", types: ["repeatable_system", "cross_functional_delivery"], dimensions: ["execution", "ownership"], impact: "very_high", effort: "medium", actionEn: "Show one workflow you owned with before-and-after time, error, or capacity.", actionTr: "Sahiplendiğin tek bir iş akışını süre, hata veya kapasite öncesi/sonrasıyla göster." },
    { id: "operational_impact", titleEn: "Operational impact proof", titleTr: "Operasyonel etki kanıtı", types: ["quantified_outcome"], dimensions: ["execution"], impact: "high", effort: "low", actionEn: "Add one measurable delivery, cycle-time, quality, or capacity result.", actionTr: "Tek bir ölçülebilir teslimat, çevrim süresi, kalite veya kapasite sonucu ekle." },
  ],
  BUSINESS: [
    { id: "decision_case", titleEn: "Business decision proof", titleTr: "İş kararı kanıtı", types: ["business_case", "analytics_artifact"], dimensions: ["strategic_thinking", "analytics"], impact: "very_high", effort: "medium", actionEn: "Publish one business case linking analysis to a clear decision and outcome.", actionTr: "Analizi net bir karar ve sonuca bağlayan tek bir iş vakası yayınla." },
    { id: "stakeholder_scope", titleEn: "Stakeholder scope proof", titleTr: "Paydaş etkisi", types: ["cross_functional_delivery", "presentation"], dimensions: ["collaboration", "communication"], impact: "high", effort: "low", actionEn: "Add one example showing the stakeholders, trade-off, and decision you drove.", actionTr: "Bir ürün/strateji kararını problem → seçenekler → karar → sonuç formatında tek örnekle kanıtla." },
  ],
  DATA: [
    { id: "analytics_output", titleEn: "Analytics portfolio proof", titleTr: "Analiz portföyü kanıtı", types: ["analytics_artifact", "technical_project"], dimensions: ["analytics", "technical_depth"], impact: "very_high", effort: "medium", actionEn: "Publish one SQL or dashboard case that ends with a business decision.", actionTr: "Bir iş kararıyla biten tek bir SQL veya dashboard vakası yayınla." },
    { id: "measured_insight", titleEn: "Measured insight proof", titleTr: "Ölçülebilir içgörü kanıtı", types: ["quantified_outcome"], dimensions: ["analytics"], impact: "high", effort: "low", actionEn: "Add the metric changed by one analysis you completed.", actionTr: "Tamamladığın tek bir analizin değiştirdiği metriği ekle." },
  ],
  SOFTWARE: [
    { id: "shipped_code", titleEn: "Shipped code proof", titleTr: "Canlı kod kanıtı", types: ["shipped_product", "technical_project", "github"], dimensions: ["technical_depth", "execution"], impact: "very_high", effort: "medium", actionEn: "Deploy one project and document the architecture and trade-offs in its README.", actionTr: "Tek bir projeyi canlıya al; mimariyi ve önceliklendirme kararlarını README'de belge." },
    { id: "reliability", titleEn: "Reliability proof", titleTr: "Güvenilirlik kanıtı", types: ["repeatable_system", "quantified_outcome"], dimensions: ["project_complexity"], impact: "high", effort: "medium", actionEn: "Add one test, performance, reliability, or production-use result.", actionTr: "Tek bir test, performans, güvenilirlik veya production kullanım sonucu ekle." },
  ],
  MARKETING: [
    { id: "growth_experiment", titleEn: "Growth experiment proof", titleTr: "Büyüme deneyi kanıtı", types: ["customer_validation", "quantified_outcome", "revenue_outcome"], dimensions: ["customer_exposure", "analytics"], impact: "very_high", effort: "medium", actionEn: "Document one channel experiment with hypothesis, audience, metric, and result.", actionTr: "Hipotez, hedef kitle, metrik ve sonucu olan tek bir kanal deneyini belgele." },
  ],
  HR: [
    { id: "people_process", titleEn: "People-process proof", titleTr: "İnsan süreci kanıtı", types: ["repeatable_system", "cross_functional_delivery"], dimensions: ["collaboration", "leadership"], impact: "very_high", effort: "medium", actionEn: "Create one recruiting or onboarding case with process, scorecard, and outcome.", actionTr: "Süreç, scorecard ve sonucu olan tek bir işe alım veya onboarding vakası oluştur." },
  ],
  FINANCE: [
    { id: "financial_decision", titleEn: "Financial decision proof", titleTr: "Finansal karar kanıtı", types: ["analytics_artifact", "business_case", "quantified_outcome"], dimensions: ["analytics", "business_acumen"], impact: "very_high", effort: "medium", actionEn: "Build one model with assumptions, scenarios, and the decision it supports.", actionTr: "Varsayımlar, senaryolar ve desteklediği kararı içeren tek bir model oluştur." },
  ],
};

export const DEFAULT_EVIDENCE_CONFIG = Object.freeze({
  version: "core-evidence-v2",
  tierScale: { very_low: 0.16, low: 0.3, medium: 0.5, high: 0.72, very_high: 0.9 },
  specificityScale: { generic: 0.72, specific: 0.9, quantified: 1 },
  verificationScale: { inferred: 0.72, self_reported: 0.8, provided: 0.88, verified: 1 },
  contextScale: { peripheral: 0.68, neutral: 0.86, supporting: 1, core: 1.14 },
  recency: { current: 1, recent: 0.95, established: 0.87, old: 0.78, highImpactFloor: 0.88 },
  confidenceFactors: { quality: 0.3, consistency: 0.18, depth: 0.18, connectivity: 0.14, verification: 0.2 },
  conflictPenalty: { low: 4, medium: 9, high: 16 },
  conflictPenaltyCap: 28,
  opportunityScale: { impact: { low: 1, medium: 2, high: 3, very_high: 4 }, effort: { low: 1, medium: 2, high: 3 } },
  calibration: {
    requirementSupport: 0.44,
    dimensionContribution: 0.72,
    duplicateContribution: 0.18,
    confidenceBands: { high: 68, medium: 43 },
    evidenceQualityMix: { records: 0.64, requirements: 0.36 },
  },
  evidenceTypes: EVIDENCE_TYPES,
  roleContext: ROLE_CONTEXT,
  roleRequirements: ROLE_REQUIREMENTS,
  graphChains: [
    ["title_claim", "portfolio_project"], ["title_claim", "shipped_product"],
    ["portfolio_project", "shipped_product"], ["shipped_product", "customer_validation"],
    ["customer_validation", "quantified_outcome"], ["shipped_product", "quantified_outcome"],
    ["leadership_outcome", "cross_functional_delivery"], ["cross_functional_delivery", "quantified_outcome"],
    ["analytics_artifact", "business_case"], ["analytics_artifact", "quantified_outcome"],
    ["technical_project", "github"], ["technical_project", "shipped_product"],
    ["repeatable_system", "quantified_outcome"], ["startup_experience", "shipped_product"],
  ],
});

function mergeConfig(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeConfig(base?.[key] || {}, value)
      : value;
  }
  return out;
}

export function createEvidenceConfig(overrides = {}) {
  return mergeConfig(DEFAULT_EVIDENCE_CONFIG, overrides);
}
