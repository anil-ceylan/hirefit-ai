import { findPotentialBiases } from "./biasLibrary.js";
import { buildDecisionJournalPrompt } from "./decisionJournal.js";
import { buildOptionalInsightPacks } from "./optionalInsightPacks.js";
import { buildReflectionQuestions } from "./reflectionQuestions.js";
import { validateReflectionSafety } from "./reflectionSafety.js";
import { cleanText, confidenceLevel, createEmptyReflection, uniqueStrings } from "./reflectionTypes.js";
import { inferValueAlignment } from "./valuesLibrary.js";

const MOTIVATION_PATTERNS = Object.freeze([
  { id: "growth", label: "Growth", signals: ["grow", "advance", "challenge", "learn", "career"] },
  { id: "security", label: "Security", signals: ["safe", "stable", "salary", "risk", "secure"] },
  { id: "recognition", label: "Recognition", signals: ["prestige", "title", "brand", "recognized", "status"] },
  { id: "impact", label: "Impact", signals: ["impact", "help", "users", "customers", "meaning"] },
  { id: "freedom", label: "Freedom", signals: ["freedom", "autonomy", "remote", "independent", "flexible"] },
  { id: "belonging", label: "Belonging", signals: ["team", "community", "people", "network", "belong"] },
  { id: "avoidance", label: "Avoidance", signals: ["avoid", "escape", "fear", "rejection", "burnout"] },
]);

function joinInputText({ decision, context, evidence, memory }) {
  const contextText = typeof context === "string" ? context : JSON.stringify(context || {});
  const memoryText = typeof memory === "string" ? memory : JSON.stringify(memory || {});
  const evidenceText = (Array.isArray(evidence) ? evidence : [])
    .map((item) => [item?.title, item?.description, item?.textSummary, item?.source_type, item?.sourceType].filter(Boolean).join(" "))
    .join(" ");
  return [decision, contextText, evidenceText, memoryText].map((part) => cleanText(part, 1000)).filter(Boolean).join(" ");
}

function inferMotivations(text = "", max = 4) {
  const lower = String(text || "").toLowerCase();
  return MOTIVATION_PATTERNS
    .map((motivation) => {
      const hits = motivation.signals.filter((signal) => lower.includes(signal)).length;
      if (!hits) return null;
      return {
        id: motivation.id,
        label: motivation.label,
        confidence: confidenceLevel(hits * 28),
        framing: `${motivation.label} may be part of the internal reason this decision matters.`,
      };
    })
    .filter(Boolean)
    .slice(0, max);
}

function summarizeReflection({ motivations, valueAlignment, potentialBiases, evidenceUncertainty }) {
  const motivationLabel = motivations?.[0]?.label?.toLowerCase();
  const valueLabel = valueAlignment?.alignedValues?.[0]?.label?.toLowerCase();
  const biasLabel = potentialBiases?.[0]?.label;
  if (motivationLabel && valueLabel) {
    return `This reflection points to ${motivationLabel} and ${valueLabel} as possible forces behind the decision. Treat them as questions to examine, not conclusions.`;
  }
  if (biasLabel) {
    return `There may be a thinking pattern worth checking: ${biasLabel}. This is a prompt for reflection, not a diagnosis.`;
  }
  if (evidenceUncertainty) {
    return "The decision appears to have limited supporting context, so the most useful reflection is to separate what you know from what you are assuming.";
  }
  return "This reflection is designed to clarify why the decision matters to you before any evidence-based recommendation is considered.";
}

function detectEvidenceUncertainty(evidence = []) {
  const items = Array.isArray(evidence) ? evidence : [];
  if (!items.length) return true;
  const traceable = items.filter((item) => item?.id || item?.source || item?.sourceId).length;
  return traceable < Math.ceil(items.length / 2);
}

function buildWarnings({ evidenceUncertainty, optionalInsightPacks }) {
  const warnings = [];
  if (evidenceUncertainty) warnings.push("Reflection received limited traceable evidence context.");
  if (optionalInsightPacks.some((pack) => pack.category === "optional_symbolic_reflection")) {
    warnings.push("Symbolic packs are reflection-only and must not be treated as factual predictors.");
  }
  return uniqueStrings(warnings, 8);
}

export function generateReflection({
  decision = "",
  context = {},
  evidence = [],
  memory = {},
  optionalPacks = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const reflection = createEmptyReflection({ generatedAt });
  const inputText = joinInputText({ decision, context, evidence, memory });
  const motivations = inferMotivations(inputText);
  const potentialBiases = findPotentialBiases(inputText);
  const valueAlignment = inferValueAlignment(inputText);
  const evidenceUncertainty = detectEvidenceUncertainty(evidence);
  const reflectionQuestions = buildReflectionQuestions({
    decision,
    motivations,
    potentialBiases,
    valueAlignment,
    evidenceUncertainty,
  });
  const optionalInsightPacks = buildOptionalInsightPacks(optionalPacks);
  const decisionJournalPrompt = buildDecisionJournalPrompt({
    decision,
    primaryQuestion: reflectionQuestions[0],
  });

  const output = {
    ...reflection,
    decision: cleanText(decision, 220),
    summary: summarizeReflection({ motivations, valueAlignment, potentialBiases, evidenceUncertainty }),
    motivations,
    reflectionQuestions,
    potentialBiases,
    valueAlignment,
    decisionJournalPrompt,
    optionalInsightPacks,
    warnings: buildWarnings({ evidenceUncertainty, optionalInsightPacks }),
  };
  return {
    ...output,
    validation: validateReflectionSafety(output),
  };
}
