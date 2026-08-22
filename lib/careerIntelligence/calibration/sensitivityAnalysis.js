import { runShadowReasoning } from "./shadowReasoningRunner.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function confidenceFor(result, competency) {
  return result.reasoning.hypotheses.find((item) => item.competency === competency)?.confidence || 0;
}

function topConfidence(result) {
  return result.reasoning.topRecommendation?.decisionConfidence || 0;
}

export function evaluateReasoningSensitivity({ profile = {}, productionSnapshot = null } = {}) {
  const base = runShadowReasoning({ profile, productionSnapshot });
  const quantifiedStakeholder = clone(profile);
  quantifiedStakeholder.projects = [
    ...(quantifiedStakeholder.projects || []),
    {
      title: "Stakeholder rollout",
      description: "Coordinated stakeholder communication and launched workflow change for sales and ops teams, reducing handoff time by 20%.",
      occurred_at: "2026",
      metrics: ["20% handoff time"],
    },
  ];
  const duplicated = clone(profile);
  if (duplicated.projects?.[0]) duplicated.projects.push({ ...duplicated.projects[0], id: "duplicate_project" });
  const withoutProduct = clone(profile);
  withoutProduct.projects = (withoutProduct.projects || []).filter((item) => !/product|roadmap|user|founder|launch/i.test(`${item.title} ${item.description}`));
  const certificate = clone(profile);
  certificate.certifications = [...(certificate.certifications || []), { title: "General business certificate", description: "Completed introductory course." }];

  const stakeholderResult = runShadowReasoning({ profile: quantifiedStakeholder, productionSnapshot });
  const duplicateResult = runShadowReasoning({ profile: duplicated, productionSnapshot });
  const withoutProductResult = runShadowReasoning({ profile: withoutProduct, productionSnapshot });
  const certificateResult = runShadowReasoning({ profile: certificate, productionSnapshot });

  return {
    stakeholderIncrease: confidenceFor(stakeholderResult, "stakeholder_influence") - confidenceFor(base, "stakeholder_influence"),
    duplicateDecisionConfidenceDelta: topConfidence(duplicateResult) - topConfidence(base),
    productRemovalDelta: confidenceFor(withoutProductResult, "product_thinking") - confidenceFor(base, "product_thinking"),
    certificateDecisionConfidenceDelta: topConfidence(certificateResult) - topConfidence(base),
    cases: {
      baseTop: base.reasoning.topRecommendation?.label || null,
      stakeholderTop: stakeholderResult.reasoning.topRecommendation?.label || null,
      duplicateTop: duplicateResult.reasoning.topRecommendation?.label || null,
      withoutProductTop: withoutProductResult.reasoning.topRecommendation?.label || null,
      certificateTop: certificateResult.reasoning.topRecommendation?.label || null,
    },
  };
}
