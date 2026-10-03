import { JOB_SUBTYPES } from "../constants.js";

// No employer is pre-approved. Operators supply reviewed JSON, never executable modules.
export const SOURCES = Object.freeze([]);
export const DEFAULT_LIMITS = Object.freeze({ timeoutMs: 8000, maxBytes: 2000000, retries: 1, redirects: 2, maxPages: 1 });
const object = value => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max = 240) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
export function scopeApproved(scope) {
  return object(scope) && scope.status === "approved" && text(scope.reference, 1000) &&
    text(scope.reviewedBy) && Number.isFinite(Date.parse(scope.reviewedAt)) && Date.parse(scope.reviewedAt) <= Date.now();
}
export function validateSource(input, { live = false } = {}) {
  if (!object(input) || input.adapter !== "greenhouse" || !text(input.key, 160) ||
      !/^[a-z0-9:_-]+$/.test(input.key) || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.board || "") ||
      !text(input.employer, 240)) throw new Error("INVALID_SOURCE_IDENTITY");
  const source = { ...input, enabled: input.enabled === true, limits: { ...DEFAULT_LIMITS, ...input.limits },
    freshnessHours: input.freshnessHours ?? 48, maxImportSize: input.maxImportSize ?? 100 };
  // Never migrate a legacy broad approval into either explicit scope.
  if (input.permission?.status !== undefined) throw new Error("LEGACY_PERMISSION_REQUIRES_SCOPE_REVIEW");
  source.permission = { ...input.permission };
  for (const name of ["technicalFetch", "republication"]) {
    const scope = input.permission?.[name] ?? { status: "unreviewed" };
    if (!object(scope) || !["unreviewed", "approved", "denied"].includes(scope.status) ||
        (scope.status === "approved" && !scopeApproved(scope)) ||
        (scope.notes !== undefined && !text(scope.notes, 2000))) throw new Error("INVALID_PERMISSION_SCOPE");
    source.permission[name] = { ...scope };
  }
  if (source.employerKey !== undefined && (!text(source.employerKey, 160) || !/^[a-z0-9:_-]+$/.test(source.employerKey))) throw new Error("INVALID_EMPLOYER_KEY");
  if (source.evidenceRules !== undefined) {
    const rules = source.evidenceRules;
    if (!object(rules) || rules.sourceKey !== source.key || !scopeApproved(rules) ||
        ["titleInternship", "statements"].some(key => rules[key] !== undefined && typeof rules[key] !== "boolean")) throw new Error("INVALID_SOURCE_EVIDENCE_RULES");
    if (rules.locationLabels !== undefined && (!object(rules.locationLabels) || Object.keys(rules.locationLabels).length > 100 ||
        Object.entries(rules.locationLabels).some(([raw, labels]) => !text(raw, 2400) || !Array.isArray(labels) || !labels.length || labels.length > 10 || labels.some(label => !text(label, 240))))) throw new Error("INVALID_LOCATION_EVIDENCE_RULES");
  }
  if (!Array.isArray(source.permittedHosts) || !source.permittedHosts.length || source.permittedHosts.length > 20 ||
      source.permittedHosts.some(host => typeof host !== "string" || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(host))) throw new Error("INVALID_HOST_ALLOWLIST");
  for (const [key, ceiling] of Object.entries({ timeoutMs: 15000, maxBytes: 5000000, retries: 2, redirects: 3, maxPages: 1 })) {
    const value = source.limits[key];
    if (!Number.isInteger(value) || value < (["retries", "redirects"].includes(key) ? 0 : 1) || value > ceiling) throw new Error("INVALID_REQUEST_LIMIT");
  }
  if (!Number.isInteger(source.maxImportSize) || source.maxImportSize < 1 || source.maxImportSize > 200 ||
      !Number.isInteger(source.freshnessHours) || source.freshnessHours < 1 || source.freshnessHours > 72) throw new Error("INVALID_IMPORT_LIMIT");
  if (!object(source.subtypeMappings) || Object.entries(source.subtypeMappings).some(([label, subtype]) => !text(label, 80) || !JOB_SUBTYPES.includes(subtype))) throw new Error("INVALID_SUBTYPE_MAPPING");
  // Only exact, reviewed source metadata labels can populate these fields.
  if (!text(source.subtypeField, 80)) throw new Error("INVALID_METADATA_FIELD");
  if (source.workModeField !== undefined && !text(source.workModeField, 80)) throw new Error("INVALID_METADATA_FIELD");
  if (source.locationMappings !== undefined && (!object(source.locationMappings) || Object.entries(source.locationMappings).some(([label, loc]) =>
    !text(label, 240) || !object(loc) || !/^[A-Z]{2}$/.test(loc.country || "") || !text(loc.city, 160)))) throw new Error("INVALID_LOCATION_MAPPING");
  if (live) {
    if (!source.enabled || !scopeApproved(source.permission.technicalFetch) ||
        !text(source.attribution, 1000) || !text(source.retentionNotes, 1000)) throw new Error("SOURCE_NOT_APPROVED");
    if (source.developmentOnly || /fixture|demo|example|test/i.test(`${source.key} ${source.board} ${source.employer}`) ||
        source.permittedHosts.some(host => /(?:^|\.)(?:invalid|test|localhost|example\.com)$/.test(host))) throw new Error("DEVELOPMENT_SOURCE_FORBIDDEN");
    if (!source.permittedHosts.includes("boards-api.greenhouse.io")) throw new Error("GREENHOUSE_HOST_NOT_ALLOWED");
  }
  return source;
}
