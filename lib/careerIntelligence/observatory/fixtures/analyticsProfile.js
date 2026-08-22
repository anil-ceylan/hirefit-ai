export const analyticsProfile = {
  id: "fixture_analytics",
  profile: {
    profile_id: "fixture_analytics_profile",
    career_goals: { targetRoles: ["Business Analyst", "Analytics Associate"], industries: ["Technology"] },
    projects: [
      {
        title: "KPI dashboard",
        description: "Built SQL dashboard and forecast model for monthly reporting, reducing manual reporting time by 32%.",
        source_type: "github",
        occurred_at: "2026",
        metrics: ["32% reporting time"],
      },
    ],
    skills: ["SQL", "dashboard", "forecasting"],
    career_snapshot: {
      topRoleMatches: [
        { roleName: "Business Analyst", fitPercentage: 80 },
        { roleName: "Analytics Associate", fitPercentage: 78 },
        { roleName: "Product Management Intern", fitPercentage: 58 },
      ],
      gapDetails: { title: "Business Case Work" },
      recruiterTrust: 68,
      careerReadiness: 72,
    },
  },
  productionSnapshot: null,
  expectedInputCoverage: { projects: true, cv: false },
  expectedMajorDriftBehavior: "analytics_supported",
};

export default analyticsProfile;
