import { performance } from "node:perf_hooks";
import { goldenPersonas } from "../lib/careerIntelligence/calibration/index.js";
import {
  createInMemoryShadowLogStore,
  observeDecisionRun,
  serializeInspectorReport,
  summarizeDecisionDrift,
} from "../lib/careerIntelligence/observatory/index.js";
import { getSanitizedProfileFixture, sanitizedProfileFixtures } from "../lib/careerIntelligence/observatory/fixtures/index.js";

const args = new Set(process.argv.slice(2));
const store = createInMemoryShadowLogStore();

function runProfile({ id, profile, productionSnapshot }) {
  const start = performance.now();
  const result = observeDecisionRun({
    profile,
    productionSnapshot: productionSnapshot || profile.career_snapshot,
    featureFlags: {
      ENABLE_SHADOW_REASONING: true,
      ENABLE_SHADOW_LOGGING: true,
      ENABLE_DECISION_OBSERVATORY: true,
      ENABLE_INTERNAL_REASONING_INSPECTOR: args.has("--inspect"),
      ENABLE_DRIFT_ANALYSIS: true,
      ENABLE_PROMOTION_GATE_EVALUATION: true,
    },
    config: { deterministic: true, realSampleCount: 0 },
    logStore: store,
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  const ms = Number((performance.now() - start).toFixed(2));
  return { id, result, ms };
}

let rows = [];
if (args.has("--personas")) {
  rows = goldenPersonas.map((persona) => runProfile({ id: persona.id, profile: persona.input, productionSnapshot: persona.input.career_snapshot }));
} else if (process.argv.includes("--persona")) {
  const id = process.argv[process.argv.indexOf("--persona") + 1] || "";
  const persona = goldenPersonas.find((item) => item.id.includes(id));
  if (!persona) throw new Error(`Persona not found: ${id}`);
  rows = [runProfile({ id: persona.id, profile: persona.input, productionSnapshot: persona.input.career_snapshot })];
} else if (process.argv.includes("--fixture")) {
  const id = process.argv[process.argv.indexOf("--fixture") + 1] || "strong";
  const fixture = getSanitizedProfileFixture(id);
  if (!fixture) throw new Error(`Fixture not found: ${id}`);
  rows = [runProfile({ id: fixture.id, profile: fixture.profile, productionSnapshot: fixture.productionSnapshot || fixture.profile.career_snapshot })];
} else {
  rows = sanitizedProfileFixtures.map((fixture) => runProfile({ id: fixture.id, profile: fixture.profile, productionSnapshot: fixture.productionSnapshot || fixture.profile.career_snapshot }));
}

if (args.has("--inspect") && rows[0]) {
  console.error(serializeInspectorReport(rows[0].result, { format: "text" }));
}

const summary = summarizeDecisionDrift(rows.map((row) => row.result));
const output = {
  runs: rows.length,
  stored: store.list().length,
  averageRuntimeMs: Number((rows.reduce((sum, row) => sum + row.ms, 0) / Math.max(1, rows.length)).toFixed(2)),
  driftSummary: summary,
  rows: rows.map((row) => ({
    id: row.id,
    runId: row.result.runId,
    activation: row.result.activation.state,
    stored: row.result.stored,
    drift: row.result.drift.severity,
    driftCodes: row.result.drift.typeCodes,
    topProduction: row.result.shadowSummary?.production?.topRoleId,
    topShadow: row.result.shadowSummary?.shadow?.topRoleId,
    runtimeMs: row.ms,
    promotionEligible: row.result.promotionGates.eligible,
  })),
};

console.error("Decision Observatory");
console.error(JSON.stringify(output, null, 2));

if (rows.some((row) => row.result.drift.severity === "critical")) process.exit(1);
