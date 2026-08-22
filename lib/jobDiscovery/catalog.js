/**
 * Curated opportunity catalog — matched heuristically to CV + career memory.
 * JD snippets are synthetic posting summaries for analyze-v2, not live scrapes.
 */

export const JOB_CATALOG = [
  {
    id: "ms-pm-intern",
    company: "Microsoft",
    title: "PM Intern",
    level: "Junior",
    family: "product",
    remote: true,
    regions: ["global"],
    strongSignals: ["founder", "product ownership", "live product"],
    gapKeywords: ["prd", "user research", "roadmap"],
    jdSnippet: `Microsoft Product Management Intern
- Ship features with engineering and design partners
- Write lightweight PRDs and success metrics
- Run user research readouts and roadmap reviews
- Strong ownership of a scoped product area`,
  },
  {
    id: "google-apm",
    company: "Google",
    title: "Associate Product Manager (APM)",
    level: "Junior",
    family: "product",
    remote: false,
    regions: ["global"],
    strongSignals: ["product ownership", "measurable impact", "live product"],
    gapKeywords: ["user research", "roadmap", "prd"],
    jdSnippet: `Google APM Program
- Launch user-facing features with measurable impact
- Partner with UX research and data science
- Prioritize roadmap tradeoffs with engineering leads
- Communicate product narrative to leadership`,
  },
  {
    id: "stripe-pm",
    company: "Stripe",
    title: "Product Manager",
    level: "Mid",
    family: "product",
    remote: true,
    regions: ["global"],
    strongSignals: ["product ownership", "measurable impact", "live product"],
    gapKeywords: ["payments domain", "api platforms", "prd"],
    jdSnippet: `Stripe Product Manager
- Own a payments or developer-experience surface
- Define metrics, experiments, and rollout plans
- Write crisp PRDs and partner with engineering at scale
- Prioritize B2B customer outcomes`,
  },
  {
    id: "amazon-pm-ii",
    company: "Amazon",
    title: "Product Manager II",
    level: "Mid",
    family: "product",
    regions: ["global"],
    strongSignals: ["measurable impact", "product ownership"],
    gapKeywords: ["operational metrics", "written narratives", "roadmap"],
    jdSnippet: `Amazon Product Manager II
- Write narratives and PR/FAQ style docs
- Drive operational metrics and customer obsession
- Align cross-functional stakeholders on roadmap
- Deliver measurable business outcomes`,
  },
  {
    id: "spotify-pm-growth",
    company: "Spotify",
    title: "Product Manager, Growth",
    level: "Mid",
    family: "product",
    regions: ["global"],
    strongSignals: ["measurable impact", "live product"],
    gapKeywords: ["growth experiments", "funnel analytics", "roadmap"],
    jdSnippet: `Spotify Growth Product Manager
- Run experiments across activation and retention funnels
- Partner with data on cohort and lifecycle metrics
- Ship growth features with design and engineering
- Balance user experience with business KPIs`,
  },
  {
    id: "revolut-product-ops",
    company: "Revolut",
    title: "Product Operations Manager",
    level: "Mid",
    family: "operations",
    regions: ["eu"],
    strongSignals: ["measurable impact", "product ownership"],
    gapKeywords: ["process design", "stakeholder management"],
    jdSnippet: `Revolut Product Operations Manager
- Improve delivery rituals and cross-team execution
- Translate strategy into operational plans
- Track KPIs and unblock product launches
- Partner with product and engineering leadership`,
  },
  {
    id: "mckinsey-ba",
    company: "McKinsey",
    title: "Business Analyst",
    level: "Junior",
    family: "consulting",
    regions: ["global"],
    strongSignals: ["measurable impact"],
    gapKeywords: ["case frameworks", "structured problem solving", "client storytelling"],
    jdSnippet: `McKinsey Business Analyst
- Structure ambiguous business problems
- Build models and synthesize insights for partners
- Communicate recommendations to senior clients
- Work in small teams under tight deadlines`,
  },
  {
    id: "deloitte-consultant",
    company: "Deloitte",
    title: "Consultant",
    level: "Mid",
    family: "consulting",
    regions: ["global"],
    strongSignals: ["measurable impact"],
    gapKeywords: ["stakeholder management", "change management"],
    jdSnippet: `Deloitte Consultant
- Lead workstreams on transformation programs
- Facilitate workshops with client stakeholders
- Deliver slides and implementation roadmaps
- Quantify business impact of recommendations`,
  },
  {
    id: "meta-data-pm",
    company: "Meta",
    title: "Data Product Manager",
    level: "Mid",
    family: "data",
    regions: ["global"],
    strongSignals: ["measurable impact", "live product"],
    gapKeywords: ["sql", "experimentation", "data pipelines"],
    jdSnippet: `Meta Data Product Manager
- Define data products used by internal and external teams
- Partner with data engineering on pipelines and quality
- Ship experimentation and metrics tooling
- Translate analyst needs into product requirements`,
  },
  {
    id: "netflix-analytics",
    company: "Netflix",
    title: "Analytics Engineer",
    level: "Mid",
    family: "data",
    regions: ["global"],
    strongSignals: ["measurable impact"],
    gapKeywords: ["sql", "python", "dbt", "dashboards"],
    jdSnippet: `Netflix Analytics Engineer
- Build trusted datasets and semantic layers
- Partner with product on experimentation and KPIs
- Optimize pipelines for scale and reliability
- Communicate insights to product leadership`,
  },
  {
    id: "shopify-fe",
    company: "Shopify",
    title: "Senior Frontend Engineer",
    level: "Senior",
    family: "engineering",
    regions: ["global"],
    strongSignals: ["live product", "measurable impact"],
    gapKeywords: ["react", "typescript", "design systems"],
    jdSnippet: `Shopify Senior Frontend Engineer
- Ship merchant-facing UI with React and TypeScript
- Improve performance and accessibility at scale
- Collaborate with design on component systems
- Own features end-to-end with product partners`,
  },
  {
    id: "wise-pm",
    company: "Wise",
    title: "Product Manager",
    level: "Mid",
    family: "product",
    regions: ["eu"],
    strongSignals: ["product ownership", "live product"],
    gapKeywords: ["fintech compliance", "user research", "prd"],
    jdSnippet: `Wise Product Manager
- Own a money movement or compliance-adjacent journey
- Balance regulation, UX, and growth metrics
- Write PRDs and run discovery with users
- Ship iteratively with engineering squads`,
  },
];
