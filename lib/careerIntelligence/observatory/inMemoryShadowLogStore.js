import { validateShadowPrivacy } from "./validateShadowPrivacy.js";

export function createInMemoryShadowLogStore(seed = []) {
  const records = new Map();
  for (const item of seed) {
    if (item?.runId) records.set(item.runId, item);
  }
  return {
    save(summary) {
      const privacy = validateShadowPrivacy(summary);
      if (!privacy.passed) {
        return { saved: false, error: "PII_PRIVACY_VALIDATION_FAILED", privacy };
      }
      records.set(summary.runId, summary);
      return { saved: true, runId: summary.runId };
    },
    getByRunId(runId) {
      return records.get(runId) || null;
    },
    list(filters = {}) {
      return [...records.values()].filter((item) => {
        if (filters.severity && item.drift?.severity !== filters.severity) return false;
        if (filters.requiresReview != null && item.drift?.requiresReview !== filters.requiresReview) return false;
        return true;
      });
    },
    clear() {
      records.clear();
      return { cleared: true };
    },
  };
}
