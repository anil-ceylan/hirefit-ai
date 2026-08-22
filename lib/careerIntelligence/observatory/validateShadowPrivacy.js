const PII_FIELD_RE = /(email|phone|full.?name|first.?name|last.?name|password|cv.?text|raw.?cv|rawText|personal.?statement)/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s().-]*){9,}/;

function walk(value, path = "", violations = []) {
  if (value == null) return violations;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, violations));
    return violations;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (PII_FIELD_RE.test(key)) violations.push({ path: nextPath, code: "PII_FIELD_NAME" });
      walk(child, nextPath, violations);
    }
    return violations;
  }
  if (typeof value === "string") {
    if (EMAIL_RE.test(value)) violations.push({ path, code: "EMAIL_VALUE" });
    if (PHONE_RE.test(value)) violations.push({ path, code: "PHONE_VALUE" });
  }
  return violations;
}

export function validateShadowPrivacy(value = {}) {
  const violations = walk(value);
  return {
    passed: violations.length === 0,
    violations,
  };
}
