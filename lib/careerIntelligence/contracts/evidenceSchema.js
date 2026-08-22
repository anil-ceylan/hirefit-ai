import { EVIDENCE_SCHEMA_VERSION } from "./contractVersions.js";
import { requireString, validationResult } from "./contractValidation.js";

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toNullableNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function toEvidenceContract(item = {}) {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    id: String(item.id || "").trim(),
    sourceType: item.source_type || item.sourceType || "",
    sourceId: item.sourceId || item.source_id || item.source || null,
    category: item.category || item.type || "",
    competencies: asArray(item.competencies),
    claimType: item.claimType || (item.metadata?.explicitClaim ? "self_claim" : "observed"),
    textSummary: item.textSummary || item.title || item.description || "",
    strength: toNullableNumber(item.strength),
    trust: toNullableNumber(item.trust),
    freshness: toNullableNumber(item.freshness),
    quality: toNullableNumber(item.quality),
    redundancyScore: toNullableNumber(item.redundancyScore),
    sourceMetadata: {
      origin: item.source || item.sourceMetadata?.origin || "",
      section: item.metadata?.sourcePath || item.sourceMetadata?.section || null,
      traceable: Boolean(item.source || item.source_type || item.sourceMetadata?.traceable),
    },
    timestamps: {
      occurredAt: item.occurred_at || item.occurredAt || null,
      collectedAt: item.collected_at || item.created_at || item.collectedAt || null,
    },
  };
}

export function validateEvidenceContract(item = {}) {
  const errors = [];
  const warnings = [];
  if (item.schemaVersion !== EVIDENCE_SCHEMA_VERSION) {
    errors.push({ path: "schemaVersion", code: "INVALID_SCHEMA_VERSION" });
  }
  requireString(item.id, "id", errors);
  requireString(item.sourceType, "sourceType", errors);
  if (!item.sourceMetadata?.traceable) errors.push({ path: "sourceMetadata.traceable", code: "SOURCE_NOT_TRACEABLE" });
  if (!["observed", "self_claim", "derived"].includes(item.claimType)) {
    errors.push({ path: "claimType", code: "INVALID_CLAIM_TYPE" });
  }
  if (!Array.isArray(item.competencies)) warnings.push({ path: "competencies", code: "EXPECTED_ARRAY" });
  if (!item.textSummary) warnings.push({ path: "textSummary", code: "MISSING_TEXT_SUMMARY" });
  return validationResult({ errors, warnings });
}
