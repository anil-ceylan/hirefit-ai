function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function snapshotCompetencies(snapshot = {}) {
  return snapshot.confidenceByCompetency || snapshot.reasoning?.confidenceByCompetency || {};
}

export function buildReasoningMemory(history = []) {
  const snapshots = asArray(history).map((item, index) => ({
    id: item.id || `memory:${index}`,
    occurred_at: item.occurred_at || item.created_at || item.date || "",
    confidenceByCompetency: snapshotCompetencies(item),
    evidenceCount: item.evidenceObjectCount || item.evidenceObjects?.length || item.reasoning?.evidenceObjectCount || 0,
    decisionConfidence: item.decisionConfidence || item.reasoning?.topRecommendation?.decisionConfidence || null,
  }));
  const latest = snapshots[snapshots.length - 1] || null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  return {
    snapshots,
    latest,
    previous,
    hasHistory: snapshots.length > 0,
  };
}

export function compareReasoningMemory(memory = {}) {
  const latest = memory.latest;
  const previous = memory.previous;
  if (!latest || !previous) {
    return {
      hasDelta: false,
      deltas: [],
    };
  }
  const competencies = new Set([
    ...Object.keys(previous.confidenceByCompetency || {}),
    ...Object.keys(latest.confidenceByCompetency || {}),
  ]);
  const deltas = [...competencies].map((competency) => {
    const before = previous.confidenceByCompetency?.[competency]?.confidence || previous.confidenceByCompetency?.[competency] || 0;
    const after = latest.confidenceByCompetency?.[competency]?.confidence || latest.confidenceByCompetency?.[competency] || 0;
    return {
      competency,
      before,
      after,
      delta: Math.round(after - before),
    };
  }).filter((item) => item.delta !== 0);
  return {
    hasDelta: deltas.length > 0,
    deltas: deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  };
}
