function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateExplanationTrace(recommendation = {}, reasoning = {}) {
  const requiredCompetencies = asArray(recommendation.option?.requiredCompetencies);
  const hypotheses = asArray(reasoning.hypotheses).filter((item) => requiredCompetencies.includes(item.competency));
  const inferences = asArray(reasoning.inferences);
  const evidenceObjects = asArray(reasoning.evidenceIntelligence?.evidenceObjects);
  const missingEvidence = asArray(reasoning.missingEvidence?.missingEvidence);
  const missingLinks = [];
  if (!recommendation.id && !recommendation.label) missingLinks.push("recommendation");
  if (!requiredCompetencies.length) missingLinks.push("required_competencies");
  for (const competency of requiredCompetencies) {
    const hypothesis = hypotheses.find((item) => item.competency === competency);
    const missing = missingEvidence.find((item) => item.competency === competency);
    if (!hypothesis && !missing) missingLinks.push(`hypothesis_or_missing_evidence:${competency}`);
  }
  for (const hypothesis of hypotheses) {
    const inference = inferences.find((item) => item.competency === hypothesis.competency);
    if (!inference) missingLinks.push(`inference:${hypothesis.competency}`);
    if (!hypothesis.evidenceIds?.length) missingLinks.push(`evidence_ids:${hypothesis.competency}`);
    for (const id of asArray(hypothesis.evidenceIds)) {
      const evidence = evidenceObjects.find((item) => item.id === id);
      if (!evidence) {
        missingLinks.push(`evidence:${id}`);
      } else if (!evidence.source || !evidence.source_type) {
        missingLinks.push(`source_metadata:${id}`);
      }
    }
  }
  const totalLinks = 5 + Math.max(1, hypotheses.length);
  const completenessScore = Number(((totalLinks - missingLinks.length) / totalLinks).toFixed(2));
  return {
    complete: missingLinks.length === 0,
    completenessScore: Math.max(0, completenessScore),
    missingLinks,
  };
}

export function validateAllRecommendationTraces(reasoning = {}) {
  const results = asArray(reasoning.recommendations).map((recommendation) => ({
    recommendationId: recommendation.id,
    label: recommendation.label,
    ...validateExplanationTrace(recommendation, reasoning),
  }));
  return {
    complete: results.every((item) => item.complete),
    completenessScore: results.length
      ? Number((results.reduce((sum, item) => sum + item.completenessScore, 0) / results.length).toFixed(2))
      : 0,
    results,
  };
}
