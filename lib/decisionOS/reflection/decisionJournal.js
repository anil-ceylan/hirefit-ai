import { DECISION_JOURNAL_SCHEMA_VERSION, cleanText } from "./reflectionTypes.js";

export function createDecisionJournalEntry({
  decision = "",
  reason = "",
  expectedOutcome = "",
  biggestFear = "",
  biggestHope = "",
  confidence = null,
  reflection = "",
  futureReviewDate = null,
  outcome = "",
  lessonsLearned = "",
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    schemaVersion: DECISION_JOURNAL_SCHEMA_VERSION,
    createdAt,
    decision: cleanText(decision, 220),
    reason: cleanText(reason, 260),
    expectedOutcome: cleanText(expectedOutcome, 260),
    biggestFear: cleanText(biggestFear, 220),
    biggestHope: cleanText(biggestHope, 220),
    confidence: Number.isFinite(Number(confidence)) ? Math.max(0, Math.min(100, Math.round(Number(confidence)))) : null,
    reflection: cleanText(reflection, 400),
    futureReviewDate,
    outcome: cleanText(outcome, 260),
    lessonsLearned: cleanText(lessonsLearned, 400),
  };
}

export function buildDecisionJournalPrompt({ decision = "", primaryQuestion = "" } = {}) {
  const safeDecision = cleanText(decision, 160) || "this decision";
  return {
    schemaVersion: DECISION_JOURNAL_SCHEMA_VERSION,
    title: "Decision Journal Prompt",
    prompt: primaryQuestion || `Before deciding on ${safeDecision}, write what you hope will change and what you are afraid might happen.`,
    fields: [
      "Decision",
      "Reason",
      "Expected Outcome",
      "Biggest Fear",
      "Biggest Hope",
      "Confidence",
      "Reflection",
      "Future Review Date",
      "Outcome",
      "Lessons Learned",
    ],
    emptyEntry: createDecisionJournalEntry({ decision: safeDecision }),
  };
}

export function validateDecisionJournalEntry(entry = {}) {
  const errors = [];
  const warnings = [];
  if (entry.schemaVersion !== DECISION_JOURNAL_SCHEMA_VERSION) errors.push({ path: "schemaVersion", code: "INVALID_SCHEMA_VERSION" });
  if (!entry.decision) warnings.push({ path: "decision", code: "MISSING_DECISION" });
  if (entry.confidence != null && (!Number.isFinite(Number(entry.confidence)) || Number(entry.confidence) < 0 || Number(entry.confidence) > 100)) {
    errors.push({ path: "confidence", code: "INVALID_CONFIDENCE" });
  }
  return { valid: errors.length === 0, errors, warnings };
}
