import assert from "node:assert/strict";
import { runReasoningGuardrails } from "../index.js";

const reasoning = {
  hypotheses: [{ competency: "negotiation", confidence: 82, evidenceIds: [] }],
  recommendations: [{
    id: "rec",
    label: "Perfect fit role",
    decisionConfidence: 80,
    option: { requiredCompetencies: ["negotiation"] },
    missingEvidenceIds: ["m1"],
  }],
  evidenceIntelligence: {
    evidenceObjects: [{ id: "e1", source: "skills", source_type: "user_statement", trust: 80, confidence: 90, redundancyScore: 0 }],
  },
  conflicts: { conflicts: [] },
  missingEvidence: { missingEvidence: [{ id: "m1", competency: "negotiation" }] },
  simulation: { topOpportunity: { mode: "estimate" } },
};

const guardrails = runReasoningGuardrails(reasoning);
assert.equal(guardrails.passed, false);
assert.ok(guardrails.violations.some((item) => item.code === "UNSUPPORTED_COMPETENCY"));
assert.ok(guardrails.violations.some((item) => item.code === "UNSUPPORTED_CLAIM"));
assert.ok(guardrails.violations.some((item) => item.code === "NO_ABSOLUTE_LANGUAGE"));

console.error("reasoningGuardrails tests: PASS");
