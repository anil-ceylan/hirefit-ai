export const CALIBRATION_STATUS = Object.freeze({
  OBSERVED: "observed",
  EXPECTED: "expected",
  DERIVED: "derived",
  NOT_MEASURABLE: "not_measurable",
});

export const DEFAULT_CALIBRATION_CONFIG = Object.freeze({
  confidenceCaps: {
    singleEvidenceConfidenceCap: 84,
    missingCriticalEvidenceCap: 68,
    highConflictConfidenceCap: 62,
    lowTrustConfidenceCap: 58,
    lowCoverageConfidenceCap: 64,
  },
  conflictPenalties: {
    high: 18,
    medium: 10,
    low: 5,
  },
  rankingTolerance: 8,
  stabilityThresholds: {
    topRecommendationMustRemain: true,
    maxRankScoreDelta: 10,
    maxDecisionConfidenceDelta: 12,
  },
  traceCompletenessThreshold: 0.9,
  criticalCompetencyRules: {
    Product: ["ownership", "execution", "product_thinking"],
    "Product Management": ["ownership", "execution", "product_thinking"],
    "Strategy & Operations": ["execution", "strategic_reasoning", "stakeholder_influence"],
    Strategy: ["strategic_reasoning", "analytical_reasoning"],
    Analytics: ["analytical_reasoning"],
    "Business Analyst": ["analytical_reasoning", "strategic_reasoning"],
    Operations: ["execution", "stakeholder_influence"],
  },
  unsupportedInferenceThreshold: 72,
  duplicateSimilarityThreshold: 0.78,
  minimumEvidenceSupport: 1,
  acceptableRoleOverlap: 0.5,
  severityMapping: {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
  },
});

export function mergeCalibrationConfig(overrides = {}) {
  return {
    ...DEFAULT_CALIBRATION_CONFIG,
    ...overrides,
    confidenceCaps: {
      ...DEFAULT_CALIBRATION_CONFIG.confidenceCaps,
      ...(overrides.confidenceCaps || {}),
    },
    conflictPenalties: {
      ...DEFAULT_CALIBRATION_CONFIG.conflictPenalties,
      ...(overrides.conflictPenalties || {}),
    },
    stabilityThresholds: {
      ...DEFAULT_CALIBRATION_CONFIG.stabilityThresholds,
      ...(overrides.stabilityThresholds || {}),
    },
    criticalCompetencyRules: {
      ...DEFAULT_CALIBRATION_CONFIG.criticalCompetencyRules,
      ...(overrides.criticalCompetencyRules || {}),
    },
  };
}
