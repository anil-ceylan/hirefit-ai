import { mergeCalibrationConfig } from "./calibrationConfig.js";
import { validateAllRecommendationTraces } from "./explanationTraceValidator.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function severity(level) {
  return level || "medium";
}

function hasAbsoluteLanguage(value) {
  return /\b(definitely|guaranteed|certain|perfect fit|will succeed|always|never fail)\b/i.test(String(value || ""));
}

export function runReasoningGuardrails(reasoning = {}, { config = {} } = {}) {
  const cfg = mergeCalibrationConfig(config);
  const violations = [];
  const evidenceObjects = asArray(reasoning.evidenceIntelligence?.evidenceObjects);

  for (const hypothesis of asArray(reasoning.hypotheses)) {
    if (hypothesis.confidence >= cfg.unsupportedInferenceThreshold && !hypothesis.evidenceIds?.length) {
      violations.push({
        code: "UNSUPPORTED_COMPETENCY",
        severity: severity("high"),
        competency: hypothesis.competency,
        confidence: hypothesis.confidence,
        supportingEvidenceIds: [],
      });
    }
    if (hasAbsoluteLanguage(hypothesis.statement)) {
      violations.push({ code: "NO_ABSOLUTE_LANGUAGE", severity: "medium", text: hypothesis.statement });
    }
  }

  for (const recommendation of asArray(reasoning.recommendations)) {
    const required = asArray(recommendation.option?.requiredCompetencies);
    const supported = required.filter((competency) =>
      reasoning.hypotheses?.some((hypothesis) => hypothesis.competency === competency && hypothesis.confidence >= 40)
    );
    if (recommendation.decisionConfidence >= 72 && required.length && supported.length / required.length < 0.67) {
      violations.push({
        code: "UNSUPPORTED_ROLE",
        severity: "high",
        recommendationId: recommendation.id,
        confidence: recommendation.decisionConfidence,
        requiredCompetencies: required,
        supportedCompetencies: supported,
      });
    }
    if (recommendation.decisionConfidence > cfg.confidenceCaps.missingCriticalEvidenceCap && recommendation.missingEvidenceIds?.length) {
      violations.push({
        code: "MISSING_CRITICAL_EVIDENCE_CAP",
        severity: "medium",
        recommendationId: recommendation.id,
        confidence: recommendation.decisionConfidence,
        cap: cfg.confidenceCaps.missingCriticalEvidenceCap,
      });
    }
    if (hasAbsoluteLanguage(`${recommendation.label} ${recommendation.explanationTrace?.decision?.label || ""}`)) {
      violations.push({ code: "NO_ABSOLUTE_LANGUAGE", severity: "medium", recommendationId: recommendation.id });
    }
  }

  for (const item of evidenceObjects) {
    if (!item.source || !item.source_type) {
      violations.push({ code: "SOURCE_TRACEABILITY", severity: "critical", evidenceId: item.id });
    }
    if (item.source_type === "user_statement" && item.trust >= 70) {
      violations.push({ code: "UNSUPPORTED_CLAIM", severity: "high", evidenceId: item.id, trust: item.trust });
    }
    if (item.redundancyScore >= 78 && item.confidence >= cfg.confidenceCaps.singleEvidenceConfidenceCap) {
      violations.push({ code: "DUPLICATE_INFLATION", severity: "high", evidenceId: item.id, confidence: item.confidence });
    }
  }

  for (const conflict of asArray(reasoning.conflicts?.conflicts)) {
    const linkedHypotheses = asArray(reasoning.hypotheses).filter((hypothesis) => hypothesis.evidenceIds?.includes(conflict.evidenceId));
    for (const hypothesis of linkedHypotheses) {
      if (conflict.severity >= 70 && hypothesis.confidence > cfg.confidenceCaps.highConflictConfidenceCap) {
        violations.push({
          code: "CONFLICT_CONFIDENCE",
          severity: "high",
          competency: hypothesis.competency,
          conflictId: conflict.id,
          confidence: hypothesis.confidence,
          cap: cfg.confidenceCaps.highConflictConfidenceCap,
        });
      }
    }
  }

  const trace = validateAllRecommendationTraces(reasoning);
  if (!trace.complete || trace.completenessScore < cfg.traceCompletenessThreshold) {
    violations.push({
      code: "TRACE_INCOMPLETE",
      severity: "critical",
      completenessScore: trace.completenessScore,
      missingLinks: trace.results.flatMap((item) => item.missingLinks),
    });
  }

  const simulation = reasoning.simulation?.topOpportunity;
  if (simulation && simulation.mode !== "estimate") {
    violations.push({ code: "SIMULATION_SAFETY", severity: "high", mode: simulation.mode });
  }

  return {
    passed: violations.filter((item) => item.severity === "critical" || item.severity === "high").length === 0,
    violations,
    trace,
  };
}
