/**
 * Normalized evidence dimensions — internal intelligence layer (not user-facing raw scores).
 */

export const EVIDENCE_DIMENSIONS = [
  "ownership",
  "leadership",
  "execution",
  "analytics",
  "communication",
  "technical_depth",
  "business_acumen",
  "startup_exposure",
  "customer_exposure",
  "project_complexity",
  "innovation",
  "collaboration",
  "strategic_thinking",
  "research_orientation",
  "networking",
];

export function emptyEvidence() {
  return Object.fromEntries(EVIDENCE_DIMENSIONS.map((k) => [k, 0]));
}

export function clampEvidence(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

/** Map raw trait totals (Likert sums) to 0–100 per trait dimension. */
export function normalizeTraitScoresTo100(traitScores = {}) {
  const maxByTrait = {
    leadership: 35,
    communication: 35,
    risk_taking: 25,
    analytical_thinking: 45,
    creativity: 25,
    execution: 45,
    collaboration: 20,
    ambiguity_tolerance: 25,
  };
  const out = {};
  for (const [key, raw] of Object.entries(traitScores || {})) {
    const max = maxByTrait[key] || 40;
    out[key] = clampEvidence((Number(raw) / max) * 100);
  }
  return out;
}
