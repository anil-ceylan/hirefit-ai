export function calculateDecision(ats, recruiter) {
  const score = Number(ats?.score || 0);
  const r = recruiter?.decision || "reject";

  if (score > 75 && r === "consider") return "High Chance";
  if (score > 55 && r !== "reject") return "Medium Chance";
  return "Not Likely";
}

export function decisionEmoji(decision) {
  if (decision === "High Chance") return "✅";
  if (decision === "Medium Chance") return "⚠️";
  return "❌";
}