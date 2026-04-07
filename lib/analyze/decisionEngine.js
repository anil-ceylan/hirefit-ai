function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function buildImprovements(fix) {
  const bullets = fix?.rewrittenBulletPoints ?? [];
  const suggestions = fix?.improvementSuggestions ?? [];
  const out = [];
  for (const b of bullets) out.push(`Rewritten bullet: ${b}`);
  out.push(...suggestions);
  return out;
}

function buildSummary(ats, recruiter) {
  const base = recruiter?.explanation || "";
  const hire = recruiter?.hireDecision || "MAYBE";
  const atsLine = `ATS alignment ~${ats?.alignmentScore ?? "?"}%.`;
  if (base) return `${base} ${hire === "YES" ? "Recruiter lean: positive." : hire === "NO" ? "Recruiter lean: negative." : "Recruiter lean: mixed."} ${atsLine}`;
  return `${atsLine} Hire decision: ${hire}.`;
}

export function combineAnalysisOutputs(ats, recruiter, fix) {
  const atsScore = clamp(ats?.alignmentScore ?? 50, 0, 100);
  const hire = String(recruiter?.hireDecision || "MAYBE").toUpperCase();

  let finalScore = atsScore;
  if (hire === "NO") finalScore = Math.max(0, atsScore - 18);
  else if (hire === "YES") finalScore = Math.min(100, atsScore + 6);
  else finalScore = Math.max(0, atsScore - 5);

  return {
    finalScore: Math.round(finalScore),
    summary: buildSummary(ats, recruiter),
    strengths: Array.isArray(recruiter?.strengths) ? recruiter.strengths : [],
    weaknesses: Array.isArray(recruiter?.weaknesses) ? recruiter.weaknesses : [],
    matchedKeywords: Array.isArray(ats?.matchedKeywords) ? ats.matchedKeywords : [],
    missingKeywords: Array.isArray(ats?.missingKeywords) ? ats.missingKeywords : [],
    improvements: buildImprovements(fix || {}),
  };
}
