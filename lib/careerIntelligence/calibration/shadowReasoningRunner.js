import { buildReasoningEngine } from "../reasoning/index.js";
import { adaptHireFitProfileToShadowInput } from "./shadowInputAdapter.js";
import { compareProductionToShadow } from "./shadowComparisonEngine.js";
import { runReasoningGuardrails } from "./reasoningGuardrails.js";
import { calculateCalibrationMetrics } from "./calibrationMetrics.js";
import { buildReasoningDebugReport } from "./buildReasoningDebugReport.js";
import { mergeCalibrationConfig } from "./calibrationConfig.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function competenciesForRole(label = "", config) {
  const entry = Object.entries(config.criticalCompetencyRules).find(([key]) =>
    String(label || "").toLowerCase().includes(key.toLowerCase())
  );
  return entry?.[1] || ["execution"];
}

function buildDecisionOptions(productionSnapshot = {}, config) {
  return asArray(productionSnapshot.topRoles).map((role) => ({
    id: String(role.id || role.label || role.roleName || role).toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    label: role.label || role.roleName || role.name || role,
    requiredCompetencies: competenciesForRole(role.label || role.roleName || role.name || role, config),
    productionFit: role.fit ?? null,
  })).filter((role) => role.label).slice(0, 5);
}

export function runShadowReasoning({
  profile = {},
  productionSnapshot = null,
  historicalSnapshots = [],
  config = {},
  debugFormat = "json",
} = {}) {
  const cfg = mergeCalibrationConfig(config);
  const normalized = adaptHireFitProfileToShadowInput({ profile, productionSnapshot });
  const options = buildDecisionOptions(normalized.existingProductionSnapshot, cfg);
  const reasoning = buildReasoningEngine({
    evidenceItems: normalized.evidenceItems,
    requirements: Object.fromEntries([...new Set(options.flatMap((option) => option.requiredCompetencies))].map((key) => [key, 1])),
    decisionOptions: options,
    history: historicalSnapshots,
    roles: options.map((option) => option.label),
    goals: normalized.explicitClaims.filter((claim) => claim.source === "career_goals").map((claim) => claim.text),
    profile,
    snapshot: productionSnapshot || profile?.career_snapshot || {},
    context: {
      roleContext: options[0]?.label || "",
      targetRole: options[0]?.label || "",
    },
  });
  const productionComparison = compareProductionToShadow({
    productionSnapshot: normalized.existingProductionSnapshot,
    reasoning,
  });
  const guardrails = runReasoningGuardrails(reasoning, { config: cfg });
  const calibration = calculateCalibrationMetrics([{
    id: normalized.profileId || normalized.userId || "single_profile",
    expected: null,
    reasoning,
    productionComparison,
    guardrails,
  }]);
  const result = {
    inputSummary: {
      userId: normalized.userId ? "present" : null,
      profileId: normalized.profileId ? "present" : null,
      evidenceCount: normalized.evidenceItems.length,
      explicitClaimCount: normalized.explicitClaims.length,
      sourceCoverage: normalized.sourceCoverage,
    },
    normalizedInput: normalized,
    evidenceIntelligence: reasoning.evidenceIntelligence,
    reasoning,
    productionComparison,
    calibration,
    guardrails,
    debugTrace: null,
    warnings: normalized.warnings,
  };
  return {
    ...result,
    debugTrace: buildReasoningDebugReport(result, { format: debugFormat }),
  };
}
