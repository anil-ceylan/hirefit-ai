import { buildInspectorViewModel } from "./buildInspectorViewModel.js";

function linesFor(view) {
  const lines = [];
  lines.push("Decision Observatory Inspector");
  lines.push(`Run: ${view.runMetadata.runId || "n/a"}`);
  lines.push(`Activation: ${view.runMetadata.activationState || "n/a"}`);
  lines.push(`Production top role: ${view.productionDecision.topRoleId || "n/a"}`);
  lines.push(`Shadow top role: ${view.shadowDecision.topRoleId || "n/a"}`);
  lines.push(`Decision confidence: ${view.shadowDecision.decisionConfidence ?? "n/a"}`);
  lines.push(`Drift: ${view.drift.severity || "none"} (${(view.drift.typeCodes || []).join(", ") || "none"})`);
  lines.push(`Trace completeness: ${view.traceCompleteness.completenessScore ?? "n/a"}`);
  lines.push(`Promotion eligible: ${view.promotionGates.eligible === true ? "yes" : "no"}`);
  if (view.promotionGates.blockers?.length) {
    lines.push("Promotion blockers:");
    view.promotionGates.blockers.forEach((item) => lines.push(`- ${item}`));
  }
  if (view.warnings?.length) {
    lines.push("Warnings:");
    view.warnings.forEach((item) => lines.push(`- ${item.code || item}`));
  }
  return lines;
}

export function serializeInspectorReport(observatoryResult = {}, { format = "json" } = {}) {
  const view = buildInspectorViewModel(observatoryResult);
  if (format === "text") return linesFor(view).join("\n");
  return view;
}
