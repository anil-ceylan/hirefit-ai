import { DEFAULT_ROLE_EVIDENCE_WEIGHTS } from "./evidenceConfig.js";

export const ROLE_FAMILY_ALIASES = Object.freeze({
  product: "PRODUCT",
  pm: "PRODUCT",
  operations: "OPERATIONS",
  ops: "OPERATIONS",
  strategy: "BUSINESS",
  business: "BUSINESS",
  consulting: "BUSINESS",
  analyst: "BUSINESS",
  data: "DATA",
  analytics: "DATA",
  software: "SOFTWARE",
  engineering: "SOFTWARE",
  growth: "MARKETING",
  marketing: "MARKETING",
  hr: "HR",
  people: "HR",
  finance: "FINANCE",
});

export function normalizeRoleFamily(roleContext = "") {
  const raw = String(roleContext || "").trim();
  const direct = raw.toUpperCase();
  if (DEFAULT_ROLE_EVIDENCE_WEIGHTS[direct]) return direct;
  const lower = raw.toLowerCase();
  const match = Object.entries(ROLE_FAMILY_ALIASES).find(([key]) => lower.includes(key));
  return match?.[1] || "default";
}

export function getRoleEvidenceWeights(roleContext = "", overrides = {}) {
  const family = normalizeRoleFamily(roleContext);
  return {
    ...(DEFAULT_ROLE_EVIDENCE_WEIGHTS.default || {}),
    ...(DEFAULT_ROLE_EVIDENCE_WEIGHTS[family] || {}),
    ...(overrides[family] || overrides.default || {}),
  };
}
