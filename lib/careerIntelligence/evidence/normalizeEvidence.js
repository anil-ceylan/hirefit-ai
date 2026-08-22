import { DEFAULT_EVIDENCE_ITEM, SOURCE_TYPES } from "./evidenceTypes.js";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === "") return [];
  return [value];
}

function normalizeText(value, max = 280) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stableHash(value) {
  let result = 5381;
  for (const char of String(value || "")) result = ((result << 5) + result) ^ char.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function normalizeSourceType(value) {
  const text = String(value || "").toLowerCase();
  if (/cv|resume/.test(text)) return SOURCE_TYPES.CV;
  if (/linkedin/.test(text)) return SOURCE_TYPES.LINKEDIN;
  if (/portfolio|case/.test(text)) return SOURCE_TYPES.PORTFOLIO;
  if (/github|repo/.test(text)) return SOURCE_TYPES.GITHUB;
  if (/dna|readiness/.test(text)) return SOURCE_TYPES.CAREER_DNA;
  if (/snapshot/.test(text)) return SOURCE_TYPES.CAREER_SNAPSHOT;
  if (/user|self|statement/.test(text)) return SOURCE_TYPES.USER_STATEMENT;
  if (/import/.test(text)) return SOURCE_TYPES.IMPORTED;
  return value || SOURCE_TYPES.UNKNOWN;
}

function normalizeMetrics(metrics, description) {
  const metricList = asArray(metrics).map((metric) => normalizeText(metric, 80)).filter(Boolean);
  const text = String(description || "");
  const numeric = text.match(/\b\d+(?:[.,]\d+)?\s*(?:%|x|k|m|users?|customers?|clients?|hours?|days?|weeks?|months?|tl|usd|eur)?\b/gi) || [];
  return [...new Set([...metricList, ...numeric.map((x) => x.trim())])].slice(0, 8);
}

export function normalizeEvidenceItem(input, context = {}) {
  const item = typeof input === "string"
    ? { title: input, description: input, source_type: context.source_type || SOURCE_TYPES.USER_STATEMENT }
    : { ...(input || {}) };
  const title = normalizeText(item.title || item.name || item.claim || item.label || item.type || "Evidence", 120);
  const description = normalizeText(
    item.description || item.details || item.reason || item.claim || item.evidence || item.text || title,
    320
  );
  const sourceType = normalizeSourceType(item.source_type || item.source?.kind || item.sourceType || context.source_type);
  const source = normalizeText(item.source || item.source?.id || item.sourceId || sourceType, 120);
  const roleContext = normalizeText(item.role_context || item.roleContext || item.role || context.role_context, 120);
  const normalized = {
    ...DEFAULT_EVIDENCE_ITEM,
    ...item,
    id: item.id || `ev_${stableHash(`${title}|${description}|${source}|${roleContext}`)}`,
    type: normalizeText(item.type || "generic", 80),
    title,
    description,
    source,
    source_type: sourceType,
    created_at: item.created_at || item.createdAt || context.created_at || "",
    occurred_at: item.occurred_at || item.occurredAt || item.occurredYear || item.occurred_year || "",
    role_context: roleContext,
    skills: asArray(item.skills).map((x) => normalizeText(x, 60)),
    domains: asArray(item.domains).map((x) => normalizeText(x, 60)),
    metrics: normalizeMetrics(item.metrics, description),
    ownership_level: normalizeText(item.ownership_level || item.ownershipLevel || item.ownership || "", 80),
    confidence: item.confidence == null ? null : Number(item.confidence),
    raw_weight: item.raw_weight == null ? null : Number(item.raw_weight),
    normalized_weight: item.normalized_weight == null ? null : Number(item.normalized_weight),
    quality_breakdown: item.quality_breakdown || item.qualityBreakdown || {},
    contradictions: asArray(item.contradictions),
    missing_fields: asArray(item.missing_fields || item.missingFields),
  };
  return normalized;
}

export function normalizeEvidenceList(input, context = {}) {
  return asArray(input).map((item) => normalizeEvidenceItem(item, context));
}
