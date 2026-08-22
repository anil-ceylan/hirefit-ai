/**
 * Identity Engine debug — signal contribution breakdown (internal).
 */

import { clampEvidence } from "./evidenceDimensions.js";

export function buildSignalContributions(def, evidence, traitNorm, familyBoost = 0) {
  const rows = [];
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(def.weights || {})) {
    const value = key === "risk" ? traitNorm?.risk_taking : evidence?.[key];
    if (value == null || !Number.isFinite(Number(value))) continue;
    const contribution = Number(value) * Number(weight);
    weightedSum += contribution;
    rows.push({
      signal: key,
      weight: Number(weight),
      value: clampEvidence(value),
      contribution: Math.round(contribution * 10) / 10,
    });
  }

  const base = rows.reduce((s, r) => s + r.weight, 0) ? weightedSum / rows.reduce((s, r) => s + r.weight, 0) : 0;
  const withPct = rows
    .map((row) => ({
      ...row,
      contributionPct: weightedSum ? Math.round((row.contribution / weightedSum) * 100) : 0,
    }))
    .sort((a, b) => b.contributionPct - a.contributionPct);

  return {
    identityId: def.id,
    label: def.labelEn || def.id,
    score: clampEvidence(base + familyBoost),
    familyBoost,
    topContributors: withPct.slice(0, 6),
  };
}

export function buildIdentityDebugReport({
  domain,
  core,
  domainRanked = [],
  coreRanked = [],
  evidence = {},
  traitNorm = {},
  title = "",
}) {
  const domainDebug = buildSignalContributions(domain, evidence, traitNorm, domain.familyBoost || 0);
  const coreDebug = buildSignalContributions(core, evidence, traitNorm, 0);

  const domainAlternates = domainRanked.slice(0, 5).map((d) =>
    buildSignalContributions(d, evidence, traitNorm, d.familyBoost || 0)
  );
  const coreAlternates = coreRanked.slice(0, 5).map((c) =>
    buildSignalContributions(c, evidence, traitNorm, 0)
  );

  const evidenceRanked = Object.entries(evidence)
    .map(([signal, value]) => ({ signal, value: clampEvidence(value) }))
    .sort((a, b) => b.value - a.value);

  return {
    title,
    selected: { domain: domainDebug, core: coreDebug },
    domainAlternates,
    coreAlternates,
    evidenceRanked: evidenceRanked.slice(0, 10),
    signalGroups: summarizeSignalGroups(evidenceRanked),
  };
}

function summarizeSignalGroups(evidenceRanked) {
  const groups = {
    founder: ["startup_exposure", "ownership", "innovation"],
    product: ["ownership", "customer_exposure", "business_acumen", "execution"],
    building: ["execution", "ownership", "project_complexity", "technical_depth"],
    people: ["communication", "leadership", "networking", "collaboration"],
  };
  const out = {};
  for (const [group, keys] of Object.entries(groups)) {
    const vals = keys.map((k) => evidenceRanked.find((r) => r.signal === k)?.value || 0);
    out[group] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
  return out;
}
