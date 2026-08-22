import { cleanText, uniqueStrings } from "./reflectionTypes.js";

const BASE_QUESTIONS = Object.freeze([
  "Why do you want this outcome?",
  "What are you hoping will change?",
  "Are you moving toward something, avoiding something, or both?",
  "Would your future self understand this decision?",
  "If this opportunity disappeared tomorrow, what would you feel?",
  "If fear disappeared, would you choose differently?",
]);

export function buildReflectionQuestions({
  decision = "",
  motivations = [],
  potentialBiases = [],
  valueAlignment = {},
  evidenceUncertainty = false,
  max = 7,
} = {}) {
  const questions = [];
  const safeDecision = cleanText(decision, 160);
  if (safeDecision) questions.push(`What makes "${safeDecision}" important to you right now?`);
  motivations.slice(0, 2).forEach((motivation) => {
    questions.push(`If ${motivation.label.toLowerCase()} is driving this decision, what would satisfy it in a healthy way?`);
  });
  potentialBiases.slice(0, 2).forEach((bias) => questions.push(bias.reflectionPrompt));
  valueAlignment?.possibleTensions?.slice(0, 2).forEach((tension) => questions.push(tension.reflectionQuestion));
  if (evidenceUncertainty) {
    questions.push("What evidence would make this decision feel clearer without forcing certainty?");
  }
  questions.push(...BASE_QUESTIONS);
  return uniqueStrings(questions, max);
}
