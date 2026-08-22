import { stableHash } from "./utils.js";

export function createManualReview({ runId = "", status = "pending", verdict = {}, tags = [], notes = "" } = {}) {
  return {
    reviewId: `review_${stableHash({ runId, status, verdict, tags })}`,
    runId,
    status,
    reviewedAt: status === "pending" ? null : new Date().toISOString(),
    verdict: {
      productionMoreReasonable: Boolean(verdict.productionMoreReasonable),
      shadowMoreReasonable: Boolean(verdict.shadowMoreReasonable),
      bothReasonable: Boolean(verdict.bothReasonable),
      insufficientEvidence: Boolean(verdict.insufficientEvidence),
    },
    tags: Array.isArray(tags) ? tags : [],
    notes: String(notes || "").slice(0, 500),
  };
}

export function validateManualReview(review = {}) {
  const errors = [];
  if (!review.reviewId) errors.push({ path: "reviewId", code: "REQUIRED" });
  if (!review.runId) errors.push({ path: "runId", code: "REQUIRED" });
  if (!["pending", "reviewed", "accepted", "rejected"].includes(review.status)) errors.push({ path: "status", code: "INVALID_STATUS" });
  return { valid: errors.length === 0, errors, warnings: [] };
}
