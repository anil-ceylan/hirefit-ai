import { SOURCE_TYPES } from "./evidenceTypes.js";
import { normalizeEvidenceList } from "./normalizeEvidence.js";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === "") return [];
  return [value];
}

function sourceTypeFor(sourceType) {
  if (sourceType) return sourceType;
  return SOURCE_TYPES.CAREER_SNAPSHOT;
}

function fromCoreRecord(record, context = {}) {
  return {
    id: record.id,
    type: record.type || "legacy_core_record",
    title: record.claim || record.type || "Evidence",
    description: record.claim || "",
    source: record.source?.id || "core_intelligence",
    source_type: record.source?.kind || SOURCE_TYPES.IMPORTED,
    occurred_at: record.occurredYear || "",
    role_context: context.role_context || record.role_context || "",
    skills: record.dimensions || [],
    metrics: record.metadata?.metrics || [],
    confidence: record.effectiveWeight,
    raw_weight: record.effectiveWeight ? record.effectiveWeight * 100 : null,
  };
}

function fromSignal(signal, context = {}) {
  const text = typeof signal === "string"
    ? signal
    : signal?.title || signal?.label || signal?.name || signal?.text || signal?.reason || "";
  return {
    type: "legacy_signal",
    title: text,
    description: text,
    source: context.source || "career_snapshot",
    source_type: sourceTypeFor(context.source_type),
    role_context: context.role_context || "",
  };
}

export function adaptLegacyEvidence(input, context = {}) {
  const rows = asArray(input).map((item) => {
    if (item?.claim || item?.source?.kind || item?.occurredYear) return fromCoreRecord(item, context);
    return typeof item === "string" ? fromSignal(item, context) : item;
  });
  return normalizeEvidenceList(rows, context);
}

export function evidenceFromCareerProfile(profile = {}, { lang = "TR" } = {}) {
  const snapshot = profile?.career_snapshot || profile?.career_gps?.snapshot || {};
  const primaryMatch = snapshot.primaryRoleMatch || snapshot.topRoleMatches?.[0] || snapshot.roleMatches?.[0] || {};
  const roleContext = primaryMatch.roleFamily || primaryMatch.roleName || snapshot.targetRole || profile.target_roles?.[0] || "";
  const records = [];

  if (snapshot.coreIntelligence?.evidence?.records) {
    records.push(...snapshot.coreIntelligence.evidence.records.map((record) => fromCoreRecord(record, { role_context: roleContext })));
  }

  for (const signal of asArray(primaryMatch.strongSignals)) {
    records.push(fromSignal(signal, { role_context: roleContext, source: "role_match", source_type: SOURCE_TYPES.CAREER_SNAPSHOT }));
  }
  for (const signal of asArray(primaryMatch.missingSignals)) {
    records.push({
      type: "missing_role_proof",
      title: signal,
      description: `Missing proof: ${signal}`,
      source: "role_match",
      source_type: SOURCE_TYPES.CAREER_SNAPSHOT,
      role_context: roleContext,
    });
  }
  if (snapshot.gapDetails?.title) {
    records.push({
      type: "primary_evidence_gap",
      title: snapshot.gapDetails.title,
      description: snapshot.gapDetails.evidenceMissing || snapshot.gapDetails.whyItMatters || snapshot.gapDetails.title,
      source: "career_snapshot",
      source_type: SOURCE_TYPES.CAREER_SNAPSHOT,
      role_context: roleContext,
    });
  }
  for (const signal of asArray(snapshot.recruiterView?.strongEvidence)) {
    records.push(fromSignal(signal, { role_context: roleContext, source: "recruiter_view", source_type: SOURCE_TYPES.CAREER_SNAPSHOT }));
  }
  if (snapshot.strongestSignal) {
    records.push(fromSignal(snapshot.strongestSignal, { role_context: roleContext, source: "career_snapshot", source_type: SOURCE_TYPES.CAREER_SNAPSHOT }));
  }
  if (profile.basic_profile?.cvFileName || profile.basic_profile?.cvStatus === "analyzed") {
    records.push({
      type: "cv_source",
      title: profile.basic_profile.cvStatus === "analyzed" ? "CV analyzed" : "CV uploaded",
      description: profile.basic_profile.cvFileName || "CV evidence source exists",
      source: "cv",
      source_type: SOURCE_TYPES.CV,
      role_context: roleContext,
    });
  }
  if (profile.basic_profile?.portfolioUrl || profile.portfolioUrl) {
    records.push({
      type: "portfolio_source",
      title: "Portfolio link",
      description: profile.basic_profile?.portfolioUrl || profile.portfolioUrl,
      source: "portfolio",
      source_type: SOURCE_TYPES.PORTFOLIO,
      role_context: roleContext,
    });
  }

  return normalizeEvidenceList(records, { role_context: roleContext, lang });
}
