import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRolesForIndustries } from "../lib/careerOnboarding/industries.js";

const source = readFileSync("src/CareerOnboardingPage.jsx", "utf8");

function testVisibleOrder() {
  const targetIndex = source.indexOf('{ id: "target", label: tr ? "Hedefin"');
  const environmentIndex = source.indexOf('{ id: "environment", label: tr ? "Sektör ve Çalışma Biçimi"');
  const rolesIndex = source.indexOf('id: "roles",\n        label: tr ? "Roller"');
  assert.ok(targetIndex > -1, "Hedefin tab must exist");
  assert.ok(environmentIndex > -1, "Sektör ve Çalışma Biçimi tab must exist");
  assert.ok(rolesIndex > -1, "Roller tab must exist");
  assert.ok(targetIndex < environmentIndex, "Hedefin must appear before Sektör ve Çalışma Biçimi");
  assert.ok(environmentIndex < rolesIndex, "Sektör ve Çalışma Biçimi must appear before Roller");
}

function testInternalOrderAndGuards() {
  assert.match(source, /const GOALS_PANEL_ORDER = \["target", "environment", "roles"\];/);
  assert.match(source, /onChange=\{handleGoalsPanelChange\}/);
  assert.match(source, /panelId === "roles" && !selectedIndustries\.length/);
  assert.match(source, /goalsPanel === "environment"[\s\S]*await moveGoalsPanel\(1\);/);
  assert.match(source, /goalsPanel === "roles" && selectedIndustries\.length/);
  assert.doesNotMatch(source, /hf-onboard-role-placeholder/);
  assert.doesNotMatch(source, /Önce sektör seç - roller sektörüne göre hazırlanır/);
}

function testRoleGenerationFromSectorSelection() {
  const roles = getRolesForIndustries(["technology", "ai"]);
  assert.ok(roles.length > 0, "Technology + AI/Data sector selection must produce role suggestions");
  assert.ok(
    roles.some((role) => /product|data|analyst|engineer|ai/i.test(role)),
    "Generated roles should reflect the selected Technology + AI/Data sectors"
  );
}

function testSemanticCopy() {
  assert.match(source, /Alt sektör \/ ürün alanı/);
  assert.doesNotMatch(source, /Şirket sektörü/);
}

testVisibleOrder();
testInternalOrderAndGuards();
testRoleGenerationFromSectorSelection();
testSemanticCopy();

process.stdout.write("Career DNA step-order validation passed.\n");
