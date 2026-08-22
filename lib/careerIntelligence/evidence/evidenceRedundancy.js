import { clampScore } from "./evidenceTypes.js";

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(item) {
  const text = norm(`${item?.category || ""} ${(item?.competencies || []).join(" ")} ${item?.title || ""} ${item?.description || ""}`);
  return new Set(text.split(/\s+/).filter((token) => token.length > 2));
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function calculateEvidenceRedundancy(evidenceItems = [], { duplicateThreshold = 0.78, complementaryThreshold = 0.42 } = {}) {
  const rows = evidenceItems.map((item) => ({ item, tokens: tokens(item) }));
  const groups = [];
  const scores = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    let maxSimilarity = 0;
    const duplicates = [];
    const complementary = [];
    for (let j = 0; j < rows.length; j += 1) {
      if (i === j) continue;
      const similarity = jaccard(rows[i].tokens, rows[j].tokens);
      maxSimilarity = Math.max(maxSimilarity, similarity);
      if (similarity >= duplicateThreshold) duplicates.push(rows[j].item.id);
      if (similarity >= complementaryThreshold && similarity < duplicateThreshold) complementary.push(rows[j].item.id);
    }
    const redundancyScore = clampScore(maxSimilarity * 100);
    scores.set(rows[i].item.id, {
      redundancyScore,
      duplicateEvidenceIds: duplicates,
      complementaryEvidenceIds: complementary,
    });
    if (duplicates.length) groups.push([rows[i].item.id, ...duplicates]);
  }
  return {
    itemRedundancy: Object.fromEntries(scores.entries()),
    duplicateGroups: groups,
    duplicateCount: groups.length,
  };
}
