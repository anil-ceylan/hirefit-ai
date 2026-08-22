export function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function normalizeId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function metric(value, status, sampleSize = 0) {
  return { value, status, sampleSize };
}

export function severityRank(severity) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity] || 0;
}

export function highestSeverity(items = []) {
  return asArray(items).sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]?.severity || "none";
}

export function stableHash(input) {
  const stable = (value) => {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(stable);
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  };
  const text = typeof input === "string" ? input : JSON.stringify(stable(input));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function anonymizeId(value, prefix = "anon") {
  if (!value) return null;
  return `${prefix}_${stableHash(String(value))}`;
}
