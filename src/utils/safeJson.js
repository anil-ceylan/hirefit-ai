function logParseIssue(label, error) {
  console.error(`[${label}] JSON parse failed:`, error?.message || error);
}

export function safeJsonParse(input, fallback, options = {}) {
  const label = options?.label || "safeJsonParse";
  if (typeof input !== "string") return fallback;
  const text = input.trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    logParseIssue(label, error);
    return fallback;
  }
}

export function parseLocalStorageJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === "") return fallback;
    return safeJsonParse(raw, fallback, { label: `localStorage:${key}` });
  } catch (error) {
    logParseIssue(`localStorage:${key}`, error);
    return fallback;
  }
}
