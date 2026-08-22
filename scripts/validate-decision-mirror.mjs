import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ENABLE_SYMBOLIC_REFLECTION_PACKS,
  buildDecisionMirrorViewModel,
  validateDecisionMirrorPrivacy,
} from "../src/utils/decisionMirrorAdapter.js";

const sampleDecision = {
  profileComplete: true,
  title: "Bu Haftanın Kariyer Kararı",
  action: "Bir kararını problem -> seçenekler -> karar -> sonuç formatında yaz.",
  role: "Strategy & Operations Intern",
  roleConfidence: "76%",
  roleReason: "Teknoloji, operasyon ve strateji sinyalleri bu role bağlanıyor.",
  opportunity: "Paydaş etkisi kanıtı ekle.",
  blocker: "Şu an seni durduran şey: Paydaş etkisi.",
  impact: "Recruiter güvenini güçlendirebilir.",
  confidenceLabel: "Orta",
};

const mirror = buildDecisionMirrorViewModel({
  decision: {
    ...sampleDecision,
    action: `${sampleDecision.action} Contact: person@example.com +90 555 111 2233`,
  },
  lang: "TR",
});

assert.equal(ENABLE_SYMBOLIC_REFLECTION_PACKS, false, "symbolic packs must be disabled");
assert.equal(mirror.available, true, "mirror should produce a safe view model");
assert(mirror.questions.length > 0, "mirror should include questions");
assert(mirror.questions.length <= 3, "mirror must show max three questions");
assert.equal(mirror.metadata.symbolicPacksEnabled, false, "symbolic metadata should remain disabled");
assert(!JSON.stringify(mirror).includes("person@example.com"), "email must not enter UI view model");
assert(!JSON.stringify(mirror).includes("+90 555"), "phone must not enter UI view model");
assert(!/astrology|numerology|birth/i.test(JSON.stringify(mirror)), "symbolic/birth copy must not be visible");

assert.equal(validateDecisionMirrorPrivacy({ email: "person@example.com" }).valid, false, "email should be rejected");
assert.equal(validateDecisionMirrorPrivacy({ phone: "+90 555 111 2233" }).valid, false, "phone should be rejected");
assert.equal(validateDecisionMirrorPrivacy({ birthDate: "1998-01-01" }).valid, false, "birth data should be rejected");
assert.equal(validateDecisionMirrorPrivacy({ decision: "Safe summarized context" }).valid, true, "safe summary should pass");

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});

try {
  const mod = await server.ssrLoadModule("/src/components/dashboard/WeeklyDecisionCenter.jsx");
  const WeeklyDecisionCenter = mod.default;
  const careerProfile = {
    onboarding_completed: true,
    basic_profile: { fullName: "Private Person" },
    target_roles: ["Strategy & Operations Intern"],
    career_snapshot: {
      topRoleMatches: [
        {
          roleName: "Strategy & Operations Intern",
          fitPercentage: 76,
          whyItFits: "Technology and operations signals support this role.",
        },
      ],
      gapDetails: {
        title: "Stakeholder impact",
        whyItMatters: "Recruiter needs clearer business impact proof.",
        action: sampleDecision.action,
      },
      recruiterTrust: 62,
    },
    projects: [{ title: "Summarized project", description: "Career decision workflow", occurred_at: "2026" }],
  };
  const html = renderToStaticMarkup(
    React.createElement(WeeklyDecisionCenter, {
      careerProfile,
      user: { id: "user-1", email: "private@example.com", user_metadata: { full_name: "Private Person" } },
      lang: "TR",
      navigate: () => {},
    })
  );

  assert(html.includes("Karar Aynası"), "Decision Mirror trigger should render");
  assert(html.includes("Kararımı biraz daha derin düşün"), "Decision Mirror CTA should render");
  assert(!html.includes("hf-decision-mirror__body"), "Decision Mirror must be collapsed by default");
  assert(html.includes("Strategy &amp; Operations Intern"), "recommendation should remain visible");
  assert(html.includes("76%"), "role score should remain unchanged");
  assert(!html.includes("private@example.com"), "user email should not render");
  assert(!/Astrology|Numerology|Doğum|birth/i.test(html), "symbolic and birth-data UI must not render");
} finally {
  await server.close();
}

console.error("Decision Mirror validation: PASS");
console.error(JSON.stringify({
  collapsedByDefault: true,
  maxQuestions: mirror.questions.length,
  symbolicPacksEnabled: ENABLE_SYMBOLIC_REFLECTION_PACKS,
  sampleQuestions: mirror.questions,
  valueTension: mirror.valueTension,
}, null, 2));
