function snap(topRoles, biggestGap = "Stakeholder Influence", recruiterTrust = 55, careerReadiness = 60) {
  return {
    topRoleMatches: topRoles.map((role, index) => ({
      roleName: role,
      fitPercentage: Math.max(40, 86 - index * 8),
    })),
    gapDetails: { title: biggestGap },
    recruiterTrust,
    careerReadiness,
  };
}

function p(id, description, input, expected) {
  return { id, description, input, expected };
}

export const goldenPersonas = [
  p("persona_product_ownership_01", "Strong product ownership with measurable launch proof.", {
    projects: [{ title: "AI Product MVP", description: "Founder and end-to-end owner. Built and launched onboarding product for 1200 users, increasing activation by 18%.", occurred_at: "2026", metrics: ["1200 users", "18% activation"] }],
    skills: ["roadmap", "user feedback", "product strategy"],
    career_snapshot: snap(["Product Management", "Strategy & Operations", "Analytics"], "Stakeholder Influence", 76, 78),
  }, {
    topRoleIncludes: ["Product"],
    expectedStrongCompetencies: ["ownership", "execution", "product_thinking"],
    expectedMissingEvidence: ["stakeholder_influence"],
    minimumDecisionConfidence: 60,
  }),
  p("persona_analytics_heavy_02", "Analytics-heavy profile without product ownership.", {
    projects: [{ title: "SQL KPI dashboard", description: "Created SQL dashboard and forecast model for monthly business reporting, reducing manual reporting time by 30%.", source_type: "github", occurred_at: "2026", metrics: ["30% reporting time"] }],
    skills: ["SQL", "dashboard", "forecasting"],
    career_snapshot: snap(["Analytics", "Business Analyst", "Product Management"], "Ownership Proof", 70, 74),
  }, {
    topRoleIncludes: ["Analytics"],
    topRoleExcludes: ["Product Management"],
    expectedStrongCompetencies: ["analytical_reasoning"],
    expectedWeakCompetencies: ["ownership"],
  }),
  p("persona_generic_claims_03", "Generic self-claims with little proof.", {
    skills: ["Excellent communicator", "Strong leader", "Strategic thinker"],
    career_snapshot: snap(["Strategy & Operations", "Product Management"], "Proof Gap", 24, 42),
  }, {
    expectedConflicts: ["strong_claim_without_support"],
    maximumEvidenceTrust: 45,
    maximumDecisionConfidence: 65,
  }),
  p("persona_duplicate_evidence_04", "Same Excel evidence repeated across sections.", {
    projects: [
      { title: "Excel reporting", description: "Excel reporting.", occurred_at: "2026" },
      { title: "Excel reporting", description: "Excel reporting.", occurred_at: "2026" },
    ],
    skills: ["Excel"],
    career_snapshot: snap(["Business Analyst", "Analytics"], "Duplicate Proof", 48, 58),
  }, {
    maximumDecisionConfidence: 78,
    expectedMissingEvidence: ["strategic_reasoning"],
  }),
  p("persona_complementary_evidence_05", "Different evidence supports the same execution competency.", {
    projects: [{ title: "Workflow automation", description: "Built automation that reduced weekly manual work by 8 hours.", occurred_at: "2026", metrics: ["8 hours"] }],
    internships: [{ title: "Operations internship", description: "Delivered onboarding workflow improvements for customer operations team.", occurred_at: "2026" }],
    career_snapshot: snap(["Strategy & Operations", "Operations"], "Stakeholder Influence", 72, 72),
  }, {
    topRoleIncludes: ["Operations"],
    expectedStrongCompetencies: ["execution"],
  }),
  p("persona_old_evidence_06", "Strong but old product evidence.", {
    projects: [{ title: "Old product launch", description: "Founder and owner of product launched to 500 users.", occurred_at: "2018", metrics: ["500 users"] }],
    career_snapshot: snap(["Product Management", "Strategy & Operations"], "Recent Evidence", 52, 62),
  }, {
    expectedStrongCompetencies: ["ownership"],
    expectedMissingEvidence: ["strategic_reasoning"],
    maximumDecisionConfidence: 82,
  }),
  p("persona_recent_weak_07", "Recent but generic activity.", {
    projects: [{ title: "Product interest", description: "Interested in product and startups.", occurred_at: "2026" }],
    career_snapshot: snap(["Product Management", "Strategy & Operations"], "Portfolio Proof", 35, 48),
  }, {
    maximumEvidenceTrust: 58,
    maximumDecisionConfidence: 70,
  }),
  p("persona_conflicting_stakeholder_08", "Claims stakeholder strength but no stakeholder example.", {
    skills: ["Excellent stakeholder management", "Strong communication"],
    career_snapshot: snap(["Strategy & Operations", "Product Management"], "Stakeholder Influence", 38, 54),
  }, {
    expectedConflicts: ["strong_claim_without_support"],
    expectedMissingEvidence: ["stakeholder_influence"],
  }),
  p("persona_career_switcher_09", "Strong finance evidence, limited product target proof.", {
    work_experience: [{ title: "Finance analyst", description: "Created forecast model for revenue planning and monthly reporting.", occurred_at: "2025" }],
    skills: ["financial modeling", "SQL"],
    career_snapshot: snap(["Product Management", "Analytics", "Strategy & Operations"], "Product Proof", 50, 65),
  }, {
    expectedStrongCompetencies: ["analytical_reasoning"],
    expectedMissingEvidence: ["product_thinking"],
    maximumDecisionConfidence: 82,
  }),
  p("persona_early_student_10", "Early student with limited evidence.", {
    education: { title: "MIS student", description: "Management Information Systems student." },
    skills: ["Technology", "AI"],
    career_snapshot: snap(["Business Analyst", "Product Management"], "Experience Proof", 30, 38),
  }, {
    maximumDecisionConfidence: 70,
    expectedMissingEvidence: ["execution"],
  }),
  p("persona_founder_11", "Founder profile with strong ownership and execution.", {
    projects: [{ title: "Startup launch", description: "Founder and end-to-end owner. Built and launched SaaS workflow product for 300 customers.", occurred_at: "2026", metrics: ["300 customers"] }],
    career_snapshot: snap(["Product Management", "Strategy & Operations", "Operations"], "Enterprise Stakeholder Proof", 78, 82),
  }, {
    expectedStrongCompetencies: ["ownership", "execution"],
    expectedMissingEvidence: ["strategic_reasoning"],
  }),
  p("persona_certificate_heavy_12", "Many certificates, little applied experience.", {
    certifications: [{ title: "Product certificate" }, { title: "Strategy certificate" }, { title: "SQL certificate" }],
    skills: ["Product", "Strategy", "SQL"],
    career_snapshot: snap(["Business Analyst", "Product Management"], "Applied Experience", 36, 50),
  }, {
    maximumDecisionConfidence: 72,
    expectedMissingEvidence: ["execution"],
  }),
  p("persona_stakeholder_gap_13", "Execution exists but stakeholder influence is unsupported.", {
    projects: [{ title: "Workflow rollout", description: "Implemented workflow process that reduced turnaround by 16%.", occurred_at: "2026", metrics: ["16% turnaround"] }],
    career_snapshot: snap(["Strategy & Operations", "Operations"], "Stakeholder Influence", 66, 70),
  }, {
    expectedStrongCompetencies: ["execution"],
    expectedMissingEvidence: ["stakeholder_influence"],
  }),
  p("persona_business_case_14", "Strategy case evidence with recommendation but no measurable outcome.", {
    projects: [{ title: "Market entry case", description: "Prepared market entry business case with options and recommendation.", occurred_at: "2026" }],
    career_snapshot: snap(["Strategy & Operations", "Business Analyst"], "Measurable Impact", 58, 66),
  }, {
    topRoleIncludes: ["Business"],
    expectedMissingEvidence: ["stakeholder_influence"],
  }),
  p("persona_software_builder_15", "Software builder with inspectable technical proof.", {
    projects: [{ title: "Node API", description: "Built and deployed Node API with GitHub repo and automated tests.", source_type: "github", occurred_at: "2026" }],
    career_snapshot: snap(["Analytics", "Product Management", "Strategy & Operations"], "Business Impact", 64, 68),
  }, {
    expectedStrongCompetencies: ["technical_execution", "execution"],
    expectedWeakCompetencies: ["stakeholder_influence"],
  }),
  p("persona_growth_marketing_16", "Growth profile with campaign metrics.", {
    projects: [{ title: "Acquisition campaign", description: "Launched campaign that increased signups by 22% through landing page experiments.", occurred_at: "2026", metrics: ["22% signups"] }],
    career_snapshot: snap(["Strategy & Operations", "Product Management", "Analytics"], "Stakeholder Influence", 68, 70),
  }, {
    expectedStrongCompetencies: ["execution"],
    minimumDecisionConfidence: 50,
  }),
  p("persona_hr_people_17", "HR candidate with interview process exposure.", {
    internships: [{ title: "HR internship", description: "Supported interview scheduling and candidate communication for recruiting team.", occurred_at: "2025" }],
    career_snapshot: snap(["Operations", "Strategy & Operations"], "Outcome Proof", 54, 60),
  }, {
    expectedMissingEvidence: ["execution"],
  }),
  p("persona_finance_18", "Finance candidate with modeling evidence.", {
    projects: [{ title: "Forecast model", description: "Created financial forecast model and dashboard for monthly reporting.", source_type: "github", occurred_at: "2026" }],
    career_snapshot: snap(["Analytics", "Business Analyst", "Strategy & Operations"], "Business Impact", 70, 72),
  }, {
    topRoleIncludes: ["Analytics"],
    expectedStrongCompetencies: ["analytical_reasoning"],
  }),
  p("persona_balanced_operator_19", "Balanced operator with process and communication evidence.", {
    work_experience: [{ title: "Operations assistant", description: "Coordinated team workflow and improved onboarding process for customer operations.", occurred_at: "2025" }],
    projects: [{ title: "Process dashboard", description: "Built dashboard to track workflow bottlenecks.", occurred_at: "2026" }],
    career_snapshot: snap(["Strategy & Operations", "Operations", "Business Analyst"], "Measurable Impact", 62, 68),
  }, {
    topRoleIncludes: ["Operations"],
    expectedStrongCompetencies: ["execution"],
  }),
  p("persona_strong_cv_weak_proof_20", "Polished CV source but weak concrete proof.", {
    basic_profile: { cvStatus: "analyzed", cvFileName: "candidate_cv.pdf" },
    skills: ["Strategic leadership", "Communication", "Problem solving"],
    career_snapshot: snap(["Strategy & Operations", "Product Management"], "Concrete Proof", 42, 56),
  }, {
    expectedConflicts: ["strong_claim_without_support"],
    maximumDecisionConfidence: 76,
  }),
];

export default goldenPersonas;
