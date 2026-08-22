export const strategyOperationsProfile = {
  id: "fixture_strategy_operations",
  profile: {
    profile_id: "fixture_strategy_ops_profile",
    basic_profile: { cvStatus: "uploaded_local", cvFileName: "sanitized-cv.pdf", university: "Sanitized University" },
    career_goals: { targetRoles: ["Strategy & Operations Intern", "Business Analyst"], industries: ["Fintech", "SaaS"] },
    work_experience: [
      {
        title: "Operations project assistant",
        description: "Mapped customer operations workflow, identified bottlenecks, and reduced manual handoff time by 20%.",
        occurred_at: "2026",
        metrics: ["20% handoff time"],
      },
    ],
    projects: [{ title: "Business case", description: "Prepared market sizing and prioritization recommendation for a fintech workflow.", occurred_at: "2026" }],
    skills: ["process mapping", "business case", "stakeholder communication"],
    career_snapshot: {
      topRoleMatches: [
        { roleName: "Strategy & Operations Intern", fitPercentage: 78 },
        { roleName: "Business Analyst", fitPercentage: 73 },
        { roleName: "Product Management Intern", fitPercentage: 65 },
      ],
      gapDetails: { title: "Measurable Business Impact" },
      recruiterTrust: 62,
      careerReadiness: 70,
    },
  },
  productionSnapshot: null,
  expectedInputCoverage: { cv: true, projects: true, experience: true },
  expectedMajorDriftBehavior: "operations_supported",
};

export default strategyOperationsProfile;
