function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validationResult({ errors = [], warnings = [] } = {}) {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function requireString(value, path, errors) {
  if (typeof value !== "string" || !value.trim()) errors.push({ path, code: "REQUIRED_STRING" });
}

export function requireArray(value, path, errors) {
  if (!Array.isArray(value)) errors.push({ path, code: "REQUIRED_ARRAY" });
}

export function warnWhenPresent(value, path, warnings, code = "UNSAFE_FIELD_PRESENT") {
  if (value != null && value !== "") warnings.push({ path, code });
}

export function mergeContractResults(results = []) {
  const items = asArray(results);
  return validationResult({
    errors: items.flatMap((item) => asArray(item.errors)),
    warnings: items.flatMap((item) => asArray(item.warnings)),
  });
}
