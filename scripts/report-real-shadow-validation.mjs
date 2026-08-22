import { readFileSync } from "node:fs";
import {
  buildInternalReviewQueue,
  calculateRealUserValidationAggregate,
} from "../lib/careerActionLoop/realUserShadowValidation.js";
import { calculateGapPrioritizationMetrics } from "../lib/careerActionLoop/gapPrioritizationEvaluation.js";

function loadShadowLearning(path) {
  if (!path) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return parsed.shadow_learning || parsed.decision_loop?.shadow_learning || parsed.career_gps?.decision_loop?.shadow_learning || parsed;
}

const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
const shadowLearning = loadShadowLearning(fileArg?.slice("--file=".length));
const aggregate = calculateRealUserValidationAggregate(shadowLearning);
const gapMetrics = calculateGapPrioritizationMetrics(shadowLearning);
const queue = buildInternalReviewQueue(shadowLearning);

process.stdout.write(`Real Shadow Validation Report
State: ${aggregate.cohort_state}
Complete learning cycles: ${aggregate.complete_learning_cycles}
Real users: ${aggregate.real_user_count}
Evidence usability rate: ${aggregate.evidence_usability_rate ?? "insufficient_data"}
Material change rate: ${aggregate.material_change_rate ?? "insufficient_data"}
Unsafe divergence rate: ${aggregate.unsafe_divergence_rate ?? "insufficient_data"}
Pending review items: ${queue.length}
Gap evaluations: ${gapMetrics.gap_evaluation_count}
Same-gap rate: ${gapMetrics.production_shadow_same_gap_rate ?? "insufficient_data"}
Shadow refinement rate: ${gapMetrics.shadow_refinement_rate ?? "insufficient_data"}
Meaningful gap divergence rate: ${gapMetrics.meaningful_gap_divergence_rate ?? "insufficient_data"}
Follow-up outcome coverage: ${gapMetrics.followup_outcome_coverage_rate ?? "insufficient_data"}
Human review coverage: ${gapMetrics.human_review_coverage_rate ?? "insufficient_data"}
Gap data sufficiency: ${gapMetrics.data_sufficiency}
Gap promotion state: ${gapMetrics.promotion_state}
`);

if (queue.length) {
  process.stdout.write("\nReview Queue\n");
  for (const item of queue.slice(0, 20)) {
    process.stdout.write(`- ${item.validation_id} | ${item.review_classification} | ${item.alignment_class} | ${item.divergence_reason}\n`);
  }
}
