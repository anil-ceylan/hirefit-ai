export const MAX_TARGET_ROLES = 3;

export const EXPERIENCE_SIGNAL_OPTIONS = [
  { id: "none", score: 1, benchmark: "none", labelTr: "Henüz deneyimim yok", labelEn: "No experience yet" },
  { id: "one_internship", score: 3, benchmark: "one_internship", labelTr: "1 staj", labelEn: "1 internship" },
  { id: "two_plus_internships", score: 4, benchmark: "multiple_internships", labelTr: "2+ staj", labelEn: "2+ internships" },
  { id: "freelance", score: 3.5, benchmark: "multiple_internships", labelTr: "Freelance", labelEn: "Freelance" },
  { id: "startup", score: 4, benchmark: "multiple_internships", labelTr: "Startup", labelEn: "Startup" },
  { id: "part_time", score: 4, benchmark: "multiple_internships", labelTr: "Part-time", labelEn: "Part-time" },
  { id: "full_time", score: 5, benchmark: "work_experience", labelTr: "Full-time", labelEn: "Full-time" },
  { id: "student_club", score: 2, benchmark: "club", labelTr: "Öğrenci kulübü", labelEn: "Student club" },
  { id: "research", score: 3, benchmark: "one_internship", labelTr: "Araştırma", labelEn: "Research" },
  { id: "teaching_assistant", score: 3, benchmark: "one_internship", labelTr: "Teaching Assistant", labelEn: "Teaching Assistant" },
  { id: "volunteer", score: 2, benchmark: "club", labelTr: "Gönüllülük", labelEn: "Volunteer" },
];

export const LEADERSHIP_SIGNAL_OPTIONS = [
  { id: "none", score: 1, benchmark: "none", labelTr: "Henüz liderlik deneyimi yok", labelEn: "No leadership experience yet" },
  { id: "founder", score: 4.5, benchmark: "founder_cofounder", labelTr: "Kurucu", labelEn: "Founder" },
  { id: "club_leader", score: 3, benchmark: "club_community", labelTr: "Kulüp lideri", labelEn: "Club leader" },
  { id: "project_leader", score: 4, benchmark: "project_lead", labelTr: "Proje lideri", labelEn: "Project leader" },
  { id: "small_team_lead", score: 2, benchmark: "small_team", labelTr: "Küçük ekip lideri", labelEn: "Small team lead" },
  { id: "community_lead", score: 3, benchmark: "club_community", labelTr: "Topluluk lideri", labelEn: "Community lead" },
  { id: "mentor", score: 3, benchmark: "club_community", labelTr: "Mentor", labelEn: "Mentor" },
  { id: "large_team_lead", score: 5, benchmark: "large_team", labelTr: "Büyük ekip lideri", labelEn: "Large team lead" },
];

const PORTFOLIO_FIELDS = ["linkedin", "github", "portfolio", "website", "behance", "dribbble"];

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

export function normalizeSignalSelection(values, options, legacyBenchmark = "") {
  const allowed = new Set(options.map((option) => option.id));
  const legacyExpMap = {
    internship: "one_internship",
    multiple_internships: "two_plus_internships",
  };
  let normalized = uniqueStrings(values)
    .map((value) => legacyExpMap[value] || value)
    .filter((value) => allowed.has(value));

  if (!normalized.length && legacyBenchmark) {
    const legacy = options.find((option) => option.benchmark === legacyBenchmark);
    if (legacy) normalized = [legacy.id];
  }
  if (normalized.includes("none") && normalized.length > 1) {
    normalized = normalized.filter((value) => value !== "none");
  }
  return normalized;
}

export function toggleSignalSelection(values, value, options) {
  const current = normalizeSignalSelection(values, options);
  if (value === "none") return current.includes("none") ? [] : ["none"];
  const withoutNone = current.filter((item) => item !== "none");
  return withoutNone.includes(value)
    ? withoutNone.filter((item) => item !== value)
    : [...withoutNone, value];
}

export function strongestSignalBenchmark(values, options, fallback = "") {
  const normalized = normalizeSignalSelection(values, options);
  const strongest = options
    .filter((option) => normalized.includes(option.id))
    .sort((a, b) => b.score - a.score)[0];
  return strongest?.benchmark || fallback;
}

export function normalizePortfolioLinks(input = {}) {
  const normalizeUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname.includes(".")
        ? parsed.toString()
        : "";
    } catch {
      return "";
    }
  };
  return Object.fromEntries(
    PORTFOLIO_FIELDS.map((field) => [field, normalizeUrl(input?.[field])])
  );
}

export function buildAnalysisSources({
  dnaAnswers,
  goals,
  experienceSignals,
  leadershipSignals,
  readinessAnswers,
  cvUploaded,
  links,
} = {}) {
  const sources = [];
  if (Object.keys(dnaAnswers || {}).length) sources.push("career_dna");
  if (goals?.primaryRole || goals?.targetRoles?.length || goals?.industries?.length) sources.push("goals");
  if (normalizeSignalSelection(experienceSignals, EXPERIENCE_SIGNAL_OPTIONS).length) sources.push("experience");
  if (normalizeSignalSelection(leadershipSignals, LEADERSHIP_SIGNAL_OPTIONS).length) sources.push("leadership");
  if (readinessAnswers?.english) sources.push("english");
  if (readinessAnswers?.network) sources.push("network");
  if (cvUploaded) sources.push("cv");

  const normalizedLinks = normalizePortfolioLinks(links);
  for (const field of PORTFOLIO_FIELDS) {
    if (normalizedLinks[field]) sources.push(field);
  }
  return [...new Set(sources)];
}

export function getAnalysisSourceLabel(source, lang = "TR") {
  const tr = String(lang).toUpperCase() === "TR";
  const labels = {
    career_dna: "Career DNA",
    goals: tr ? "Hedef Roller" : "Target Roles",
    experience: tr ? "Deneyim" : "Experience",
    leadership: tr ? "Liderlik" : "Leadership",
    english: tr ? "İngilizce" : "English",
    network: tr ? "Network" : "Network",
    cv: "CV",
    linkedin: "LinkedIn",
    github: "GitHub",
    portfolio: tr ? "Portföy" : "Portfolio",
    website: tr ? "Kişisel web sitesi" : "Personal website",
    behance: "Behance",
    dribbble: "Dribbble",
  };
  return labels[source] || source;
}

export function classifyAnalysisSources(sources = [], { cvSignalCount = 0 } = {}) {
  const verifiableIds = new Set(["cv", "linkedin", "github", "portfolio", "website", "behance", "dribbble"]);
  const selfReportedIds = new Set(["career_dna", "goals", "experience", "leadership", "english", "network"]);
  const groups = {
    verifiable: [],
    selfReported: [],
  };

  for (const source of [...new Set(sources || [])]) {
    if (selfReportedIds.has(source)) {
      groups.selfReported.push(source);
    } else if (verifiableIds.has(source)) {
      groups.verifiable.push(source);
    } else if (source === "cv" || Number(cvSignalCount) > 0) {
      groups.verifiable.push(source);
    }
  }

  const verifiableOrder = ["cv", "linkedin", "github", "portfolio", "website", "behance", "dribbble"];
  const selfOrder = ["career_dna", "goals", "experience", "leadership", "english", "network"];
  groups.verifiable.sort((a, b) => verifiableOrder.indexOf(a) - verifiableOrder.indexOf(b));
  groups.selfReported.sort((a, b) => selfOrder.indexOf(a) - selfOrder.indexOf(b));

  return groups;
}

export function estimateCvSignalCount(text) {
  const raw = String(text || "");
  if (!raw.trim()) return 0;
  const evidencePatterns = [
    /\b\d+(?:[.,]\d+)?%/gi,
    /\b\d+(?:[.,]\d+)?\s*(?:users?|customers?|clients?|projects?|teams?|months?|years?)/gi,
    /\b(?:launched|shipped|built|delivered|led|managed|increased|reduced|improved|created|designed|analyzed)\b/gi,
    /\b(?:sql|excel|python|javascript|react|figma|tableau|power bi|github|jira|notion|salesforce)\b/gi,
    /\b(?:roadmap|prd|dashboard|campaign|forecast|research|stakeholder|workflow|onboarding|kpi)\b/gi,
  ];
  const matches = evidencePatterns.flatMap((pattern) => raw.match(pattern) || []);
  const bullets = raw.split(/\r?\n/).filter((line) => /^\s*[-•*]/.test(line)).length;
  return Math.min(250, new Set(matches.map((match) => match.toLowerCase())).size + bullets);
}
