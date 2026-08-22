export function selectStrongestEvidence(report, count = 3) {
  return (report?.strongestEvidence || []).slice(0, count);
}

export function selectWeakestEvidence(report, count = 3) {
  return (report?.weakestEvidence || []).slice(0, count);
}

export function selectPrimaryEvidenceGap(report) {
  const fieldGap = report?.missingEvidenceFields?.[0];
  if (fieldGap) {
    return {
      id: `missing_${fieldGap.field}`,
      title: fieldGap.label,
      reason: report.explanationText,
      action: report.recommendedEvidenceImprovement,
    };
  }
  const weakest = report?.weakestEvidence?.[0];
  if (!weakest) return null;
  return {
    id: weakest.id,
    title: weakest.title,
    reason: report.explanationText,
    action: report.recommendedEvidenceImprovement,
  };
}

export function hasActionableEvidenceReport(report) {
  return Boolean(
    report &&
      report.evidenceItems?.length &&
      (report.weakestEvidence?.length || report.missingEvidenceFields?.length) &&
      report.recommendedEvidenceImprovement
  );
}
