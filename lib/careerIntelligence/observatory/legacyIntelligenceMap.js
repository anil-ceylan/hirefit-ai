export const legacyIntelligenceMap = [
  {
    legacyConcept: "Production top role",
    newConcepts: ["Shadow decision option", "Recommendation ranking"],
    equivalent: false,
    comparisonType: "partial",
    migrationRisk: "High if titles are compared as exact score equivalents.",
    notes: "Compare ranking agreement and evidence support, not raw percentage values.",
  },
  {
    legacyConcept: "Production biggest gap",
    newConcepts: ["Shadow missing evidence", "Opportunity gap"],
    equivalent: false,
    comparisonType: "directional",
    migrationRisk: "Medium because legacy gaps may be copy-facing while shadow gaps are competency-facing.",
    notes: "Use category-level agreement before attempting label-level migration.",
  },
  {
    legacyConcept: "Recruiter Trust",
    newConcepts: ["Evidence trust", "Source quality", "Trace completeness"],
    equivalent: false,
    comparisonType: "partial",
    migrationRisk: "High because verified evidence and user-declared strength are different concepts.",
    notes: "Recruiter Trust can be informed by evidence trust but should not be replaced one-to-one.",
  },
  {
    legacyConcept: "Career Readiness",
    newConcepts: ["Evidence coverage", "Role readiness signals", "Missing evidence"],
    equivalent: false,
    comparisonType: "directional",
    migrationRisk: "Medium because readiness also reflects market preparedness and profile completeness.",
    notes: "Compare directionally against evidence coverage and confidence caps.",
  },
  {
    legacyConcept: "Legacy role fit",
    newConcepts: ["Decision confidence", "Competency alignment"],
    equivalent: false,
    comparisonType: "partial",
    migrationRisk: "High if users see both as the same score.",
    notes: "Role fit is closeness; decision confidence is evidence-backed certainty.",
  },
  {
    legacyConcept: "Legacy evidence confidence",
    newConcepts: ["Evidence strength", "Evidence trust", "Competency confidence"],
    equivalent: false,
    comparisonType: "partial",
    migrationRisk: "Medium because confidence may have mixed source, strength, and coverage assumptions.",
    notes: "Split into explicit dimensions before migration.",
  },
];

export function getLegacyIntelligenceMap() {
  return legacyIntelligenceMap;
}
