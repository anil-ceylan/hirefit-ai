import { clampScore } from "./evidenceTypes.js";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === "") return [];
  return [value];
}

function normalizeRequirements(requirements = {}) {
  if (Array.isArray(requirements)) {
    return Object.fromEntries(requirements.map((competency) => [competency, 1]));
  }
  return requirements || {};
}

export function calculateEvidenceCoverage(evidenceItems = [], requirements = {}, { confidenceByCompetency = {} } = {}) {
  const normalizedRequirements = normalizeRequirements(requirements);
  const coverage = {};
  const missing = [];
  const covered = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [competency, weightRaw] of Object.entries(normalizedRequirements)) {
    const weight = Number(weightRaw) || 1;
    const supportingItems = evidenceItems.filter((item) => asArray(item.competencies).includes(competency));
    const confidence = confidenceByCompetency[competency]?.confidence || 0;
    const bestQuality = supportingItems.reduce((max, item) => Math.max(max, Number(item.quality || item.normalized_weight || 0)), 0);
    const score = clampScore(bestQuality * 0.5 + confidence * 0.5);
    const row = {
      competency,
      requiredWeight: weight,
      score,
      confidence,
      evidenceCount: supportingItems.length,
      supportingEvidenceIds: supportingItems.map((item) => item.id),
      status: score >= 66 ? "covered" : score >= 40 ? "partial" : "missing",
    };
    coverage[competency] = row;
    if (row.status === "covered") covered.push(row);
    else missing.push(row);
    weightedScore += score * weight;
    totalWeight += weight;
  }

  return {
    coverageScore: totalWeight ? clampScore(weightedScore / totalWeight) : 0,
    coverage,
    coveredCompetencies: covered,
    missingCompetencies: missing.sort((a, b) => {
      if (b.requiredWeight !== a.requiredWeight) return b.requiredWeight - a.requiredWeight;
      return a.score - b.score;
    }),
  };
}
