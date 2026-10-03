import { canonicalUrl } from "./http.js";
import { sanitizeDescription } from "./sanitize.js";
import { scopeApproved } from "./registry.js";

export function reviewedRules(source) {
  const rule = source.evidenceRules;
  return rule?.sourceKey === source.key && scopeApproved(rule) ? rule : {};
}
const patterns = {
  education: /\b(students?|enroll(?:ed|ment)?|undergraduates?|graduate students?|degree|universit(?:y|ies)|colleges?|academic (?:credit|standing)|credit hours)\b/i,
  workAuthorization: /\b(work authori[sz]ation|eligible to work|right to work|sponsor(?:ship|s|ed)?|employment visa)\b/i,
  workplace: /\b(on[- ]site|in[- ]office|remote|hybrid|office[- ]based|commut(?:e|es|ing)|office attendance)\b/i,
  programStatements: /\b(program|semester|start|end|duration|spring|summer|fall|winter)\b.*\b(?:20\d{2}|weeks?|months?|days?)\b/i,
  durationStatements: /\b\d+\s*(?:weeks?|months?|days?)\b/i,
  applicationStatements: /\b(application deadline|apply by|applications? close|closing date)\b/i,
};
function excerpts(text, pattern, attribution) {
  const lines = text.split("\n").filter(line => pattern.test(line));
  return { entries: lines.slice(0, 8).map(line => {
    const match = line.match(pattern);
    let start = line.length > 400 ? Math.max(0, match.index - 80) : 0;
    // Move inward to word boundaries; never increase the evidence budget.
    while (start > 0 && start < match.index && /\S/.test(line[start - 1]) && /\S/.test(line[start])) start++;
    let end = Math.min(line.length, start + 400);
    if (end < line.length) {
      const boundary = line.lastIndexOf(" ", end);
      if (boundary > match.index + match[0].length) end = boundary;
    }
    return { ...attribution, excerpt: line.slice(start, end).trim(), truncated: start > 0 || end < line.length };
  }), limited: lines.length > 8 };
}
const months = "January February March April May June July August September October November December".split(" ");
const monthPattern = months.join("|");
const periodPattern = new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\s*[-–—]\\s*(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "gi");
const dateEvidence = new RegExp(`\\b(?:${monthPattern})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d{1,2}/\\d{1,2}(?:/20\\d{2})?\\b`, "i");
const programContext = /\b(intern(?:ship)?|program|semester|spring|summer|fall|winter|duration|starts?|ends?)\b/i;
function programYears(text) {
  return programContext.test(text) ? [...text.matchAll(/\b20\d{2}\b/g)].map(m => m[0]) : [];
}
function dateOnly(month, day, year) {
  const index = months.findIndex(m => m.toLowerCase() === month.toLowerCase());
  const date = new Date(Date.UTC(Number(year), index, Number(day)));
  return date.getUTCMonth() === index && date.getUTCDate() === Number(day) ? date.toISOString().slice(0, 10) : null;
}

export function collectReviewFacts(row, source) {
  const issues = [], blocking = [];
  const id = Number.isSafeInteger(row?.id) && row.id > 0 ? String(row.id) : null;
  const facts = { source: source.key, postingId: id, title: typeof row?.title === "string" ? row.title.slice(0, 240) : null,
    organization: source.employer, canonicalUrl: null, rawLocationLabel: null, locations: [], internalJobIdentity: null,
    education: [], workAuthorization: [], workplace: [], programStatements: [], durationStatements: [], applicationStatements: [],
    programPeriods: [], durationClaims: [], abbreviatedProgramYears: [], sourceDates: {}, sanitization: null };
  if (source.employerKey && Number.isSafeInteger(row?.internal_job_id) && row.internal_job_id > 0) facts.internalJobIdentity = {
    provider: "greenhouse", employer_key: source.employerKey, internal_job_id: String(row.internal_job_id), source_field: "internal_job_id" };
  try { facts.canonicalUrl = canonicalUrl(row?.absolute_url, source.permittedHosts); } catch (error) { blocking.push(error.message); }
  const raw = row?.location?.name;
  if (typeof raw === "string") {
    facts.rawLocationLabel = raw.slice(0, 2400);
    const reviewedLocations = reviewedRules(source).locationLabels;
    // Exact reviewed labels, not a global comma splitter (city/state is ambiguous).
    const labels = reviewedLocations && Object.hasOwn(reviewedLocations, raw)
      ? reviewedLocations[raw] : raw.split(";").map(s => s.trim()).filter(Boolean);
    if (reviewedLocations && !Object.hasOwn(reviewedLocations, raw) && raw.includes(",")) issues.push("LOCATION_SEGMENTATION_REQUIRES_REVIEW");
    if (raw.length > 2400 || labels.length > 10 || labels.some(s => s.length > 240)) blocking.push("LOCATION_EVIDENCE_TOO_LARGE");
    facts.locations = [...new Set(labels)].slice(0, 10).map(label => {
      const mapped = Object.hasOwn(source.locationMappings || {}, label) ? source.locationMappings[label] : null;
      return { label: label.slice(0, 240), country: mapped?.country ?? null, city: mapped?.city ?? null };
    });
  } else if (raw != null) blocking.push("LOCATION_EVIDENCE_TOO_LARGE");
  for (const key of ["application_deadline", "first_published", "updated_at"]) {
    if (typeof row?.[key] === "string") facts.sourceDates[key] = { value: row[key].slice(0, 100), sourceField: key };
  }
  let description = "";
  if (source.permission?.descriptionAllowed === true) {
    try {
      const sanitized = sanitizeDescription(row?.content ?? "");
      description = sanitized.text;
      const { text: _text, ...diagnostics } = sanitized;
      facts.sanitization = diagnostics;
      if (sanitized.rawLarge) issues.push("RAW_HTML_LARGE");
      if (sanitized.truncated) issues.push("DESCRIPTION_TRUNCATED");
    } catch (error) { blocking.push(error.message); }
  } else issues.push("DESCRIPTION_NOT_AUTHORIZED_OMITTED");
  if (reviewedRules(source).statements === true) {
    const attribution = { source: source.key, postingId: id, sourceField: "content", rule: "employer-statement-excerpts-v1" };
    for (const [category, pattern] of Object.entries(patterns)) {
      const result = excerpts(description, pattern, attribution);
      facts[category] = result.entries;
      if (result.limited) issues.push("REVIEW_EVIDENCE_LIMIT_REACHED");
    }
    const titleYears = new Set(programYears(facts.title || ""));
    for (const [sourceField, text] of [["title", facts.title || ""], ["content", description]]) {
      // Require a season/semester immediately before the abbreviated year.
      const pattern = /\b(?:spring|summer|fall|autumn|winter|semester)\s+['’](\d{2})\b/i;
      const result = excerpts(text, pattern, { ...attribution, sourceField });
      // excerpts uses non-global matching; collect raw tokens without resolving a century.
      for (const entry of result.entries) for (const match of entry.excerpt.matchAll(new RegExp(pattern.source, "gi"))) {
        if (facts.abbreviatedProgramYears.length < 8) facts.abbreviatedProgramYears.push({ ...entry, value: match[0], yearToken: match[1], resolvedYear: null });
      }
    }
    const bodyYears = description.split("\n").flatMap(programYears);
    if (titleYears.size && bodyYears.some(year => !titleYears.has(year))) issues.push("PROGRAM_YEAR_CONFLICT");
    // Only explicit English date ranges with years on both ends are structured.
    // Everything else stays an attributed excerpt; never becomes a DB timestamp.
    for (const statement of facts.programStatements) {
      if (statement.truncated) {
        if (dateEvidence.test(statement.excerpt)) issues.push("PROGRAM_DATES_REQUIRE_REVIEW");
        continue;
      }
      const periods = [...statement.excerpt.matchAll(periodPattern)];
      const monthMentions = statement.excerpt.match(new RegExp(`\\b(?:${monthPattern})\\b`, "gi")) || [];
      const claims = [...statement.excerpt.matchAll(/\b(\d+)\s*(weeks?|months?|days?)\b/gi)];
      for (const claim of claims) if (facts.durationClaims.length < 8) facts.durationClaims.push({ ...attribution, value: Number(claim[1]), unit: claim[2].toLowerCase(), excerpt: statement.excerpt });
      for (const match of periods) {
        const start = dateOnly(match[1], match[2], match[3]), end = dateOnly(match[4], match[5], match[6]);
        if (!start || !end || end < start) { issues.push("CONTRADICTORY_PROGRAM_DATES"); continue; }
        if (facts.programPeriods.length < 8) facts.programPeriods.push({ ...attribution, startDate: start, endDate: end, precision: "date-only", excerpt: statement.excerpt });
        if (periods.length === 1 && monthMentions.length === 2 && claims.length === 1 && /^weeks?$/i.test(claims[0][2])) {
          const days = (Date.parse(end) - Date.parse(start)) / 86400000;
          const nominalDays = Number(claims[0][1]) * 7;
          const difference = Math.abs(days - nominalDays);
          // One day covers inclusive counting. One week / 10% allows nominal
          // scheduling; larger discrepancies remain material even if approximate.
          const tolerance = Math.max(7, nominalDays * 0.1);
          const approximate = /\b(about|approximately|around|roughly|nominal)\b/i.test(statement.excerpt);
          if (difference > tolerance) issues.push("CONTRADICTORY_DURATION_DATE_EVIDENCE");
          else if (difference > 1 || approximate) issues.push("NOMINAL_DURATION_DATE_REVIEW");
        }
      }
      const remainder = statement.excerpt.replace(periodPattern, "");
      if (dateEvidence.test(remainder) && /[-–—]|\b(?:to|until|through|from|start|end|duration)\b/i.test(remainder)) issues.push("PROGRAM_DATES_REQUIRE_REVIEW");
    }
  }
  return { facts, description, issues: [...new Set(issues)], blocking };
}
