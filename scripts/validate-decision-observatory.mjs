import { performance } from "node:perf_hooks";
import { createInMemoryShadowLogStore, observeDecisionRun, summarizeDecisionDrift } from "../lib/careerIntelligence/observatory/index.js";
import { sanitizedProfileFixtures } from "../lib/careerIntelligence/observatory/fixtures/index.js";

const store = createInMemoryShadowLogStore();
const started = performance.now();
const rows = sanitizedProfileFixtures.map((fixture) => observeDecisionRun({
  profile: fixture.profile,
  productionSnapshot: fixture.productionSnapshot || fixture.profile.career_snapshot,
  featureFlags: {
    ENABLE_SHADOW_REASONING: true,
    ENABLE_SHADOW_LOGGING: true,
    ENABLE_DECISION_OBSERVATORY: true,
    ENABLE_INTERNAL_REASONING_INSPECTOR: false,
    ENABLE_DRIFT_ANALYSIS: true,
    ENABLE_PROMOTION_GATE_EVALUATION: true,
  },
  config: { deterministic: true },
  logStore: store,
  generatedAt: "2026-01-01T00:00:00.000Z",
}));
const runtimeMs = Number((performance.now() - started).toFixed(2));
const critical = rows.flatMap((row) => row.drift.items.filter((item) => item.severity === "critical"));
const failedContracts = rows.flatMap((row) => Object.entries(row.contracts || {}).filter(([, result]) => !result.valid).map(([name, result]) => ({ runId: row.runId, name, errors: result.errors })));
const privacyFailures = rows.filter((row) => !row.privacy?.passed);
const output = {
  fixtures: rows.length,
  stored: store.list().length,
  runtimeMs,
  averageRuntimeMs: Number((runtimeMs / Math.max(1, rows.length)).toFixed(2)),
  driftSummary: summarizeDecisionDrift(rows),
  criticalDrift: critical.length,
  failedContracts: failedContracts.length,
  privacyFailures: privacyFailures.length,
};

console.error("Decision Observatory Validation");
console.error(JSON.stringify(output, null, 2));

if (critical.length || failedContracts.length || privacyFailures.length) process.exit(1);
