import {
  toReasoningReportContract,
  validateActivationDecisionContract,
  validateReasoningReportContract,
} from "../contracts/index.js";
import { evaluateActivationPolicy, evaluatePromotionGates, resolveObservatoryFeatureFlags } from "../activation/index.js";
import { runShadowReasoning } from "../calibration/index.js";
import { evaluateRankingStability } from "../calibration/rankingStability.js";
import { analyzeDecisionDrift } from "./driftAnalyzer.js";
import { buildShadowSummary } from "./buildShadowSummary.js";
import { createInMemoryShadowLogStore } from "./inMemoryShadowLogStore.js";
import { serializeInspectorReport } from "./inspector/serializeInspectorReport.js";
import { stableHash } from "./utils.js";

export function observeDecisionRun({
  profile = {},
  productionSnapshot = null,
  historicalSnapshots = [],
  featureFlags = {},
  config = {},
  logStore = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const flags = resolveObservatoryFeatureFlags(featureFlags);
  const runId = `run_${stableHash({ profileId: profile.user_id || profile.userId || profile.id || profile.profile_id, productionSnapshot, generatedAt: config.deterministic ? null : generatedAt })}`;
  const warnings = [];

  if (!flags.ENABLE_SHADOW_REASONING) {
    const activation = evaluateActivationPolicy({ featureFlags: flags, profile });
    return {
      runId,
      activation,
      contracts: { activation: validateActivationDecisionContract(activation) },
      shadowResult: null,
      drift: { items: [], typeCodes: [], severity: "none", requiresReview: false },
      promotionGates: { eligible: false, gates: [], blockers: ["Shadow reasoning disabled."], nextState: "disabled", productionInfluenceAllowed: false },
      shadowSummary: null,
      stored: false,
      warnings: ["Shadow reasoning disabled."],
    };
  }

  try {
    const shadowResult = runShadowReasoning({
      profile,
      productionSnapshot,
      historicalSnapshots,
      config: config.calibration || {},
    });
    const reasoningReport = toReasoningReportContract({
      shadowResult,
      anonymizedProfileId: null,
      generatedAt,
      configVersion: "calibration.v1",
    });
    const contracts = {
      reasoningReport: validateReasoningReportContract(reasoningReport),
    };
    let activation = evaluateActivationPolicy({ featureFlags: flags, profile, shadowResult, contracts });
    contracts.activation = validateActivationDecisionContract(activation);
    const drift = flags.ENABLE_DRIFT_ANALYSIS
      ? analyzeDecisionDrift({
          productionSnapshot: productionSnapshot || profile.career_snapshot || profile.career_gps?.snapshot || {},
          shadowResult,
          productionComparison: shadowResult.productionComparison,
          config: config.drift || {},
        })
      : { items: [], typeCodes: [], severity: "none", requiresReview: false };
    const stability = flags.ENABLE_PROMOTION_GATE_EVALUATION
      ? evaluateRankingStability({ profile, productionSnapshot: productionSnapshot || profile.career_snapshot || {} })
      : null;
    const promotionGates = flags.ENABLE_PROMOTION_GATE_EVALUATION
      ? evaluatePromotionGates({
          contracts,
          shadowResult,
          drift,
          stability,
          realSampleCount: config.realSampleCount || 0,
          manualReviews: config.manualReviews || [],
          config: config.promotion || {},
        })
      : { eligible: false, gates: [], blockers: ["Promotion gate evaluation disabled."], nextState: "internal_review", productionInfluenceAllowed: false };
    activation = {
      ...activation,
      canInfluenceProduction: false,
    };
    const builtSummary = buildShadowSummary({
      runId,
      profile,
      shadowResult,
      productionSnapshot: productionSnapshot || profile.career_snapshot || {},
      drift,
      activation,
      generatedAt,
    });
    contracts.shadowSummary = builtSummary.contract;
    const privacy = builtSummary.privacy;
    let stored = false;
    let storeResult = null;
    if (activation.canPersistSummary && builtSummary.contract.valid && privacy.passed) {
      const store = logStore || createInMemoryShadowLogStore();
      storeResult = store.save(builtSummary.summary);
      stored = Boolean(storeResult.saved);
    }
    if (!privacy.passed) warnings.push({ code: "SUMMARY_PRIVACY_VALIDATION_FAILED", violations: privacy.violations });
    const result = {
      runId,
      activation,
      contracts,
      shadowResult,
      reasoningReport,
      drift,
      promotionGates,
      shadowSummary: builtSummary.summary,
      stored,
      storeResult,
      privacy,
      warnings: [...warnings, ...(shadowResult.warnings || [])],
    };
    return {
      ...result,
      inspectorText: flags.ENABLE_INTERNAL_REASONING_INSPECTOR ? serializeInspectorReport(result, { format: "text" }) : null,
    };
  } catch (error) {
    return {
      runId,
      activation: evaluateActivationPolicy({ featureFlags: { ...flags, ENABLE_SHADOW_REASONING: false }, profile }),
      contracts: {},
      shadowResult: null,
      drift: { items: [], typeCodes: ["OBSERVATORY_FAILURE"], severity: "low", requiresReview: false },
      promotionGates: { eligible: false, gates: [], blockers: ["Observatory failed closed."], nextState: "blocked", productionInfluenceAllowed: false },
      shadowSummary: null,
      stored: false,
      warnings: [{ code: "OBSERVATORY_FAILED_CLOSED", message: error?.message || "Unknown observatory error" }],
    };
  }
}
