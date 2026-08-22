import assert from "node:assert/strict";
import {
  OPTIONAL_INSIGHT_PACK_NOTICE,
  createDecisionJournalEntry,
  generateReflection,
  validateDecisionJournalEntry,
  validateOptionalInsightPack,
  validateReflectionSafety,
} from "../lib/decisionOS/reflection/index.js";

const baseInput = {
  decision: "Apply to a prestigious startup role or stay in a stable current path",
  context: {
    product: "HireFit",
    situation: "User wants growth, recognition, security, and autonomy but worries about rejection.",
  },
  evidence: [
    {
      id: "ev_product_build",
      title: "Built product prototype",
      description: "Built a career product prototype and wants to help users make better decisions.",
      sourceType: "portfolio",
    },
  ],
  memory: {
    previousReflection: "User values growth and learning.",
  },
};

function assertReflectionOnly(reflection) {
  assert.equal(reflection.mode, "reflection_only");
  assert.equal(reflection.influencesRecommendations, false);
  assert.equal(reflection.recommendationOverride, null);
  assert.equal(reflection.validation.valid, true);
  assert.equal(validateReflectionSafety(reflection).valid, true);
}

const reflection = generateReflection({
  ...baseInput,
  optionalPacks: ["decision_style", "astrology"],
  generatedAt: "2026-08-02T12:00:00.000Z",
});

assertReflectionOnly(reflection);
assert.equal(reflection.schemaVersion, "reflection.v1");
assert(reflection.summary.includes("not a diagnosis") || reflection.summary.includes("questions to examine"));
assert(reflection.reflectionQuestions.length >= 5);
assert(reflection.potentialBiases.some((bias) => bias.id === "loss_aversion" || bias.id === "fear_of_judgment"));
assert(reflection.valueAlignment.alignedValues.length >= 2);
assert(reflection.valueAlignment.possibleTensions.length >= 1);
assert.equal(reflection.optionalInsightPacks.length, 2);
reflection.optionalInsightPacks.forEach((pack) => {
  assert.equal(pack.notice, OPTIONAL_INSIGHT_PACK_NOTICE);
  assert.equal(pack.influencesRecommendations, false);
  assert.equal(validateOptionalInsightPack(pack).valid, true);
});

const noEvidenceReflection = generateReflection({
  decision: "Change career direction",
  context: "I feel stuck and want freedom but need safety.",
  evidence: [],
  generatedAt: "2026-08-02T12:00:00.000Z",
});
assertReflectionOnly(noEvidenceReflection);
assert(noEvidenceReflection.warnings.includes("Reflection received limited traceable evidence context."));
assert(noEvidenceReflection.reflectionQuestions.some((question) => question.includes("evidence")));

const journal = createDecisionJournalEntry({
  decision: "Apply to startup role",
  reason: "Growth and learning",
  confidence: 64,
});
const journalValidation = validateDecisionJournalEntry(journal);
assert.equal(journalValidation.valid, true);
assert.equal(journal.confidence, 64);

const unsafeReflection = {
  influencesRecommendations: true,
  recommendationOverride: "Choose this option",
  optionalInsightPacks: [{ notice: "", influencesRecommendations: true }],
};
const unsafeValidation = validateReflectionSafety(unsafeReflection);
assert.equal(unsafeValidation.valid, false);
assert(unsafeValidation.errors.length >= 3);

const deterministicA = generateReflection({ ...baseInput, generatedAt: "2026-08-02T12:00:00.000Z" });
const deterministicB = generateReflection({ ...baseInput, generatedAt: "2026-08-02T12:00:00.000Z" });
assert.deepEqual(deterministicA.reflectionQuestions, deterministicB.reflectionQuestions);
assert.deepEqual(deterministicA.potentialBiases, deterministicB.potentialBiases);
assert.deepEqual(deterministicA.valueAlignment, deterministicB.valueAlignment);

console.error("Reflection Intelligence validation: PASS");
console.error(JSON.stringify({
  questions: reflection.reflectionQuestions.length,
  biases: reflection.potentialBiases.map((bias) => bias.id),
  values: reflection.valueAlignment.alignedValues.map((value) => value.id),
  optionalPacks: reflection.optionalInsightPacks.map((pack) => pack.id),
  warnings: reflection.warnings,
}, null, 2));
