import { clampScore } from "./evidenceTypes.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function sourceKey(item) {
  return item.source || item.source_type || "unknown";
}

export function calculateCompetencyConfidence(evidenceItems = [], { redundancyReport = null } = {}) {
  const byCompetency = new Map();
  for (const item of evidenceItems) {
    for (const competency of asArray(item.competencies)) {
      const list = byCompetency.get(competency) || [];
      list.push(item);
      byCompetency.set(competency, list);
    }
  }

  const result = {};
  for (const [competency, items] of byCompetency.entries()) {
    const independentSources = new Set(items.map(sourceKey)).size;
    const averageQuality = items.reduce((sum, item) => sum + Number(item.quality || item.strength || item.normalized_weight || 0), 0) / items.length;
    const averageTrust = items.reduce((sum, item) => sum + Number(item.trust || 0), 0) / items.length;
    const redundancyPenalty = items.reduce((sum, item) => {
      const redundancy = redundancyReport?.itemRedundancy?.[item.id]?.redundancyScore || 0;
      return sum + Math.max(0, redundancy - 70) * 0.18;
    }, 0);
    const evidenceDepth = Math.min(26, items.length * 8);
    const sourceDepth = Math.min(22, independentSources * 9);
    const confidence = clampScore(averageQuality * 0.36 + averageTrust * 0.28 + evidenceDepth + sourceDepth - redundancyPenalty);
    result[competency] = {
      competency,
      confidence,
      evidenceCount: items.length,
      independentSourceCount: independentSources,
      supportingEvidenceIds: items.map((item) => item.id),
      confidenceFactors: {
        averageQuality: clampScore(averageQuality),
        averageTrust: clampScore(averageTrust),
        evidenceDepth,
        sourceDepth,
        redundancyPenalty: clampScore(redundancyPenalty),
      },
    };
  }
  return result;
}
