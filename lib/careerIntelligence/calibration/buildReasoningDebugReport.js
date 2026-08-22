function compactEvidence(evidence = []) {
  return evidence.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    source_type: item.source_type,
    category: item.category,
    competencies: item.competencies,
    strength: item.strength,
    trust: item.trust,
    freshness: item.freshness,
    quality: item.quality,
    redundancyScore: item.redundancyScore,
  }));
}

function line(label, value) {
  return `${label}: ${value == null ? "n/a" : value}`;
}

function textReport(result = {}) {
  const reasoning = result.reasoning || {};
  const evidence = reasoning.evidenceIntelligence || {};
  const lines = [
    "Reasoning Shadow Debug Report",
    "",
    "Input Summary",
    line("Evidence", result.inputSummary?.evidenceCount),
    line("Claims", result.inputSummary?.explicitClaimCount),
    line("Warnings", result.warnings?.length || 0),
    "",
    "Normalized Evidence",
    ...compactEvidence(evidence.evidenceObjects || []).map((item) =>
      `- ${item.id} | ${item.title} | source=${item.source_type} | quality=${item.quality} | trust=${item.trust}`
    ),
    "",
    "Competency Confidence",
    ...Object.entries(evidence.confidenceByCompetency || {}).map(([key, value]) =>
      `- ${key}: ${value.confidence} (${value.evidenceCount} evidence)`
    ),
    "",
    "Coverage Gaps",
    ...(evidence.coverage?.missingCompetencies || []).map((item) =>
      `- ${item.competency}: ${item.status} (${item.score})`
    ),
    "",
    "Evidence Graph Summary",
    line("Nodes", evidence.graph?.nodes?.length || 0),
    line("Edges", evidence.graph?.edges?.length || 0),
    "",
    "Inferences",
    ...(reasoning.inferences || []).slice(0, 8).map((item) => `- ${item.competency}: ${item.confidence}`),
    "",
    "Hypotheses",
    ...(reasoning.hypotheses || []).slice(0, 8).map((item) => `- ${item.competency}: ${item.type} (${item.confidence})`),
    "",
    "Conflicts",
    ...(reasoning.conflicts?.conflicts || []).map((item) => `- ${item.id} on ${item.evidenceId} severity=${item.severity}`),
    "",
    "Missing Evidence",
    ...(reasoning.missingEvidence?.missingEvidence || []).slice(0, 8).map((item) => `- ${item.competency || item.field}: ${item.reason}`),
    "",
    "Ranked Recommendations",
    ...(reasoning.recommendations || []).map((item) => `- ${item.label}: confidence=${item.decisionConfidence}, rank=${item.rankScore}`),
    "",
    "Production Comparison",
    line("Agreement", result.productionComparison?.summary?.agreementLevel),
    line("Requires Review", result.productionComparison?.summary?.requiresReview),
    "",
    "Guardrail Violations",
    ...(result.guardrails?.violations || []).map((item) => `- ${item.code} (${item.severity})`),
  ];
  return lines.join("\n");
}

export function buildReasoningDebugReport(result = {}, { format = "json" } = {}) {
  const reasoning = result.reasoning || {};
  const evidence = reasoning.evidenceIntelligence || {};
  const json = {
    inputSummary: result.inputSummary,
    normalizedEvidence: compactEvidence(evidence.evidenceObjects || []),
    evidenceClassification: compactEvidence(evidence.evidenceObjects || []).map((item) => ({
      id: item.id,
      category: item.category,
      competencies: item.competencies,
    })),
    strengthFactors: Object.fromEntries((evidence.evidenceObjects || []).map((item) => [item.id, item.strengthFactors])),
    trustFactors: Object.fromEntries((evidence.evidenceObjects || []).map((item) => [item.id, item.trustFactors])),
    freshnessFactors: Object.fromEntries((evidence.evidenceObjects || []).map((item) => [item.id, item.freshnessFactors])),
    redundancyAnalysis: evidence.redundancy,
    competencyConfidence: evidence.confidenceByCompetency,
    coverageGaps: evidence.coverage?.missingCompetencies || [],
    evidenceQuality: evidence.quality,
    evidenceGraphSummary: {
      nodes: evidence.graph?.nodes?.length || 0,
      edges: evidence.graph?.edges?.length || 0,
    },
    inferences: reasoning.inferences,
    hypotheses: reasoning.hypotheses,
    conflicts: reasoning.conflicts,
    missingEvidence: reasoning.missingEvidence,
    rankedRecommendations: reasoning.recommendations,
    decisionConfidence: reasoning.recommendations?.map((item) => ({ id: item.id, confidence: item.decisionConfidence })),
    productionComparison: result.productionComparison,
    guardrailViolations: result.guardrails?.violations || [],
    calibrationMetrics: result.calibration,
    warnings: result.warnings,
  };
  return format === "text" ? textReport(result) : json;
}
