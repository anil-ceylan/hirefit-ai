export const earlyStudentProfile = {
  id: "fixture_early_student",
  profile: {
    profile_id: "fixture_early_student_profile",
    basic_profile: { university: "Sanitized University", cvStatus: "none" },
    career_goals: { targetRoles: ["Product Management Intern", "Business Analyst"], industries: ["Technology"] },
    education: { title: "MIS student", description: "Management Information Systems student." },
    skills: ["AI interest", "technology"],
    career_snapshot: {
      topRoleMatches: [
        { roleName: "Business Analyst", fitPercentage: 56 },
        { roleName: "Product Management Intern", fitPercentage: 54 },
      ],
      gapDetails: { title: "Portfolio Proof" },
      recruiterTrust: 28,
      careerReadiness: 45,
    },
  },
  productionSnapshot: null,
  expectedInputCoverage: { education: true, cv: false },
  expectedMajorDriftBehavior: "insufficient_evidence_possible",
};

export default earlyStudentProfile;
