import fs from "node:fs";
import assert from "node:assert/strict";
import {
  getRoleDisplay,
  LOOKING_FOR_OPTIONS,
  WORK_MODE_OPTIONS,
  INTERNATIONAL_INTENT_OPTIONS,
} from "../lib/careerOnboarding/constants.js";
import { INDUSTRIES, getRolesForIndustry, getMergedRolesForIndustries } from "../lib/careerOnboarding/industries.js";

const touchedFiles = [
  "src/CareerOnboardingPage.jsx",
  "src/components/onboarding/HFCvSection.jsx",
  "src/components/career-os/CareerSnapshotWow.jsx",
  "src/components/career-os/career-os.css",
  "lib/careerOnboarding/roleDisplay.js",
  "lib/careerOnboarding/onboardingOptions.js",
  "lib/careerOnboarding/industries.js",
  "lib/careerOnboarding/roleCatalog.js",
];

for (const file of touchedFiles) {
  const text = fs.readFileSync(file, "utf8");
  const bad = [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return code === 0xfffd || (code < 32 && !["\n", "\r", "\t"].includes(char));
  });
  assert.equal(bad.length, 0, `${file} contains invalid replacement/control characters`);
}

const strategyOps = getRoleDisplay("strategy_operations_intern", "TR");
assert.equal(strategyOps.primary, "Strateji ve Operasyon Stajyeri");
assert.equal(strategyOps.secondary, "Strategy & Operations Intern");
assert.ok(strategyOps.explanation.includes("süreç"));

const productManager = getRoleDisplay("Product Manager", "TR");
assert.equal(productManager.primary, "Ürün Yöneticisi");
assert.equal(productManager.secondary, "Product Manager");

assert.deepEqual(
  LOOKING_FOR_OPTIONS.map((option) => option.id),
  ["internship", "part-time", "full-time", "freelance", "unsure"],
  "Opportunity type must not mix work model, geography, or career-change intent"
);

assert.deepEqual(
  WORK_MODE_OPTIONS.map((option) => option.id),
  ["onsite", "hybrid", "remote", "flexible"],
  "Work model must be separated from opportunity type"
);

assert.deepEqual(
  INTERNATIONAL_INTENT_OPTIONS.map((option) => option.id),
  ["no", "yes", "maybe", "unsure"],
  "International intent must be its own field"
);

const industryIds = INDUSTRIES.map((industry) => industry.id);
for (const expected of ["healthcare", "pharma_biotech", "law", "education", "manufacturing", "government"]) {
  assert.ok(industryIds.includes(expected), `Missing expanded sector: ${expected}`);
}

const healthcareRoles = getRolesForIndustry("healthcare");
assert.ok(healthcareRoles.includes("business_analyst"), "Healthcare must expose business analysis path");
assert.ok(healthcareRoles.includes("project_manager"), "Healthcare must expose project/operations path");

const mergedHealthcare = getMergedRolesForIndustries(["healthcare", "technology"]);
assert.ok(mergedHealthcare.includes("product_manager"), "Merged healthcare + technology path should keep product roles");
assert.equal(new Set(mergedHealthcare).size, mergedHealthcare.length, "Merged role list must be duplicate-free");

const careerPage = fs.readFileSync("src/CareerOnboardingPage.jsx", "utf8");
assert.ok(careerPage.includes("aria-expanded={showAllRoles}"), "Show more roles button must expose aria-expanded");
assert.ok(careerPage.includes("[...topRoleOptions, ...extraRoleOptions, ...(goals.targetRoles || [])]"), "Expanded roles must reveal the remaining role catalog");
assert.ok(careerPage.includes("[...topRoleOptions, ...(goals.targetRoles || [])]"), "Collapsed roles must preserve selected expanded roles");
assert.ok(careerPage.includes("leadershipExperienceStatus"), "Leadership progressive disclosure state missing");
assert.ok(careerPage.includes("hirefit-onboarding-draft-v9"), "Draft schema key must be updated for Sprint 6 persistence");

const cvSection = fs.readFileSync("src/components/onboarding/HFCvSection.jsx", "utf8");
assert.ok(cvSection.includes("Dosya seçildi"), "CV upload stages should reflect real file selection");
assert.ok(cvSection.includes("CV dosyası yükleniyor"), "CV upload stages should reflect real upload work");
assert.ok(!cvSection.includes("Deneyimler ve beceriler ayrıştırılıyor"), "CV upload must not imply parsing during file receipt");
assert.ok(cvSection.includes("role=\"status\""), "CV upload progress must be announced accessibly");

process.stdout.write("Sprint 6 Career Discovery validation passed.\n");
