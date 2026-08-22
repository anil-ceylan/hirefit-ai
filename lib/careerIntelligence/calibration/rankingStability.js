import { runShadowReasoning } from "./shadowReasoningRunner.js";
import { mergeCalibrationConfig } from "./calibrationConfig.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function perturb(profile, type) {
  const copy = clone(profile);
  if (type === "reordered_evidence") {
    copy.projects = asArray(copy.projects).reverse();
    copy.work_experience = asArray(copy.work_experience).reverse();
  }
  if (type === "duplicate_description") {
    const first = asArray(copy.projects)[0];
    if (first) copy.projects = [...asArray(copy.projects), { ...first, id: `${first.id || "project"}_duplicate` }];
  }
  if (type === "formatting_change") {
    if (copy.projects?.[0]?.description) copy.projects[0].description = `  ${copy.projects[0].description.toUpperCase()}  `;
  }
  if (type === "irrelevant_certificate") {
    copy.certifications = [...asArray(copy.certifications), { title: "Introductory Productivity Certificate", description: "Completed a general productivity course." }];
  }
  return copy;
}

export function evaluateRankingStability({ profile = {}, productionSnapshot = null, config = {} } = {}) {
  const cfg = mergeCalibrationConfig(config);
  const base = runShadowReasoning({ profile, productionSnapshot, config: cfg });
  const baseTop = base.reasoning.topRecommendation?.label || "";
  const variants = ["reordered_evidence", "duplicate_description", "formatting_change", "irrelevant_certificate"].map((type) => {
    const result = runShadowReasoning({ profile: perturb(profile, type), productionSnapshot, config: cfg });
    const top = result.reasoning.topRecommendation?.label || "";
    const confidenceDelta = Math.abs(Number(result.reasoning.topRecommendation?.decisionConfidence || 0) - Number(base.reasoning.topRecommendation?.decisionConfidence || 0));
    const rankScoreDelta = Math.abs(Number(result.reasoning.topRecommendation?.rankScore || 0) - Number(base.reasoning.topRecommendation?.rankScore || 0));
    return {
      type,
      stable: top === baseTop &&
        confidenceDelta <= cfg.stabilityThresholds.maxDecisionConfidenceDelta &&
        rankScoreDelta <= cfg.stabilityThresholds.maxRankScoreDelta,
      baseTop,
      variantTop: top,
      confidenceDelta,
      rankScoreDelta,
    };
  });
  return {
    stable: variants.every((item) => item.stable),
    stabilityScore: variants.length ? Number((variants.filter((item) => item.stable).length / variants.length).toFixed(3)) : 0,
    variants,
  };
}
