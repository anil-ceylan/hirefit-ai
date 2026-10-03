import { JOB_SUBTYPES } from "../constants.js";
import { collectReviewFacts, reviewedRules } from "./reviewEvidence.js";
export { plainText } from "./sanitize.js";

function metadata(row, name) {
  if (!name) return null;
  const matches = (Array.isArray(row.metadata) ? row.metadata : []).filter(item => item?.name === name);
  return matches.length === 1 && typeof matches[0].value === "string" ? matches[0].value.trim() : null;
}
export function normalizeGreenhouse(row, source) {
  const collected = collectReviewFacts(row, source);
  const { facts: reviewFacts, description } = collected;
  const issues = [...collected.issues], evidence = [];
  const reject = reason => ({ candidate: null, issues: [...new Set([reason, ...issues, ...collected.blocking])], evidence, reviewFacts });
  if (!row || !Number.isSafeInteger(row.id) || row.id <= 0) return reject("INVALID_POSTING_ID");
  if (!Number.isSafeInteger(row.internal_job_id) || row.internal_job_id <= 0 || /general\s+(?:interest|application)|talent\s+(?:pool|community)|expression\s+of\s+interest/i.test(row.title || "")) return reject("PROSPECT_OR_GENERAL_INTEREST");
  if (typeof row.title !== "string" || !row.title.trim() || row.title.length > 240) return reject("INVALID_TITLE");
  const rawSubtype = metadata(row, source.subtypeField);
  let subtype = rawSubtype && Object.hasOwn(source.subtypeMappings, rawSubtype) ? source.subtypeMappings[rawSubtype] : null;
  if (JOB_SUBTYPES.includes(subtype)) evidence.push({ field: "subtype", sourceField: `metadata:${source.subtypeField}`, value: rawSubtype });
  // Fixed vocabulary, reviewed per source. No arbitrary configured regex or
  // global title heuristic. Conflicting/malformed metadata is not overridden.
  const subtypeFields = (Array.isArray(row.metadata) ? row.metadata : []).filter(item => item?.name === source.subtypeField);
  const absent = (row.metadata == null || Array.isArray(row.metadata)) &&
    (subtypeFields.length === 0 || (subtypeFields.length === 1 && subtypeFields[0].value == null));
  if (!subtype && absent && reviewedRules(source).titleInternship === true &&
      /(?:^|[^\p{L}\p{N}_])intern(?:ship)?(?:$|[^\p{L}\p{N}_])/iu.test(row.title) &&
      !/\b(?:or|not|non|no|former|intern(?:ship)?[- ](?:program[- ])?(?:managers?|coordinators?|recruiters?|supervisors?)|full[- ]time|part[- ]time|freelance)\b/i.test(row.title)) {
    subtype = "internship";
    evidence.push({ field: "subtype", sourceField: "title", value: row.title, rule: "standalone-internship-title-v1", source: source.key });
  }
  if (!JOB_SUBTYPES.includes(subtype)) return reject("SUBTYPE_REQUIRES_REVIEW");
  if (collected.blocking.length) return reject(collected.blocking[0]);
  const url = reviewFacts.canonicalUrl;
  const locations = reviewFacts.locations;
  const loc = locations.length === 1 ? locations[0] : null;
  if (locations.length > 1) issues.push("MULTI_LOCATION_REQUIRES_REVIEW");
  if (!loc?.country || !loc?.city) issues.push("LOCATION_UNKNOWN");
  const rawWork = metadata(row, source.workModeField);
  const workModes = { remote: "remote", hybrid: "hybrid", onsite: "onsite", "on-site": "onsite", flexible: "flexible" };
  const workMode = Object.hasOwn(workModes, rawWork?.toLowerCase()) ? workModes[rawWork.toLowerCase()] : null;
  if (!workMode) issues.push("WORK_MODE_UNKNOWN");
  let deadline = null;
  if (row.application_deadline != null) {
    if (typeof row.application_deadline !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.application_deadline) || !Number.isFinite(Date.parse(row.application_deadline))) return reject("AMBIGUOUS_DEADLINE");
    deadline = new Date(row.application_deadline).toISOString();
    evidence.push({ field: "deadline_at", sourceField: "application_deadline" });
  }
  return { candidate: { type: "job", subtype, title: row.title.trim(), organization: source.employer, description,
    source: source.key, source_type: source.developmentOnly ? "fixture" : "employer", source_item_id: String(row.id), url,
    country: loc?.country ?? null, city: loc?.city ?? null, work_mode: workMode,
    role_tags: [], sector_tags: [], skill_tags: [], eligibility: {}, requirements: {},
    deadline_at: deadline, starts_at: null, ends_at: null,
    published: false, active: false, verification_status: "unverified", last_verified_at: null, expires_at: null }, evidence, reviewFacts, issues };
}

export function validateCandidate(row) {
  if (!row || row.type !== "job" || !JOB_SUBTYPES.includes(row.subtype) || !row.title || row.title.length > 240 ||
    !row.source || row.source.length > 160 || !row.source_item_id || row.source_item_id.length > 240 ||
    row.description.length > 12000 || row.organization.length > 240 || row.published !== false || row.active !== false || row.verification_status !== "unverified") throw new Error("INVALID_CANDIDATE");
  return row;
}
