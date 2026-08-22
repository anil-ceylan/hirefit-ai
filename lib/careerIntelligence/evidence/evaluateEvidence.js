import {
  CONTRADICTION_RULES,
  EVIDENCE_FACTOR_WEIGHTS,
  EVIDENCE_WEIGHT_MATRIX,
  REQUIRED_EVIDENCE_FIELDS,
} from "./evidenceConfig.js";
import { clampScore, scoreBand } from "./evidenceTypes.js";
import { normalizeEvidenceItem } from "./normalizeEvidence.js";
import { getRoleEvidenceWeights } from "./roleEvidenceWeights.js";

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function yearsAgo(value, now = new Date()) {
  const text = String(value || "");
  const year = Number((text.match(/\b(19|20)\d{2}\b/) || [])[0]);
  if (!Number.isFinite(year)) return null;
  return Math.max(0, now.getFullYear() - year);
}

function categoryScore(matrixKey, category) {
  const matrix = EVIDENCE_WEIGHT_MATRIX[matrixKey] || {};
  return matrix[category] ?? matrix.unknown ?? 0;
}

function inferStrength(item) {
  const text = norm(`${item.type} ${item.title} ${item.description}`);
  if (/missing|gap|eksik|açık|acik/.test(norm(item.type))) return "weak_signal";
  if (item.metrics.length || /increased|reduced|launched|shipped|saved|grew|deployed|users?|revenue|gelir|canliya|yayina/.test(text)) {
    return "verified_outcome";
  }
  if (/owned|led|built|delivered|managed|primary|end-to-end|kurucu|sahip|yonett|gelistird/.test(text)) return "strong_signal";
  if (/project|case|intern|staj|dashboard|analysis|portfolio|github/.test(text)) return "moderate_signal";
  return "weak_signal";
}

function inferRelevance(item) {
  const text = norm(`${item.type} ${item.title} ${item.description}`);
  const role = norm(item.role_context);
  if (!role) return "generic";
  if (text.includes(role) || role.split(/\s+/).some((part) => part.length > 4 && text.includes(part))) return "target_role_specific";
  if (/product|strategy|operations|data|software|marketing|finance|hr|business|growth|analytics/.test(`${text} ${role}`)) return "directly_role_relevant";
  return "role_adjacent";
}

function inferRecency(item, now) {
  const age = yearsAgo(item.occurred_at, now);
  if (age == null) return "unknown";
  if (age <= 1) return "current";
  if (age <= 3) return "recent";
  if (age <= 6) return "still_relevant";
  return "old";
}

function inferSpecificity(item) {
  const text = `${item.title} ${item.description}`;
  if (/missing|gap|eksik|açık|acik/.test(norm(item.type))) return "contextual_claim";
  if (item.metrics.length) return "quantified_result";
  if (text.length >= 80 || /problem|decision|result|stakeholder|customer|user|workflow|metric/i.test(text)) return "concrete_example";
  if (text.length >= 35) return "contextual_claim";
  return "vague_claim";
}

function inferCredibility(item) {
  if (/missing|gap|eksik|açık|acik/.test(norm(item.type))) return "self_asserted";
  if (["github", "portfolio", "linkedin"].includes(item.source_type)) return "externally_verifiable";
  if (item.source_type === "cv" && item.metrics.length) return "supported_by_context";
  if (item.source_type === "cv") return "internally_consistent";
  if (item.confidence != null && item.confidence >= 0.7) return "supported_by_context";
  return "self_asserted";
}

function inferOwnership(item) {
  const text = norm(`${item.ownership_level} ${item.title} ${item.description}`);
  if (/end-to-end|end to end|founder|kurucu|owned|sahip/.test(text)) return "end_to_end_owner";
  if (/led|lead|managed|primary|yonett|lider/.test(text)) return "primary_owner";
  if (/contributed|supported|assisted|helped|destek/.test(text)) return "contributor";
  return item.ownership_level ? "assisted" : "unknown";
}

function inferOutcome(item) {
  const text = norm(`${item.title} ${item.description}`);
  if (/missing|gap|eksik|açık|acik/.test(norm(item.type))) return "no_result";
  if (item.metrics.length && /revenue|user|customer|conversion|retention|saved|reduced|increased|gelir|musteri|kullanici/.test(text)) {
    return "business_or_user_impact";
  }
  if (item.metrics.length) return "measurable_result";
  if (/launched|shipped|delivered|published|tamamlad|yayina|canliya/.test(text)) return "qualitative_result";
  return "no_result";
}

function inferRoleAlignment(item) {
  const relevance = inferRelevance(item);
  if (relevance === "target_role_specific") return "specific";
  if (relevance === "directly_role_relevant") return "relevant";
  if (relevance === "role_adjacent") return "adjacent";
  return "unrelated";
}

function missingFields(item) {
  return REQUIRED_EVIDENCE_FIELDS.filter((field) => {
    if (field === "source_type") return !item.source_type || item.source_type === "unknown";
    return !item[field];
  });
}

function weightedAverage(factors, roleWeights) {
  let totalWeight = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(EVIDENCE_FACTOR_WEIGHTS)) {
    const multiplier = roleWeights[key] || 1;
    const finalWeight = weight * multiplier;
    totalWeight += finalWeight;
    total += (factors[key] || 0) * finalWeight;
  }
  return totalWeight ? total / totalWeight : 0;
}

export function evaluateEvidence(input, { roleContext = "", now = new Date(), roleWeights = {} } = {}) {
  const item = normalizeEvidenceItem(input, { role_context: roleContext });
  const factorCategories = {
    strength: inferStrength(item),
    relevance: inferRelevance(item),
    recency: inferRecency(item, now),
    specificity: inferSpecificity(item),
    credibility: inferCredibility(item),
    ownership: inferOwnership(item),
    measurable_outcome: inferOutcome(item),
    role_alignment: inferRoleAlignment(item),
    source_quality: item.source_type,
  };
  const factors = Object.fromEntries(
    Object.entries(factorCategories).map(([key, category]) => [key, categoryScore(key, category)])
  );
  const weights = getRoleEvidenceWeights(roleContext || item.role_context, roleWeights);
  const missing = [...new Set([...missingFields(item), ...(item.missing_fields || [])])];
  const missingPenalty = Math.min(18, missing.length * 3);
  const contradictions = [
    ...(item.contradictions || []),
    ...CONTRADICTION_RULES.filter((rule) => rule.when({ item, factors })).map((rule) => rule.id),
  ];
  const contradictionPenalty = Math.min(24, contradictions.length * 8);
  const raw = weightedAverage(factors, weights);
  const normalized = clampScore(raw - missingPenalty - contradictionPenalty);
  return {
    ...item,
    raw_weight: clampScore(raw),
    normalized_weight: normalized,
    quality_breakdown: {
      factors,
      factor_categories: factorCategories,
      penalties: {
        missing_fields: missingPenalty,
        contradictions: contradictionPenalty,
      },
    },
    contradictions,
    missing_fields: missing,
    quality_band: scoreBand(normalized),
  };
}
