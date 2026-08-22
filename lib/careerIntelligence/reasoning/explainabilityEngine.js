function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function evidenceMap(evidenceIntelligence = {}) {
  return new Map(asArray(evidenceIntelligence.evidenceObjects).map((item) => [item.id, item]));
}

export function buildExplanationTrace({
  recommendation = null,
  hypothesis = null,
  evidenceIntelligence = {},
  conflicts = {},
  missingEvidence = {},
} = {}) {
  const byId = evidenceMap(evidenceIntelligence);
  const evidenceIds = asArray(recommendation?.evidenceIds || hypothesis?.evidenceIds);
  const supportingEvidence = evidenceIds.map((id) => byId.get(id)).filter(Boolean).map((item) => ({
    id: item.id,
    title: item.title,
    source_type: item.source_type,
    quality: item.quality,
    trust: item.trust,
    strength: item.strength,
  }));
  const conflictRows = asArray(conflicts.conflicts)
    .filter((item) => evidenceIds.includes(item.evidenceId))
    .map((item) => ({ id: item.id, evidenceId: item.evidenceId, severity: item.severity, reason: item.rule }));
  const missingRows = asArray(missingEvidence.missingEvidence)
    .filter((item) => !hypothesis || item.competency === hypothesis.competency)
    .slice(0, 5)
    .map((item) => ({ id: item.id, type: item.type, competency: item.competency, severity: item.severity, reason: item.reason }));
  return {
    evidence: supportingEvidence,
    inference: hypothesis ? {
      id: hypothesis.id,
      competency: hypothesis.competency,
      confidence: hypothesis.confidence,
      statement: hypothesis.statement,
    } : null,
    hypothesis: hypothesis || null,
    decision: recommendation ? {
      id: recommendation.id,
      label: recommendation.label,
      decisionConfidence: recommendation.decisionConfidence,
    } : null,
    missingEvidence: missingRows,
    conflicts: conflictRows,
    confidenceImprovementPath: missingRows[0]
      ? {
          missingEvidenceId: missingRows[0].id,
          expectedEffect: "Reduces uncertainty for the linked hypothesis.",
        }
      : null,
  };
}

export function explainHypotheses(hypotheses = [], context = {}) {
  return asArray(hypotheses).map((hypothesis) => ({
    hypothesisId: hypothesis.id,
    trace: buildExplanationTrace({ ...context, hypothesis }),
  }));
}
