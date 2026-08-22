import { asArray } from "../utils.js";

export function filterInspectorData(value = {}) {
  const clone = JSON.parse(JSON.stringify(value || {}));
  delete clone.normalizedInput;
  delete clone.debugTrace;
  if (clone.shadowResult?.normalizedInput) delete clone.shadowResult.normalizedInput;
  if (clone.shadowResult?.debugTrace) delete clone.shadowResult.debugTrace;
  if (clone.shadowResult?.evidenceIntelligence?.evidenceObjects) {
    clone.shadowResult.evidenceIntelligence.evidenceObjects = asArray(clone.shadowResult.evidenceIntelligence.evidenceObjects).map((item) => ({
      id: item.id,
      type: item.type,
      source: item.source,
      source_type: item.source_type,
      competencies: item.competencies,
      quality: item.quality,
      trust: item.trust,
      strength: item.strength,
    }));
  }
  return clone;
}
