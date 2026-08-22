function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function evaluateActivationEligibility({
  profile = {},
  shadowResult = null,
  contracts = {},
} = {}) {
  const blockers = [];
  const reasons = [];
  const profileExists = Boolean(profile && Object.keys(profile).length);
  if (!profileExists) blockers.push("Profile data is missing.");

  const evidenceCount = shadowResult?.inputSummary?.evidenceCount ?? shadowResult?.reasoning?.evidenceIntelligence?.evidenceObjects?.length ?? 0;
  if (evidenceCount <= 0) blockers.push("No traceable evidence is available.");
  else reasons.push(`${evidenceCount} traceable evidence item(s) available.`);

  const contractErrors = Object.entries(contracts || {}).flatMap(([name, result]) =>
    asArray(result?.errors).map((error) => ({ name, ...error }))
  );
  if (contractErrors.length) blockers.push("Critical contract validation failed.");

  const criticalGuardrails = asArray(shadowResult?.guardrails?.violations).filter((item) =>
    item.severity === "critical"
  );
  if (criticalGuardrails.length) blockers.push("Critical reasoning guardrail violation detected.");

  return {
    eligible: blockers.length === 0,
    reasons,
    blockers,
  };
}
