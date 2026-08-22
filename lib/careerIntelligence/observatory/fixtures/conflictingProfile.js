export const conflictingProfile = {
  id: "fixture_conflicting",
  profile: {
    profile_id: "fixture_conflicting_profile",
    career_goals: { targetRoles: ["Strategy & Operations Intern", "Product Management Intern"], industries: ["Consulting", "Technology"] },
    skills: ["Excellent stakeholder management", "Strong strategic leader", "Product expert"],
    certifications: [{ title: "Product certificate" }, { title: "Strategy certificate" }],
    career_snapshot: {
      topRoleMatches: [
        { roleName: "Strategy & Operations Intern", fitPercentage: 76 },
        { roleName: "Product Management Intern", fitPercentage: 74 },
      ],
      gapDetails: { title: "Concrete Proof" },
      recruiterTrust: 34,
      careerReadiness: 56,
    },
  },
  productionSnapshot: null,
  expectedInputCoverage: { certifications: true, projects: false, cv: false },
  expectedMajorDriftBehavior: "unsupported_claims",
};

export default conflictingProfile;
