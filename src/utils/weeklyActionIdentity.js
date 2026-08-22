export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function userKey(user) {
  return user?.id || user?.email || "local";
}

export function weeklyActionId(user, action, weekKey = getWeekKey()) {
  return `${userKey(user)}:${weekKey}:${String(action || "")
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöçİĞÜŞÖÇ]+/gi, "-")
    .slice(0, 80)}`;
}

export function buildDurableWeeklyActionPayload(decision, user) {
  const weekKey = getWeekKey();
  return {
    action_id: decision.id || weeklyActionId(user, decision.action, weekKey),
    decision_id: decision.decisionId || decision.id || weeklyActionId(user, decision.action, weekKey),
    week_key: weekKey,
    action_type: "weekly_career_move",
    title: decision.action,
    reason: decision.why,
    blocker: decision.blocker || "",
    target_dimension: decision.opportunity || "",
    expected_evidence: decision.opportunity || "",
    source: "weekly_decision_center",
    production_snapshot_ref: {
      week_key: weekKey,
      user_key: userKey(user),
    },
    confidence: decision.confidenceLabel || "",
  };
}
