import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function has(html, text) {
  return html.includes(text);
}

function lacks(html, text) {
  return !html.includes(text);
}

function lacksMojibake(html) {
  return !/[ÃÄÅ][^\s<]{0,4}|â(?:€|œ|†|€™)/.test(html);
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});

try {
  const mod = await server.ssrLoadModule("/src/components/dashboard/WeeklyDecisionCenter.jsx");
  const WeeklyDecisionCenter = mod.default;

  const render = (careerProfile, props = {}) =>
    renderToStaticMarkup(
      React.createElement(WeeklyDecisionCenter, {
        careerProfile,
        user: props.user,
        lang: props.lang || "TR",
        navigate: () => {},
      })
    );

  const completedProfile = {
    onboarding_completed: true,
    basic_profile: { fullName: "Test User" },
    target_roles: ["Strategy & Operations Intern"],
    career_snapshot: {
      topRoleMatches: [
        {
          roleName: "Strategy & Operations Intern",
          fitPercentage: 76,
          whyItFits: "Teknoloji, operasyon ve strateji sinyalleri bu role bağlanıyor.",
        },
      ],
      gapDetails: {
        title: "Paydaş etkisi",
        whyItMatters: "Recruiter kararlarının kimleri etkilediğini görmek ister.",
        action: "Bir kararını problem -> seçenekler -> karar -> sonuç formatında yaz.",
      },
      recruiterTrust: 62,
    },
    projects: [{ title: "HireFit", description: "Career decision workflow", occurred_at: "2026" }],
  };

  const cases = [
    {
      name: "no profile object",
      html: render(null),
      expect: (html) => {
        assert(has(html, "İlk kariyer kararın için profilini tamamla."), "null profile should render incomplete action");
        assert(has(html, "Kariyer Profilini Tamamla"), "null profile should render profile CTA");
        assert(lacks(html, "hf-opportunity-card"), "null profile should not render lower decision cards");
      },
    },
    {
      name: "partial profile data",
      html: render({ basic_profile: null, career_snapshot: null }),
      expect: (html) => {
        assert(has(html, "Sınırlı"), "partial profile should use limited confidence");
        assert(has(html, "Bu karar neden verildi?"), "partial profile should keep explanation accordion");
      },
    },
    {
      name: "incomplete Career DNA",
      html: render({ onboarding_completed: false, basic_profile: { fullName: "Anıl Ceylan" } }),
      expect: (html) => {
        assert(has(html, "Bu Haftanın En Önemli Kariyer Hamlesi"), "incomplete profile should render corrected hero");
        assert(has(html, "Tamamladığında ne kazanacaksın?"), "incomplete profile should render benefit heading");
        assert(has(html, "En güçlü rol yönlerin netleşir."), "incomplete profile should render benefit bullets");
      },
    },
    {
      name: "completed Career DNA",
      html: render(completedProfile),
      expect: (html) => {
        assert(has(html, "hf-opportunity-card"), "completed profile should render opportunity card");
        assert(has(html, "hf-weekly-progress"), "completed profile should render progress layer");
        assert(has(html, "Strategy &amp; Operations Intern"), "completed profile should render best role");
        assert(has(html, "Karar Aynası"), "completed profile should render collapsed Decision Mirror trigger");
        assert(lacks(html, "hf-decision-mirror__body"), "Decision Mirror should be collapsed by default");
      },
    },
    {
      name: "authenticated completed profile",
      html: render(completedProfile, {
        user: {
          id: "auth-user-1",
          email: "person@example.com",
          email_confirmed_at: "2026-01-01T00:00:00.000Z",
          user_metadata: { full_name: "Test User" },
        },
      }),
      expect: (html) => {
        assert(has(html, "Bu Haftanın Kariyer Kararı"), "authenticated completed profile should render weekly decision");
        assert(has(html, "CV ile Doğrula"), "authenticated completed profile should keep CV shortcut");
      },
    },
    {
      name: "missing first name",
      html: render({ onboarding_completed: false }, { user: { user_metadata: { full_name: "test@example.com" } } }),
      expect: (html) => {
        assert(lacks(html, "test@example.com"), "unreliable name should not be rendered");
        assert(has(html, "Rol yönünü"), "fallback support copy should render");
      },
    },
    {
      name: "missing recommendation",
      html: render({ ...completedProfile, career_snapshot: { topRoleMatches: [] } }),
      expect: (html) => {
        assert(has(html, "Hedef rol") || has(html, "Strategy"), "missing recommendation should not crash role card");
        assert(has(html, "hf-weekly-role"), "role card should still render");
      },
    },
    {
      name: "missing decision confidence",
      html: render({ ...completedProfile, career_snapshot: { ...completedProfile.career_snapshot, recruiterTrust: null } }),
      expect: (html) => {
        assert(has(html, "Karar Güveni"), "missing confidence should not remove confidence card");
      },
    },
    {
      name: "missing highest-impact opportunity",
      html: render({
        ...completedProfile,
        career_snapshot: {
          ...completedProfile.career_snapshot,
          suggestedNextMove: null,
          recommendedNextMove: null,
          gapDetails: { title: "Kanıt açığı", whyItMatters: "" },
        },
      }),
      expect: (html) => {
        assert(has(html, "En Yüksek Etkili Fırsat"), "missing explicit action should render fallback opportunity");
      },
    },
    {
      name: "accordion closed by default",
      html: render(completedProfile),
      expect: (html) => {
        assert(has(html, "Bu karar neden verildi?"), "accordion button should render");
        assert(lacks(html, "hf-explain-flow"), "accordion content should be closed by default");
      },
    },
    {
      name: "Snapshot and CV shortcuts",
      html: render(completedProfile),
      expect: (html) => {
        assert(has(html, "Career Snapshot"), "snapshot shortcut should remain");
        assert(has(html, "CV ile Doğrula"), "CV validation shortcut should remain");
      },
    },
    {
      name: "English UI",
      html: render(null, { lang: "EN" }),
      expect: (html) => {
        assert(has(html, "Complete your profile for your first career decision."), "English incomplete copy should render");
        assert(has(html, "Complete Career Profile"), "English CTA should render");
      },
    },
    {
      name: "dashboard Turkish copy encoding",
      html: render(completedProfile),
      expect: (html) => {
        assert(lacksMojibake(html), "dashboard should not render Turkish mojibake");
      },
    },
    {
      name: "outcome capture Turkish copy",
      html: readFileSync("src/components/dashboard/WeeklyDecisionCenter.jsx", "utf8"),
      expect: (source) => {
        const outcomeSource = source.slice(source.indexOf("function OutcomeCaptureCard"));
        assert(has(outcomeSource, "Bu hamleden sonra ne oldu?"), "outcome prompt copy should exist");
        assert(has(outcomeSource, "Bu sadece sonuç kaydıdır"), "outcome truthfulness copy should exist");
        assert(lacksMojibake(outcomeSource), "outcome copy should not contain mojibake");
      },
    },
  ];

  const results = [];
  for (const testCase of cases) {
    testCase.expect(testCase.html);
    results.push({ name: testCase.name, passed: true });
  }

  const output = [
    "Dashboard Decision Center regression validation",
    `Passed: ${results.length}/${cases.length}`,
    ...results.map((result) => `✓ ${result.name}`),
  ].join("\n");
  process.stdout.write(`${output}\n`);
} finally {
  await server.close();
}

