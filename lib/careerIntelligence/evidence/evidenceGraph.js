function node(id, type, data = {}) {
  return { id, type, data };
}

function edge(from, to, type, data = {}) {
  return { from, to, type, data };
}

function addNode(nodes, item) {
  if (!item?.id) return;
  nodes.set(item.id, item);
}

function competencyId(competency) {
  return `competency:${competency}`;
}

function roleId(role) {
  return `role:${String(role || "unknown").toLowerCase().replace(/\s+/g, "_")}`;
}

export function buildEvidenceGraph(evidenceItems = [], { roles = [], goals = [] } = {}) {
  const nodes = new Map();
  const edges = [];
  for (const evidence of evidenceItems) {
    addNode(nodes, node(evidence.id, "evidence", {
      title: evidence.title,
      category: evidence.category,
      source: evidence.source,
      source_type: evidence.source_type,
      strength: evidence.strength,
      trust: evidence.trust,
      freshness: evidence.freshness,
      quality: evidence.quality,
    }));
    for (const competency of evidence.competencies || []) {
      const id = competencyId(competency);
      addNode(nodes, node(id, "competency", { competency }));
      edges.push(edge(evidence.id, id, "supports_competency", {
        strength: evidence.strength,
        confidence: evidence.confidence,
        quality: evidence.quality,
      }));
    }
    if (evidence.role_context) {
      const id = roleId(evidence.role_context);
      addNode(nodes, node(id, "role", { role: evidence.role_context }));
      edges.push(edge(evidence.id, id, "supports_role_context", { relevance: evidence.roleRelevance || evidence.normalized_weight }));
    }
  }
  for (const role of roles) {
    addNode(nodes, node(roleId(role), "role", { role }));
  }
  for (const goal of goals) {
    const id = `goal:${String(goal).toLowerCase().replace(/\s+/g, "_")}`;
    addNode(nodes, node(id, "career_goal", { goal }));
  }
  return {
    nodes: [...nodes.values()],
    edges,
    getEvidenceForCompetency(competency) {
      const id = competencyId(competency);
      const evidenceIds = edges.filter((item) => item.to === id && item.type === "supports_competency").map((item) => item.from);
      return evidenceItems.filter((item) => evidenceIds.includes(item.id));
    },
    getCompetenciesForEvidence(evidenceId) {
      return edges
        .filter((item) => item.from === evidenceId && item.type === "supports_competency")
        .map((item) => item.to.replace(/^competency:/, ""));
    },
  };
}
