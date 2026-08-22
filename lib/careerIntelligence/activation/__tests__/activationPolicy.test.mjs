import assert from "node:assert/strict";
import { evaluateActivationPolicy } from "../index.js";

const disabled = evaluateActivationPolicy({ featureFlags: { ENABLE_SHADOW_REASONING: false } });
assert.equal(disabled.state, "disabled");
assert.equal(disabled.canRun, false);

const blocked = evaluateActivationPolicy({ featureFlags: { ENABLE_SHADOW_REASONING: true }, profile: {}, shadowResult: { inputSummary: { evidenceCount: 0 } } });
assert.equal(blocked.state, "blocked");
assert.equal(blocked.canInfluenceProduction, false);

const allowed = evaluateActivationPolicy({
  featureFlags: { ENABLE_SHADOW_REASONING: true, ENABLE_SHADOW_LOGGING: true },
  profile: { id: "p1" },
  shadowResult: { inputSummary: { evidenceCount: 2 }, guardrails: { violations: [] } },
  contracts: {},
});
assert.equal(allowed.state, "shadow_logged");
assert.equal(allowed.canInfluenceProduction, false);

console.error("activationPolicy tests: PASS");
