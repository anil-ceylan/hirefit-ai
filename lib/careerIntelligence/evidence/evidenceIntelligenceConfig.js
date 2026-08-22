export const DEFAULT_CLASSIFICATION_STRATEGY = Object.freeze({
  categories: {
    experience: [/experience|worked|intern|role|company|staj|deneyim/i],
    project: [/project|built|created|launched|case|portfolio|proje|vaka/i],
    artifact: [/portfolio|github|repo|demo|case study|dashboard|document|link/i],
    credential: [/certificate|certification|course|degree|university|sertifika|diploma/i],
    claim: [/interested|strong|skilled|passionate|hedef|ilgilen|güçlü|guclu/i],
    outcome: [/increased|reduced|saved|grew|improved|impact|result|users?|customers?|%|sonuç|sonuc|etki/i],
  },
  competencies: {
    ownership: [/owned|owner|founder|responsible|end-to-end|sahip|kurucu/i],
    execution: [/built|delivered|launched|shipped|operated|implemented|workflow|process|canlı|canli/i],
    leadership: [/leadership|led|managed|team|mentor|lider|yönet|yonet/i],
    stakeholder_influence: [/stakeholder|cross-functional|client|customer|paydaş|paydas/i],
    communication: [/presentation|story|stakeholder|client|customer|communication|paydaş|paydas|iletişim|iletisim/i],
    analytical_reasoning: [/analysis|analytics|sql|dashboard|metric|forecast|model|veri|analiz/i],
    strategic_reasoning: [/strategy|market|priorit|business case|decision|tradeoff|strateji|karar|öncelik/i],
    product_thinking: [/product|user|roadmap|prd|backlog|feedback|onboarding|ürün|urun/i],
    technical_execution: [/software|code|api|github|developer|engineering|automation|yazılım|yazilim/i],
  },
});

export const DEFAULT_STRENGTH_STRATEGY = Object.freeze({
  weights: {
    ownership: 0.2,
    duration: 0.12,
    measurableImpact: 0.2,
    complexity: 0.16,
    scope: 0.14,
    externalValidation: 0.18,
  },
});

export const DEFAULT_FRESHNESS_STRATEGY = Object.freeze({
  currentYearBonus: 8,
  unknownFreshnessScore: 54,
  halfLifeYears: 4,
  floor: 28,
});

export const DEFAULT_TRUST_STRATEGY = Object.freeze({
  weights: {
    source: 0.22,
    measurable: 0.22,
    specificity: 0.18,
    outcome: 0.16,
    roleSpecificity: 0.12,
    externalValidation: 0.1,
  },
  sourceTrust: {
    unknown: 24,
    user_statement: 30,
    career_dna: 38,
    career_snapshot: 46,
    imported: 52,
    cv: 62,
    linkedin: 68,
    portfolio: 78,
    github: 82,
  },
});

export const DEFAULT_QUALITY_STRATEGY = Object.freeze({
  weights: {
    strength: 0.2,
    trust: 0.2,
    freshness: 0.12,
    specificity: 0.14,
    impact: 0.16,
    confidence: 0.18,
  },
});

export const DEFAULT_OPPORTUNITY_IMPACT_STRATEGY = Object.freeze({
  weights: {
    gapSeverity: 0.28,
    recruiterTrustGain: 0.24,
    roleFitGain: 0.2,
    readinessGain: 0.16,
    effortInverse: 0.12,
  },
});
