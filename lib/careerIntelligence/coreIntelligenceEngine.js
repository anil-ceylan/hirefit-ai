import { EVIDENCE_DIMENSIONS, clampEvidence, emptyEvidence } from "./evidenceDimensions.js";
import { createEvidenceConfig } from "./evidenceConfig.js";
import { detectSignals, extractEvidence } from "./evidenceExtraction.js";

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function roleFamilyName(value) {
  const family = String(value || "BUSINESS").toUpperCase();
  return ["PRODUCT", "OPERATIONS", "BUSINESS", "DATA", "SOFTWARE", "MARKETING", "HR", "FINANCE"].includes(family)
    ? family
    : "BUSINESS";
}

function contextLevel(type, family, config) {
  const role = config.roleContext[roleFamilyName(family)] || {};
  if (role.core?.includes(type)) return "core";
  if (role.supporting?.includes(type)) return "supporting";
  if (["target_role", "self_assessment", "title_claim", "signal_observation"].includes(type)) return "peripheral";
  return "neutral";
}

function recencyLevel(record, now, config) {
  if (!record.occurredYear) return config.recency.established;
  const age = Math.max(0, now.getFullYear() - record.occurredYear);
  if (age <= 1) return config.recency.current;
  if (age <= 3) return config.recency.recent;
  if (age <= 6) return config.recency.established;
  return config.recency.old;
}

function weightEvidence(records, { roleFamily, now, config }) {
  const claimCounts = records.reduce((counts, record) => {
    const key = `${record.source.independentGroup}|${record.fingerprint}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  return records.map((record) => {
    const level = contextLevel(record.type, roleFamily, config);
    const base = config.tierScale[record.tier] || config.tierScale.low;
    const specificity = config.specificityScale[record.specificity] || 1;
    const verification = config.verificationScale[record.verification] || 1;
    const context = config.contextScale[level] || 1;
    const rawRecency = recencyLevel(record, now, config);
    const recency = ["high", "very_high"].includes(record.tier)
      ? Math.max(rawRecency, config.recency.highImpactFloor)
      : rawRecency;
    const claimCount = claimCounts[`${record.source.independentGroup}|${record.fingerprint}`] || 1;
    const duplicateFactor = claimCount > 1
      ? 1 / Math.sqrt(1 + (claimCount - 1) * (1 - config.calibration.duplicateContribution))
      : 1;
    const effectiveWeight = clamp01(base * specificity * verification * context * recency * duplicateFactor);
    return {
      ...record,
      contextLevel: level,
      effectiveWeight,
      weighting: { tier: record.tier, context: level, recencyApplied: rawRecency < 1, duplicateAdjusted: claimCount > 1 },
    };
  });
}

function aggregateDimensions(weightedRecords, config) {
  const evidence = emptyEvidence();
  const support = {};
  for (const dimension of EVIDENCE_DIMENSIONS) {
    const relevant = weightedRecords
      .filter((record) => record.dimensions.includes(dimension))
      .sort((a, b) => b.effectiveWeight - a.effectiveWeight);
    let remaining = 1;
    relevant.slice(0, 6).forEach((record, index) => {
      const positionFactor = index === 0 ? 1 : 1 / (index + 0.75);
      const contribution = clamp01(record.effectiveWeight * config.calibration.dimensionContribution * positionFactor);
      remaining *= 1 - contribution;
    });
    evidence[dimension] = clampEvidence((1 - remaining) * 100);
    support[dimension] = relevant.slice(0, 4).map((record) => record.id);
  }
  return { scores: evidence, support };
}

function buildEvidenceGraph(weightedRecords, config) {
  const edges = [];
  const edgeKeys = new Set();
  const addEdge = (from, to, relation) => {
    if (!from || !to || from.id === to.id) return;
    const key = `${from.id}|${to.id}|${relation}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from: from.id, to: to.id, relation });
  };

  for (const [fromType, toType] of config.graphChains) {
    const fromRecords = weightedRecords.filter((record) => record.type === fromType);
    const toRecords = weightedRecords.filter((record) => record.type === toType);
    for (const from of fromRecords) {
      for (const to of toRecords) addEdge(from, to, "reinforces");
    }
  }

  const groupedByType = weightedRecords.reduce((groups, record) => {
    if (!groups[record.type]) groups[record.type] = [];
    groups[record.type].push(record);
    return groups;
  }, {});
  for (const records of Object.values(groupedByType)) {
    const distinct = records.filter((record, index, rows) =>
      rows.findIndex((other) => other.source.independentGroup === record.source.independentGroup) === index
    );
    for (let index = 0; index < distinct.length - 1; index += 1) {
      if (distinct[index].fingerprint !== distinct[index + 1].fingerprint) {
        addEdge(distinct[index], distinct[index + 1], "corroborates");
      }
    }
  }

  const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const adjacency = edges.reduce((map, edge) => {
    if (!map[edge.from]) map[edge.from] = [];
    map[edge.from].push(edge.to);
    return map;
  }, {});
  const depthFrom = (node, visited = new Set()) => {
    if (visited.has(node)) return 0;
    const nextVisited = new Set(visited);
    nextVisited.add(node);
    return 1 + Math.max(0, ...(adjacency[node] || []).map((next) => depthFrom(next, nextVisited)));
  };
  const depth = weightedRecords.length
    ? Math.max(...weightedRecords.map((record) => depthFrom(record.id)))
    : 0;

  return {
    nodes: weightedRecords.map((record) => ({ id: record.id, type: record.type, sourceGroup: record.source.independentGroup })),
    edges,
    metrics: {
      nodeCount: weightedRecords.length,
      edgeCount: edges.length,
      connectedRatio: weightedRecords.length ? connected.size / weightedRecords.length : 0,
      depth,
      corroborationCount: edges.filter((edge) => edge.relation === "corroborates").length,
    },
  };
}

function requirementStatus(weightedRecords, dimensionScores, roleFamily, config) {
  const requirements = config.roleRequirements[roleFamilyName(roleFamily)] || [];
  return requirements.map((requirement) => {
    const matching = weightedRecords
      .filter((record) => requirement.types.includes(record.type))
      .sort((a, b) => b.effectiveWeight - a.effectiveWeight);
    const typeSupport = matching[0]?.effectiveWeight || 0;
    const dimensionSupport = Math.max(0, ...requirement.dimensions.map((dimension) => (dimensionScores[dimension] || 0) / 100));
    const support = Math.max(typeSupport, dimensionSupport * 0.82);
    return {
      ...requirement,
      support,
      supported: support >= config.calibration.requirementSupport,
      evidenceIds: matching.slice(0, 3).map((record) => record.id),
    };
  });
}

function detectConflicts(signals, weightedRecords, roleFamily) {
  const signalIds = new Set(signals.map((signal) => signal.id));
  const types = new Set(weightedRecords.map((record) => record.type));
  const conflicts = [];
  const add = (id, severity, message) => conflicts.push({ id, severity, message });
  const hasExecution = ["shipped_product", "portfolio_project", "quantified_outcome", "repeatable_system"].some((type) => types.has(type));
  if (signalIds.has("founder") && !hasExecution) {
    add("founder_without_execution", "high", "Founder positioning is not backed by shipped work, outcomes, or operating proof.");
  }
  if (roleFamilyName(roleFamily) === "PRODUCT" && !["product_artifact", "customer_validation", "shipped_product"].some((type) => types.has(type))) {
    add("product_without_product_proof", "high", "Product direction lacks product decisions, customer discovery, or shipped-product proof.");
  }
  if (signalIds.has("analytics") && !["analytics_artifact", "quantified_outcome", "business_case"].some((type) => types.has(type))) {
    add("analytics_without_output", "medium", "Analytics language is not backed by an inspectable analysis or measured decision.");
  }
  const substantive = weightedRecords.filter((record) => !["self_assessment", "target_role", "title_claim", "signal_observation", "education", "external_link"].includes(record.type));
  const claims = weightedRecords.filter((record) => ["self_assessment", "target_role", "title_claim"].includes(record.type));
  if (claims.length >= 2 && !substantive.length) {
    add("claims_without_proof", "high", "The profile contains several claims but no substantive execution evidence.");
  }
  return conflicts;
}

function consistencyMetrics(weightedRecords) {
  const credibleRecords = weightedRecords.filter((record) => record.tier !== "very_low");
  const distinctFingerprints = new Set(credibleRecords.map((record) => record.fingerprint));
  const independentGroups = new Set(credibleRecords.map((record) => record.source.independentGroup));
  const duplicateCount = Math.max(0, credibleRecords.length - distinctFingerprints.size);
  const typeSupport = Object.values(credibleRecords.reduce((groups, record) => {
    if (!groups[record.type]) groups[record.type] = new Set();
    groups[record.type].add(record.source.independentGroup);
    return groups;
  }, {}));
  const independentlySupportedTypes = typeSupport.filter((groups) => groups.size >= 2).length;
  const score = clampEvidence(
    Math.min(100, independentGroups.size * 16 + independentlySupportedTypes * 18)
    - duplicateCount * 3
  );
  return {
    score,
    independentSourceCount: independentGroups.size,
    independentlySupportedTypes,
    duplicateCount,
  };
}

function confidenceFromEvidence({ weightedRecords, graph, consistency, conflicts, requirements, config }) {
  const sorted = [...weightedRecords].sort((a, b) => b.effectiveWeight - a.effectiveWeight);
  const quality = sorted.length
    ? sorted.slice(0, 6).reduce((sum, record, index) => sum + record.effectiveWeight / (1 + index * 0.16), 0)
      / sorted.slice(0, 6).reduce((sum, _, index) => sum + 1 / (1 + index * 0.16), 0)
    : 0;
  const verified = sorted.length
    ? sorted.reduce((sum, record) => sum + (config.verificationScale[record.verification] || 0), 0) / sorted.length
    : 0;
  const supportedRequirements = requirements.filter((requirement) => requirement.supported).length;
  const requirementDepth = requirements.length ? supportedRequirements / requirements.length : 0;
  const graphDepth = Math.min(1, graph.metrics.depth / 5);
  const depth = requirementDepth * 0.62 + graphDepth * 0.38;
  const factors = config.confidenceFactors;
  const base = (
    quality * factors.quality
    + (consistency.score / 100) * factors.consistency
    + depth * factors.depth
    + graph.metrics.connectedRatio * factors.connectivity
    + verified * factors.verification
  ) * 100;
  const penalty = Math.min(
    config.conflictPenaltyCap,
    conflicts.reduce((sum, conflict) => sum + (config.conflictPenalty[conflict.severity] || 0), 0)
  );
  const score = clampEvidence(base - penalty);
  const band = score >= config.calibration.confidenceBands.high
    ? "High"
    : score >= config.calibration.confidenceBands.medium
      ? "Medium"
      : "Low";
  return {
    score,
    band,
    factors: {
      quality: clampEvidence(quality * 100),
      consistency: consistency.score,
      depth: clampEvidence(depth * 100),
      connectivity: clampEvidence(graph.metrics.connectedRatio * 100),
      verification: clampEvidence(verified * 100),
      conflictPenalty: penalty,
    },
  };
}

function selectOpportunity(requirements, config, lang) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const impact = config.opportunityScale.impact;
  const effort = config.opportunityScale.effort;
  const gaps = requirements
    .filter((requirement) => !requirement.supported)
    .map((requirement) => ({
      ...requirement,
      roi: ((impact[requirement.impact] || 1) * (1 - requirement.support)) / (effort[requirement.effort] || 1),
    }))
    .sort((a, b) => b.roi - a.roi);
  const gap = gaps[0] || null;
  if (!gap) return null;
  return {
    id: gap.id,
    title: tr ? gap.titleTr : gap.titleEn,
    impact: gap.impact,
    effort: gap.effort,
    missingEvidence: tr
      ? `${gap.titleTr} recruiter güvenini en hızlı artıracak eksik kanıt; kararlarının kimleri etkilediğini ve nasıl sonuç ürettiğini göstermelisin.`
      : `${gap.titleEn} is the missing proof most likely to increase recruiter confidence.`,
    action: tr ? gap.actionTr : gap.actionEn,
  };
}

function recruiterReasoning({ weightedRecords, requirements, confidence, opportunity, config, lang }) {
  const tr = String(lang || "").toUpperCase() === "TR";
  const strong = weightedRecords
    .filter((record) => !["very_low", "low"].includes(record.tier))
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight)[0];
  const definition = strong ? config.evidenceTypes[strong.type] : null;
  const strength = definition ? (tr ? definition.labelTr : definition.labelEn) : null;
  const missing = requirements.find((requirement) => !requirement.supported);
  const missingLabel = missing ? (tr ? missing.titleTr : missing.titleEn) : null;
  return {
    strongestEvidenceId: strong?.id || null,
    strongestEvidence: strength,
    missingEvidence: missingLabel,
    reliability: confidence.band,
    summary: strong
      ? tr
        ? `${strength} güven yaratıyor; ${missingLabel || "role özel kanıt"} tarafı kararın önündeki açık nokta.`
        : `${strength} builds confidence; ${missingLabel || "role-specific proof"} remains the open question.`
      : tr
        ? "Recruiter yönü görüyor; ancak kararı savunacak somut kanıt henüz oluşmamış."
        : "The recruiter can see the direction, but there is not yet enough concrete proof to defend the decision.",
    recommendation: opportunity?.action || null,
  };
}

function evaluateRecords(records, { roleFamily, targetRole, lang, now, config, signals }) {
  const family = roleFamilyName(roleFamily);
  const weightedRecords = weightEvidence(records, { roleFamily: family, now, config });
  const dimensions = aggregateDimensions(weightedRecords, config);
  const graph = buildEvidenceGraph(weightedRecords, config);
  const requirements = requirementStatus(weightedRecords, dimensions.scores, family, config);
  const conflicts = detectConflicts(signals, weightedRecords, family);
  const consistency = consistencyMetrics(weightedRecords);
  const confidence = confidenceFromEvidence({ weightedRecords, graph, consistency, conflicts, requirements, config });
  const opportunity = selectOpportunity(requirements, config, lang);
  const reasoning = recruiterReasoning({ weightedRecords, requirements, confidence, opportunity, config, lang });
  const recordQuality = weightedRecords.length
    ? weightedRecords.slice().sort((a, b) => b.effectiveWeight - a.effectiveWeight).slice(0, 5)
      .reduce((sum, record) => sum + record.effectiveWeight, 0) / Math.min(5, weightedRecords.length)
    : 0;
  const requirementCoverage = requirements.length
    ? requirements.reduce((sum, requirement) => sum + requirement.support, 0) / requirements.length
    : 0;
  const mix = config.calibration.evidenceQualityMix;
  const evidenceQuality = clampEvidence((recordQuality * mix.records + requirementCoverage * mix.requirements) * 100);
  return {
    roleContext: { targetRole: targetRole || "", roleFamily: family },
    weightedRecords,
    dimensions,
    graph,
    requirements,
    conflicts,
    consistency,
    confidence,
    opportunity,
    recommendation: opportunity ? { closesEvidenceGap: opportunity.id, evidenceToCreate: opportunity.title, action: opportunity.action } : null,
    recruiterReasoning: reasoning,
    evidenceQuality,
  };
}

export function buildCoreIntelligence({
  profile = {},
  cvText = "",
  targetRole = "",
  roleFamily = "BUSINESS",
  lang = "TR",
  now = new Date(),
  config: overrides = {},
} = {}) {
  const config = createEvidenceConfig(overrides);
  const signals = detectSignals({ profile, cvText });
  const records = extractEvidence({ profile, cvText, config, lang });
  const evaluated = evaluateRecords(records, { roleFamily, targetRole, lang, now, config, signals });
  return {
    version: config.version,
    signals,
    evidence: {
      records,
      byDimension: evaluated.dimensions.scores,
      dimensionSupport: evaluated.dimensions.support,
      sourceIds: [...new Set(records.map((record) => record.source.id))],
    },
    ...evaluated,
    config,
  };
}

export function evaluateEvidenceForRole(coreIntelligence, {
  roleFamily,
  targetRole = "",
  lang = "TR",
  now = new Date(),
  config: overrides = {},
} = {}) {
  const config = createEvidenceConfig(overrides);
  const records = coreIntelligence?.evidence?.records || [];
  const signals = coreIntelligence?.signals || [];
  return evaluateRecords(records, { roleFamily, targetRole, lang, now, config, signals });
}

export function evidenceLabels(evaluation, lang = "TR") {
  const tr = String(lang || "").toUpperCase() === "TR";
  const config = evaluation?.config || createEvidenceConfig();
  const strong = (evaluation?.weightedRecords || [])
    .filter((record) => !["very_low", "low"].includes(record.tier))
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight)
    .filter((record, index, rows) => rows.findIndex((other) => other.type === record.type) === index)
    .slice(0, 4)
    .map((record) => tr ? config.evidenceTypes[record.type]?.labelTr : config.evidenceTypes[record.type]?.labelEn)
    .filter(Boolean);
  const missing = (evaluation?.requirements || [])
    .filter((requirement) => !requirement.supported)
    .slice(0, 4)
    .map((requirement) => tr ? requirement.titleTr : requirement.titleEn);
  return { strong, missing };
}

export function compactCoreIntelligence(core) {
  if (!core) return null;
  return {
    version: core.version,
    roleContext: core.roleContext,
    signalIds: core.signals.map((signal) => signal.id),
    evidenceCount: core.evidence.records.length,
    sourceCount: core.consistency.independentSourceCount,
    dimensionScores: core.evidence.byDimension,
    graphSummary: core.graph.metrics,
    conflicts: core.conflicts.map(({ id, severity }) => ({ id, severity })),
    confidence: core.confidence,
    opportunity: core.opportunity,
    recommendation: core.recommendation,
  };
}
