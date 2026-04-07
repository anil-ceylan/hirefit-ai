const KNOWN = new Set([
  "Auto-detect",
  "Tech / Startup",
  "Consulting",
  "Finance",
  "FMCG / Retail",
  "Healthcare",
  "Government",
]);

export function normalizeSector(sector) {
  const s = String(sector || "").trim();
  if (KNOWN.has(s)) return s;
  return "Auto-detect";
}

/**
 * English block prepended to model prompts — conditions screening to the chosen sector.
 */
export function getSectorPromptBlock(sector) {
  const s = normalizeSector(sector);
  const blocks = {
    "Auto-detect": `SECTOR LENS — Auto: Infer the industry from the job description (and CV hints). Weight ATS keywords, recruiter judgment, gaps, and final decision using that sector's real hiring bar — not generic career coaching. If the JD is cross-industry, infer the dominant context.`,

    "Tech / Startup": `SECTOR LENS — Tech / Startup: Apply a tech hiring bar. Prioritize concrete stack/tools, measurable impact (metrics, scale, latency, revenue, users), ownership, and shipping velocity. Penalize buzzwords without proof. ATS: tool/role keyword precision matters. Recruiter: lean teams — generic profiles get cut fast.`,

    Consulting: `SECTOR LENS — Consulting: Prioritize structured problem-solving, client/stakeholder impact, frameworks, delivery under ambiguity, and credible outcomes (revenue, cost, risk, transformation). Penalize task-only bullets with no business result or scope.`,

    Finance: `SECTOR LENS — Finance: Prioritize regulatory/compliance awareness signals, risk controls, quantitative rigor, attention to detail, and trust cues (audit, reporting, models). Penalize vague "finance" claims without instruments, processes, or metrics.`,

    "FMCG / Retail": `SECTOR LENS — FMCG / Retail: Prioritize P&L, trade/channel, brand or category metrics, operations at scale, and commercial outcomes. Penalize internal jargon with no market or sales impact.`,

    Healthcare: `SECTOR LENS — Healthcare: Prioritize patient safety, compliance (HIPAA/GxP-style where relevant), clinical or operational quality metrics, and cross-functional stakeholder work. Penalize hand-wavy "healthcare" without domain-specific context.`,

    Government: `SECTOR LENS — Government / public sector: Prioritize policy/program delivery, procurement and stakeholder processes, security/clearance-style reliability signals, and formal accountability. Penalize startup-only framing if the role is public-sector.`,
  };
  return blocks[s] || blocks["Auto-detect"];
}
