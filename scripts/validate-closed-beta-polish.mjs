import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.jsx", "utf8");
const sections = readFileSync("src/HireFitSections.jsx", "utf8");
const activationEvents = readFileSync("src/utils/activationEvents.js", "utf8");
const activationFlow = readFileSync("src/utils/activationFlow.js", "utf8");

function check(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n`);
    throw error;
  }
}

check("closed beta badge is visible on landing", () => {
  assert.match(app, /HİREFİT CLOSED BETA · SINIRLI ERİŞİM/);
  assert.match(app, /HIREFIT CLOSED BETA · LIMITED ACCESS/);
});

check("primary landing CTAs use beta language", () => {
  assert.match(app, /Ücretsiz Beta'ya Katıl/);
  assert.match(app, /Beta'ya Katıl/);
  assert.match(app, /Closed Beta'ya Katıl/);
  assert.doesNotMatch(app, /Bekleme Listesine Katıl/);
  assert.doesNotMatch(app, /Join Waitlist/);
  assert.doesNotMatch(app, /Ücretsiz Başla/);
});

check("pricing emphasizes free closed beta", () => {
  assert.match(app, /İlk beta kohortu ücretsiz/);
  assert.match(app, /Cohort 01/);
  assert.match(app, /Career Snapshot/);
  assert.match(app, /Haftalık kariyer hamlesi/);
});

check("Turkish activation labels are UTF-8 clean", () => {
  assert.match(activationFlow, /Fiyatlandırma/);
  assert.match(activationFlow, /Bugünkü Hamle/);
  assert.match(activationFlow, /Kariyer keşfi hazırlanıyor/);
  assert.doesNotMatch(activationFlow, /Ã|Ä|Å|Â|â/);
});

check("product preview Turkish chips are localized", () => {
  assert.match(sections, /Sahiplenme/);
  assert.match(sections, /Ürün düşüncesi/);
  assert.match(sections, /Demo içerik; canlı kullanıcı verisi değildir/);
});

check("legal/footer launch copy is clean", () => {
  assert.match(app, /© 2026 HireFit/);
  assert.match(app, /← Geri/);
  assert.doesNotMatch(app, /Â©/);
  assert.doesNotMatch(app, /â† Geri/);
});

check("closed beta analytics are safe and present", () => {
  assert.match(activationEvents, /landing_cta_clicked/);
  assert.match(activationEvents, /signup_started/);
  assert.match(activationEvents, /signup_completed/);
  assert.match(activationEvents, /beta_cohort/);
  assert.match(app, /closed_beta_01/);
  assert.doesNotMatch(activationEvents, /email|phone|cvText|outcomeText|raw/i);
});

process.stdout.write("Closed beta polish checks passed.\n");
