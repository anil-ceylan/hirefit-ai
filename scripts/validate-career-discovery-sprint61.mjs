import assert from "node:assert/strict";
import fs from "node:fs";

import { getRolesForIndustry, getMergedRolesForIndustries } from "../lib/careerOnboarding/industries.js";
import { getRoleDisplay } from "../lib/careerOnboarding/roleDisplay.js";

const read = (file) => fs.readFileSync(file, "utf8");

const touchedFiles = [
  "src/CareerOnboardingPage.jsx",
  "src/components/onboarding/CareerIdentityBuilder.jsx",
  "src/components/career-os/CareerSnapshotWow.jsx",
  "src/components/career-os/career-os.css",
  "lib/careerOnboarding/trustLayer.js",
  "lib/careerOnboarding/snapshotWow.js",
  "lib/careerOnboarding/careerSnapshot.js",
  "lib/careerOnboarding/roleDisplay.js",
];

for (const file of touchedFiles) {
  const text = read(file);
  const invalid = [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return code === 0xfffd || (code < 32 && !["\n", "\r", "\t"].includes(char));
  });
  assert.equal(invalid.length, 0, `${file} contains invalid replacement/control characters`);
}

const careerPage = read("src/CareerOnboardingPage.jsx");
const careerPageRendered = careerPage.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
  String.fromCharCode(Number.parseInt(hex, 16))
);
const snapshotPage = read("src/components/career-os/CareerSnapshotWow.jsx");
const loadingComponent = read("src/components/onboarding/CareerIdentityBuilder.jsx");
const firstAnalysis = read("src/utils/firstCareerAnalysis.js");
const css = read("src/components/career-os/career-os.css");
const trustLayer = read("lib/careerOnboarding/trustLayer.js");
const snapshotWow = read("lib/careerOnboarding/snapshotWow.js");

assert.ok(careerPage.includes('const DRAFT_SCHEMA_VERSION = 10'), "Sprint 6.1 draft schema version missing");
assert.ok(careerPage.includes('"hirefit-onboarding-draft-v10"'), "Sprint 6.1 draft key missing");
assert.ok(careerPage.includes("goalsPanel"), "Career goals tab state missing");
assert.ok(careerPage.includes("readinessPanel"), "Career readiness tab state missing");
assert.ok(careerPage.includes("OnboardingSubnav"), "Career Discovery grouped navigation missing");
assert.ok(careerPage.includes("hf-onboard-panel-"), "Career Discovery tab panels missing");
assert.ok(css.includes(".hf-onboard-subnav"), "Career Discovery grouped navigation styles missing");

assert.ok(careerPage.includes("moveRankedInternationalCountry"), "Ranked international country persistence hook missing");
assert.ok(careerPage.includes("targetCountries"), "International country state missing");
assert.ok(careerPage.includes("internationalIndustries"), "International sector state missing");
assert.ok(careerPage.includes("goalsPanel, readinessPanel"), "Tabbed UI state must persist in local draft");

const expectedLoadingLabels = [
  "Profil tercihlerin düzenleniyor",
  "Deneyim sinyallerin düzenleniyor",
  "Kayıtlı kaynakların birleştiriliyor",
  "Rol yönlerin hesaplanıyor",
  "Career Snapshot oluşturuluyor",
];

for (const label of expectedLoadingLabels) {
  assert.ok(careerPageRendered.includes(label), `Missing loading stage: ${label}`);
}

assert.ok(careerPage.includes("activateGenerationStep"), "Live loading stage activation missing");
assert.ok(careerPage.includes("if (!ms) return Promise.resolve();"), "Loading flow must not force artificial delay");
assert.equal(careerPage.includes("waitForGenerationStep(100)"), false, "Snapshot completion must not add artificial post-generation delay");
assert.equal(firstAnalysis.includes("MIN_ANALYSIS_MS"), false, "First analysis must not use an artificial minimum delay");
assert.equal(firstAnalysis.includes("setTimeout"), false, "First analysis must not slow results with fake waiting");
assert.ok(!loadingComponent.includes("width: `${progress}%`"), "Loading component must not show fake percentage progress");
assert.ok(!loadingComponent.includes("completedCount"), "Loading component should not expose checklist-style completion math");

assert.ok(snapshotPage.includes("SnapshotFirstView"), "Snapshot first-view summary missing");
assert.ok(snapshotPage.includes("SnapshotTabs"), "Snapshot secondary tabs missing");
assert.ok(snapshotPage.includes("Kariyer Kimliğin"), "Snapshot first-view identity label missing");
assert.ok(snapshotPage.includes("En Uygun Rol Yönün"), "Snapshot first-view role direction label missing");
assert.ok(snapshotPage.includes("Geliştirmen Gereken En Önemli Alan"), "Snapshot first-view gap label missing");
assert.ok(snapshotPage.includes("Sonraki En İyi Hamle"), "Snapshot first-view next move label missing");
assert.ok(snapshotPage.includes("hf-snap-wow__role-missing"), "Role cards must surface missing proof");
assert.ok(css.includes(".hf-snap-wow__tabs"), "Snapshot tab styles missing");

const forbiddenVisibleCopy = [
  "Bu kombinasyon sıklıkla",
  "Bu profile sahip kişiler sıklıkla",
  "AI analiz",
  "guaranteed",
  "definitely",
  "certain",
];

for (const phrase of forbiddenVisibleCopy) {
  for (const [file, text] of [
    ["src/CareerOnboardingPage.jsx", careerPage],
    ["src/components/career-os/CareerSnapshotWow.jsx", snapshotPage],
    ["lib/careerOnboarding/trustLayer.js", trustLayer],
    ["lib/careerOnboarding/snapshotWow.js", snapshotWow],
  ]) {
    assert.ok(!text.includes(phrase), `${file} still contains forbidden copy: ${phrase}`);
  }
}

const strategyOps = getRoleDisplay("strategy_operations_intern", "TR");
assert.equal(strategyOps.primary, "Strateji ve Operasyon Stajyeri");
assert.equal(strategyOps.secondary, "Strategy & Operations Intern");
assert.ok(strategyOps.explanation.includes("süreç"), "Strategy role explanation should be Turkish-first and plain");

const healthcareRoles = getRolesForIndustry("healthcare");
for (const role of [
  "healthcare_management",
  "hospital_operations",
  "clinical_operations",
  "health_informatics",
  "healthcare_data_analyst",
  "public_health",
  "medical_sales",
]) {
  assert.ok(healthcareRoles.includes(role), `Healthcare catalog missing ${role}`);
  const display = getRoleDisplay(role, "TR");
  assert.notEqual(display.family, "general", `${role} should not fall back to generic role copy`);
  assert.ok(display.primary && display.secondary && display.explanation, `${role} display metadata incomplete`);
}

const healthcareOnly = new Set(healthcareRoles);
assert.ok(!healthcareOnly.has("software_engineer"), "Healthcare-only role list must not force software roles");
assert.ok(!healthcareOnly.has("product_manager"), "Healthcare-only role list must not force product roles");

const healthcareTech = getMergedRolesForIndustries(["healthcare", "technology"]);
assert.ok(healthcareTech.includes("product_manager"), "Healthcare + technology merged path should allow product direction");
assert.equal(new Set(healthcareTech).size, healthcareTech.length, "Merged healthcare roles must be duplicate-free");

process.stdout.write("Sprint 6.1 Career Discovery validation passed.\n");
