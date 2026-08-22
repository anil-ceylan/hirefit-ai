import { clampScore } from "../evidence/evidenceTypes.js";
import {
  DEFAULT_CONFLICT_RULES,
  DEFAULT_REASONING_THRESHOLDS,
} from "./reasoningConfig.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasOutcome(item) {
  return Number(item?.quality_breakdown?.factors?.measurable_outcome || item?.strengthFactors?.measurableImpact || 0) >= 55 ||
    asArray(item?.metrics).length > 0;
}

function isInspectable(item) {
  return ["portfolio", "github", "linkedin"].includes(item?.source_type) || /portfolio|github|repo|demo|link/i.test(`${item?.source || ""} ${item?.description || ""}`);
}

export function detectReasoningConflicts(evidenceIntelligence = {}, { rules = DEFAULT_CONFLICT_RULES } = {}) {
  const evidenceObjects = asArray(evidenceIntelligence.evidenceObjects);
  const conflicts = [];

  for (const item of evidenceObjects) {
    const categories = asArray(item.categories);
    if (
      (categories.includes("claim") || item.source_type === "user_statement" || item.source_type === "career_dna") &&
      Number(item.trust || 0) < 48 &&
      Number(item.quality || 0) < 52 &&
      /strong|excellent|great|expert|advanced|leadership|skilled|güçlü|guclu/i.test(`${item.title} ${item.description}`)
    ) {
      conflicts.push({
        id: "strong_claim_without_support",
        evidenceId: item.id,
        severity: 72,
        rule: rules.find((rule) => rule.id === "strong_claim_without_support")?.description,
      });
    }
    if (asArray(item.competencies).includes("ownership") && !hasOutcome(item)) {
      conflicts.push({
        id: "high_ownership_without_outcome",
        evidenceId: item.id,
        severity: 68,
        rule: rules.find((rule) => rule.id === "high_ownership_without_outcome")?.description,
      });
    }
    if (item.role_context && Number(item.trust || 0) < 50 && !isInspectable(item)) {
      conflicts.push({
        id: "role_context_without_artifact",
        evidenceId: item.id,
        severity: 54,
        rule: rules.find((rule) => rule.id === "role_context_without_artifact")?.description,
      });
    }
  }

  const penalty = clampScore(conflicts.reduce((sum, item) => sum + item.severity, 0) / Math.max(1, conflicts.length) * Math.min(1, conflicts.length / 3));
  return {
    conflicts,
    conflictCount: conflicts.length,
    conflictPenalty: Math.min(DEFAULT_REASONING_THRESHOLDS.highConflictPenalty + 12, Math.round(penalty * 0.34)),
  };
}
