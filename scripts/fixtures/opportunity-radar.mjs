// TEST ONLY. Not imported by application code or seeded by the migration.
// Never publish these records: fixture provenance is blocked by SQL and runtime.
export const opportunityFixtures = [
  {
    id: "11111111-1111-4111-8111-111111111111", type: "job", subtype: "full-time",
    title: "TEST FIXTURE — Data Analyst (not a live opportunity)", organization: "Fixture organization",
    description: "Development data only; do not apply.", source: "development-fixture", source_type: "fixture",
    source_item_id: "data-analyst-fixture", url: "https://opportunities.invalid/fixtures/data-analyst",
    country: "TR", city: "İstanbul", work_mode: "hybrid", role_tags: ["data_analyst"], sector_tags: ["technology"],
    skill_tags: ["SQL", "Python"], requirements: { experience_levels: ["entry"] }, eligibility: {},
    published: false, active: false, verification_status: "unverified", last_verified_at: null, expires_at: null,
    deadline_at: null, starts_at: null, ends_at: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222", type: "job", subtype: "internship",
    title: "TEST FIXTURE — Software Internship (not a live opportunity)", organization: "Fixture organization",
    description: "Development data only; do not apply.", source: "development-fixture", source_type: "fixture",
    source_item_id: "software-internship-fixture", url: "https://opportunities.invalid/fixtures/internship",
    country: null, city: null, work_mode: "remote", role_tags: ["software_engineer"], sector_tags: ["technology"],
    skill_tags: ["JavaScript"], requirements: { experience_levels: ["intern", "new_graduate"] }, eligibility: {},
    published: false, active: false, verification_status: "unverified", last_verified_at: null, expires_at: null,
    deadline_at: null, starts_at: null, ends_at: null,
  },
];
