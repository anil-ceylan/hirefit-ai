import { compareReasoningMemory } from "./memoryIntegration.js";

export function analyzeReasoningLearning(memory = {}, currentReasoning = {}) {
  const deltas = compareReasoningMemory(memory);
  const newEvidenceCount = Math.max(0, Number(currentReasoning.evidenceObjectCount || 0) - Number(memory.previous?.evidenceCount || 0));
  return {
    hasProgress: deltas.hasDelta || newEvidenceCount > 0,
    newEvidenceCount,
    improvedCompetencies: deltas.deltas.filter((item) => item.delta > 0),
    weakenedCompetencies: deltas.deltas.filter((item) => item.delta < 0),
    learningState: !memory.hasHistory
      ? "first_reasoning_state"
      : deltas.hasDelta || newEvidenceCount > 0
        ? "updated_from_memory"
        : "stable",
  };
}
