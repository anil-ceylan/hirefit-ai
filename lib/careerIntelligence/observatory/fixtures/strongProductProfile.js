export const strongProductProfile = {
  id: "fixture_strong_product",
  profile: {
    profile_id: "fixture_product_profile",
    basic_profile: { cvStatus: "analyzed", cvSignalCount: 4, university: "Sanitized University" },
    career_goals: { targetRoles: ["Product Management Intern", "Strategy & Operations Intern"], industries: ["Technology", "AI"] },
    projects: [
      {
        title: "AI onboarding product",
        description: "Founder and end-to-end owner. Launched onboarding workflow for 900 users and improved activation by 14%.",
        occurred_at: "2026",
        metrics: ["900 users", "14% activation"],
      },
    ],
    skills: ["roadmap", "user feedback", "product metrics"],
    career_snapshot: {
      topRoleMatches: [
        { roleName: "Product Management Intern", fitPercentage: 82 },
        { roleName: "Strategy & Operations Intern", fitPercentage: 76 },
        { roleName: "Business Analyst", fitPercentage: 68 },
      ],
      gapDetails: { title: "Stakeholder Influence" },
      recruiterTrust: 72,
      careerReadiness: 76,
    },
  },
  productionSnapshot: null,
  expectedInputCoverage: { cv: true, projects: true, careerDna: false },
  expectedMajorDriftBehavior: "low_or_none",
};

export default strongProductProfile;
