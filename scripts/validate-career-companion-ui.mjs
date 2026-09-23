/* global document, getComputedStyle, innerWidth, window */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HIREFIT_PLAYWRIGHT || "playwright");
const base = "http://127.0.0.1:5173";
const phase = process.env.HIREFIT_UI_PHASE || "after";
const output = resolve(process.env.HIREFIT_UI_OUTPUT || "test-results/companion-ui");
mkdirSync(output, { recursive: true });
// Read only the public project URL to seed an isolated browser's synthetic session.
const env = [".env", ".env.local"].map(file => { try { return readFileSync(file, "utf8"); } catch { return ""; } }).join("\n");
const configuredUrl = [...env.matchAll(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/gm)].at(-1)?.[1];
assert.ok(configuredUrl, "Local app needs a configured public Supabase URL");
const storageKey = `sb-${new URL(configuredUrl).hostname.split(".")[0]}-auth-token`;
const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: "Deneme Kullanıcısı" }, app_metadata: {}, aud: "authenticated", role: "authenticated" };
const profile = { user_id: user.id, onboarding_completed: true, basic_profile: { fullName: "Deneme Kullanıcısı" }, career_snapshot: { readinessScore: 84 } };
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [390, 768, 1100, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: "dark" });
    await context.addInitScript(({ storageKey, user }) => {
      localStorage.setItem("hirefit-lang", "TR");
      localStorage.setItem(storageKey, JSON.stringify({ access_token: "fixture-token", refresh_token: "fixture-refresh", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user }));
    }, { storageKey, user });
    let failSubmit = true;
    let writes = 0;
    const page = await context.newPage();
    const exceptions = [];
    page.on("pageerror", error => exceptions.push(error.message));
    // Intercept every network request. Only local app assets may reach a server.
    await context.route("**/*", async route => {
      const req = route.request();
      const url = new URL(req.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname.startsWith("/auth/v1")) return json(user);
      if (url.pathname.startsWith("/rest/v1")) return json(url.pathname.includes("user_plans") ? { user_id: user.id, plan: "free", analysis_count: 0, last_reset_at: new Date().toISOString() } : []);
      if (url.pathname === "/api/career-profile") return json({ exists: true, authenticated: true, onboarding_completed: true, profile });
      if (url.pathname === "/api/career-progress") return json({ snapshots: [], growth: { careerScore: 84, scoreDelta: 5 } });
      if (url.pathname.startsWith("/api/career-companion")) {
        if (req.method() === "GET") return json({ cases: [] });
        writes += 1;
        if (failSubmit) return json({ error: "STORAGE_UNAVAILABLE" }, 503);
        if (url.pathname.endsWith("/guidance")) return json({ case: { id: user.id, title: "Görüşme", guidance: { situation_summary: "Yerel test rehberliği" } } });
        return json({ case: { id: user.id }, outcome: {} });
      }
      if (url.pathname.startsWith("/api/")) return json({});
      if (url.origin === base) return route.continue();
      return route.abort();
    });
    await page.goto(`${base}/career-companion`);
    await page.locator(".hf-nav-career-score").waitFor();
    await page.screenshot({ path: `${output}/${phase}-${width}-empty.png`, fullPage: true });
    const baseline = await page.locator("textarea").first().evaluate(el => ({ width: el.getBoundingClientRect().width, border: getComputedStyle(el).borderWidth, background: getComputedStyle(el).backgroundColor, display: getComputedStyle(el).display }));
    process.stdout.write(`${phase} ${width}: ${JSON.stringify(baseline)}\n`);
    if (phase === "before") { await context.close(); continue; }
    const form = page.locator("form").first();
    const submit = form.getByRole("button", { name: "Kaydet ve rehberlik oluştur" });
    await submit.click();
    assert.equal(writes, 0, "Invalid form must not call API");
    assert.equal(await page.locator("[aria-invalid=true]").count(), 5);
    assert.equal(await page.evaluate(() => document.activeElement.id), "companion-title");
    const values = { title: "Terfi görüşmesi", what_happened: "Yaklaşan değerlendirme görüşmesine hazırlanıyorum.", desired_outcome: "Sorumluluklarımı ve sonraki adımı konuşmak.", role_context: "Mevcut rol ve sorumluluklar için test metni.", achievements: "Kendi sonuçlarımı görüşme öncesinde listeleyeceğim.", manager_context: "" };
    for (const [key, value] of Object.entries(values)) await page.locator(`#companion-${key}`).fill(value);
    await page.locator("#companion-title").focus();
    const tabIds = ["what_happened", "desired_outcome", "role_context", "achievements", "manager_context", "urgency"];
    for (const id of tabIds) {
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), `companion-${id}`);
    }
    await page.keyboard.press("Tab");
    assert.equal(await submit.evaluate(el => el === document.activeElement), true);
    await submit.click();
    await page.getByRole("alert").filter({ hasText: "tekrar" }).waitFor();
    for (const [key, value] of Object.entries(values)) assert.equal(await page.locator(`#companion-${key}`).inputValue(), value);
    await page.screenshot({ path: `${output}/${phase}-${width}-error.png`, fullPage: true });
    await page.locator("#companion-achievements").fill("UzunMetin".repeat(400));
    const checkLayout = async () => {
      const result = await page.evaluate(() => {
        const nav = document.querySelector(".hf-nav-root");
        const tabs = document.querySelector(".hf-nav-tabs-center");
        const right = document.querySelector(".hf-nav-right-cluster");
        const a = tabs.getBoundingClientRect(), b = right.getBoundingClientRect();
        const overlap = getComputedStyle(tabs).display !== "none" && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const controls = [...document.querySelectorAll("main input, main textarea, main select")];
        return { overlap, overflow: controls.some(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth || r.left < 0; }), navBottom: nav.getBoundingClientRect().bottom, labelErrors: controls.filter(el => !el.labels?.length).length };
      });
      assert.equal(result.overlap, false, `Header overlap at ${width}`);
      assert.equal(result.overflow, false, `Control overflow at ${width}`);
      assert.equal(result.labelErrors, 0);
    };
    await checkLayout();
    await page.locator("#companion-title").focus();
    const focus = await page.locator("#companion-title").evaluate(el => ({ top: el.getBoundingClientRect().top, outline: getComputedStyle(el).outlineStyle, border: getComputedStyle(el).borderWidth, nav: document.querySelector(".hf-nav-root").getBoundingClientRect().bottom }));
    assert.ok(focus.top >= focus.nav, "Focused field must clear header");
    assert.notEqual(focus.outline, "none");
    assert.notEqual(focus.border, "0px");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${phase}-${width}-filled.png`, fullPage: true });
    failSubmit = false;
    await submit.click();
    const outcome = page.locator("form").nth(1);
    await outcome.getByRole("button", { name: "Sonucu kaydet" }).click();
    assert.equal(await page.locator("#companion-manager_response").getAttribute("aria-invalid"), "true");
    await page.locator("#companion-manager_response").fill("Yerel test yanıtı");
    failSubmit = true;
    await outcome.getByRole("button", { name: "Sonucu kaydet" }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator("#companion-manager_response").inputValue(), "Yerel test yanıtı");
    await checkLayout();
    assert.deepEqual(exceptions, []);
    await page.screenshot({ path: `${output}/${phase}-${width}-outcome.png`, fullPage: true });
    await context.close();
  }
} finally { await browser.close(); }
process.stdout.write(`Companion browser checks (${phase}) completed. Screenshots: ${output}\n`);
