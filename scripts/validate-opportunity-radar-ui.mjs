/* global document, innerWidth, getComputedStyle, window */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { opportunityFixtures } from "./fixtures/opportunity-radar.mjs";
import { rankOpportunity } from "../lib/opportunityRadar/ranking.js";

const { chromium } = createRequire(import.meta.url)(process.env.HIREFIT_PLAYWRIGHT || "playwright");
const base = "http://127.0.0.1:5173";
const output = resolve(process.env.HIREFIT_UI_OUTPUT || "test-results/radar-ui");
mkdirSync(output, { recursive: true });
// Read only the public project URL. All auth/API requests below are intercepted.
const env = [".env", ".env.local"].map(file => { try { return readFileSync(file, "utf8"); } catch { return ""; } }).join("\n");
const publicUrl = [...env.matchAll(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/gm)].at(-1)?.[1];
assert.ok(publicUrl);
const storageKey = `sb-${new URL(publicUrl).hostname.split(".")[0]}-auth-token`;
const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: "UI Test" }, app_metadata: {}, aud: "authenticated", role: "authenticated" };
const profile = { user_id: user.id, onboarding_completed: true, basic_profile: { fullName: "UI Test" }, career_snapshot: { readinessScore: 84 }, career_goals: { targetRoles: ["data_analyst"], industries: ["technology"], lookingFor: ["full-time"] }, skills: ["SQL"] };
const items = opportunityFixtures.map((fixture, index) => rankOpportunity({ ...fixture, source_type: "employer", published: true, active: true, verification_status: "verified", last_verified_at: "2025-01-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z", deadline_at: index === 0 ? "2098-12-01T00:00:00Z" : null }, index === 0 ? profile : {}, null));
items[1].organization = "TEST-ONLY-" + "LongOrganizationName".repeat(8);
const invalid = [
  { ...items[0], id: "expired", title: "EXPIRED_MUST_NOT_RENDER", expires_at: "2000-01-01T00:00:00Z" },
  { ...items[0], id: "unverified", title: "UNVERIFIED_MUST_NOT_RENDER", verification_status: "unverified" },
  { ...items[0], id: "inactive", title: "INACTIVE_MUST_NOT_RENDER", active: false },
  ...opportunityFixtures,
];

const browser = await chromium.launch({ channel: "msedge", headless: true });
async function setup(width, { authenticated = true, verified = true, lang = "TR" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: "dark" });
  await context.addInitScript(({ storageKey, user, authenticated, verified, lang }) => {
    localStorage.setItem("hirefit-lang", lang);
    if (authenticated) localStorage.setItem(storageKey, JSON.stringify({ access_token: "fixture-token", refresh_token: "fixture-refresh", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user: { ...user, email_confirmed_at: verified ? user.email_confirmed_at : null } }));
  }, { storageKey, user, authenticated, verified, lang });
  const control = { mode: "ready", states: new Map(), reads: 0, writes: [], failWrite: false, listGate: null, writeGate: null, holdSaved: false };
  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.startsWith("/auth/v1")) return json({ ...user, email_confirmed_at: verified ? user.email_confirmed_at : null });
    if (url.pathname.startsWith("/rest/v1")) return json(url.pathname.includes("user_plans") ? { user_id: user.id, plan: "free", analysis_count: 0 } : []);
    if (url.pathname === "/api/career-profile") return json({ exists: true, authenticated: true, onboarding_completed: true, profile });
    if (url.pathname === "/api/career-progress") return json({ snapshots: [], growth: { careerScore: 84 } });
    if (url.pathname.startsWith("/api/opportunity-radar")) {
      if (req.method() === "PATCH") {
        const body = req.postDataJSON();
        control.writes.push({ id: url.pathname.split("/")[3], body });
        if (control.writeGate) await control.writeGate;
        if (control.failWrite) return json({ success: false, error: "private SQL diagnostics must not appear" }, 503);
        const id = url.pathname.split("/")[3];
        control.states.set(id, body.state);
        return json({ success: true, opportunity_id: id, state: body.state, updated_at: new Date().toISOString() });
      }
      control.reads += 1;
      if (control.listGate && (!control.holdSaved || url.searchParams.get("state") === "saved")) await control.listGate;
      if (control.mode === "error") return json({ success: false, error: "private SQL diagnostics must not appear" }, 503);
      if (control.mode === "profile_required") return json({ success: false, error: "CAREER_PROFILE_REQUIRED" }, 409);
      if (control.mode === "unauthorized") return json({}, 401);
      if (control.mode === "malformed") return json({ success: true, opportunities: null });
      const visible = items.map((item, index) => ({ ...(url.searchParams.get("lang") === "EN" ? rankOpportunity(item, index === 0 ? profile : {}, null, { lang: "EN" }) : item), ...(control.expireSoon ? { expires_at: new Date(Date.now() + 60000).toISOString() } : {}), current_user_state: control.states.get(item.id) || null })).filter(item => url.searchParams.get("state") === "saved" ? item.current_user_state === "saved" : item.current_user_state !== "dismissed");
      return json({ success: true, opportunities: control.mode === "empty" ? [] : [...visible.slice(0, Number(url.searchParams.get("limit"))), ...invalid], meta: { candidates_truncated: false } });
    }
    if (url.pathname.startsWith("/api/")) return json({ success: true, action: null });
    if (url.origin === base) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  return { context, page, control, errors };
}
try {
  for (const width of [390, 768, 1100, 1440]) {
    const { context, page, control, errors } = await setup(width);
    let releaseList;
    control.listGate = new Promise(resolve => { releaseList = resolve; });
    await page.goto(`${base}/opportunity-radar`);
    await page.getByRole("status").filter({ hasText: "fırsatları hazırlanıyor" }).waitFor();
    await page.screenshot({ path: `${output}/radar-${width}-loading.png`, fullPage: true });
    releaseList(); control.listGate = null;
    const cards = page.locator("main article");
    await cards.nth(1).waitFor();
    assert.equal(await cards.count(), 2);
    assert.equal(await page.getByText(/MUST_NOT_RENDER/).count(), 0);
    assert.equal(await cards.nth(1).getByRole("heading", { name: "Neden şimdi?" }).count(), 0);
    assert.equal(await cards.nth(1).getByText("Karşılaştırma için bilgi bekleniyor", { exact: true }).count(), 1);
    assert.equal(await cards.nth(1).getByText("Bilgi kapsamı: %0", { exact: true }).count(), 1);
    const sourceLink = cards.first().getByRole("link", { name: /Fırsatı görüntüle/ });
    assert.equal(await sourceLink.getAttribute("target"), "_blank");
    assert.equal(await sourceLink.getAttribute("rel"), "noopener noreferrer");
    assert.equal(await sourceLink.getAttribute("href"), items[0].url);
    await page.getByText("Profil uyumu, işe alınma olasılığı değildir.", { exact: false }).waitFor();
    const layout = await page.evaluate(() => {
      const title = document.querySelector("main h1").getBoundingClientRect();
      const nav = document.querySelector(".hf-nav-root").getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, titleClear: title.top >= nav.bottom,
        escaped: [...document.querySelectorAll("main article, main button, main a")].some(el => { const rect = el.getBoundingClientRect(); return rect.right > innerWidth + 1 || rect.left < -1; }) };
    });
    assert.deepEqual(layout, { overflow: false, titleClear: true, escaped: false }, `${width}px`);
    const all = page.getByRole("button", { name: "Tümü", exact: true });
    await all.focus(); await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("button", { name: "Kaydedilenler", exact: true }).evaluate(el => el === document.activeElement), true);
    assert.notEqual(await page.getByRole("button", { name: "Kaydedilenler", exact: true }).evaluate(el => getComputedStyle(el).outlineStyle), "none");
    await page.screenshot({ path: `${output}/radar-${width}-ready.png`, fullPage: true });

    let releaseWrite;
    control.writeGate = new Promise(resolve => { releaseWrite = resolve; });
    await cards.first().getByRole("button", { name: "Kaydet", exact: true }).evaluate(el => { el.click(); el.click(); });
    await page.getByRole("status").filter({ hasText: "Güncelleniyor" }).waitFor();
    assert.equal(await cards.first().getByRole("button", { name: "Kaydet", exact: true }).isDisabled(), true);
    await page.waitForFunction(() => document.querySelector("main [aria-pressed=true]").disabled);
    releaseWrite(); control.writeGate = null;
    await page.getByRole("status").filter({ hasText: "Fırsat kaydedildi." }).waitFor();
    assert.equal(control.writes.length, 1);
    assert.deepEqual(control.writes[0].body, { state: "saved" });
    await page.reload();
    await page.locator("main article").first().getByRole("button", { name: "Kaydedildi", exact: true }).waitFor();
    await page.getByRole("button", { name: "Kaydedilenler", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll("main article").length === 1);
    await all.click(); await cards.nth(1).waitFor();

    control.failWrite = true;
    await cards.nth(1).getByRole("button", { name: "Kaydet", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Kartı koruduk" }).waitFor();
    assert.equal(await cards.count(), 2);
    assert.equal(await cards.nth(1).getByRole("button", { name: "Kaydet", exact: true }).isEnabled(), true);
    await cards.first().getByRole("button", { name: "Gizle", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Kartı koruduk" }).waitFor();
    assert.equal(await cards.count(), 2, "Failed dismiss must preserve the card");
    assert.equal(await page.getByText(/private SQL/).count(), 0);
    await page.screenshot({ path: `${output}/radar-${width}-update-error.png`, fullPage: true });
    control.failWrite = false;
    await cards.first().getByRole("button", { name: "Gizle", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Fırsat gizlendi" }).waitFor();
    assert.equal(await cards.count(), 1);
    await page.reload(); await cards.first().waitFor();
    assert.equal(await cards.count(), 1, "Dismiss survives refresh");
    await page.getByRole("button", { name: "Kaydedilenler", exact: true }).click();
    await page.getByRole("heading", { name: "Henüz aktif bir kayıtlı fırsat yok" }).waitFor();
    await all.click(); await cards.first().waitFor();
    for (const mode of ["error", "malformed", "empty", "profile_required", "unauthorized"]) {
      control.mode = mode;
      await page.getByRole("button", { name: "Yenile", exact: true }).click();
      if (mode === "empty") await page.getByRole("heading", { name: "Şu anda gösterilecek doğrulanmış fırsat yok" }).waitFor();
      else if (mode === "profile_required") await page.getByRole("link", { name: "Kariyer profiline git" }).waitFor();
      else await page.getByRole("alert").waitFor();
      assert.equal(await cards.count(), 0);
      if (mode === "empty" || mode === "error") await page.screenshot({ path: `${output}/radar-${width}-${mode}.png`, fullPage: true });
    }
    control.mode = "ready"; control.states.clear();
    await page.getByRole("button", { name: "Yenile", exact: true }).click(); await cards.nth(1).waitFor();
    control.holdSaved = true;
    control.listGate = new Promise(resolve => { releaseList = resolve; });
    await page.getByRole("button", { name: "Kaydedilenler", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "fırsatları hazırlanıyor" }).waitFor();
    await all.click(); await cards.nth(1).waitFor();
    releaseList(); control.listGate = null; control.holdSaved = false;
    assert.equal(await cards.count(), 2, "Stale Saved request cannot replace All");

    await page.goto(`${base}/dashboard`);
    const preview = page.getByRole("region", { name: "Opportunity Radar", exact: true });
    await preview.locator("article").nth(1).waitFor();
    assert.equal(await preview.locator("article").count(), 2);
    assert.equal(await preview.getByRole("button", { name: "Kaydet", exact: true }).count(), 0);
    assert.equal(await preview.evaluate(el => el.previousElementSibling.classList.contains("hf-weekly-center") && el.nextElementSibling.textContent.includes("Career Companion")), true);
    await preview.screenshot({ path: `${output}/radar-${width}-dashboard.png` });
    await preview.getByRole("link", { name: /Tüm fırsatları gör/ }).click();
    await page.getByRole("heading", { name: "Bir sonraki fırsatını keşfet" }).waitFor();
    assert.deepEqual(errors, []);
    process.stdout.write(`Radar browser ${width}px: rendering, focus/overflow, safe states, persistence, errors, filters and dashboard placement passed.\n`);
    await context.close();
  }
  for (const options of [{ authenticated: false }, { verified: false }]) {
    const { context, page, control } = await setup(390, options);
    await page.goto(`${base}/opportunity-radar`);
    await page.waitForURL(options.authenticated === false ? /\/login\?next=%2Fopportunity-radar/ : /\/verify-email/);
    assert.equal(control.reads, 0, "No Radar request before verified authentication");
    await context.close();
  }
  const english = await setup(1100, { lang: "EN" });
  english.control.expireSoon = true;
  await english.page.goto(`${base}/opportunity-radar`);
  await english.page.locator(".hf-nav-lang-compact").click();
  await english.page.getByRole("option", { name: "English", exact: true }).click();
  await english.page.getByRole("heading", { name: "Explore your next opportunity" }).waitFor();
  await english.page.locator("main article").nth(1).waitFor();
  await english.page.getByRole("button", { name: "All", exact: true }).waitFor();
  await english.page.locator("main article").first().getByRole("button", { name: "Save", exact: true }).waitFor();
  await english.page.locator("main article").first().getByText("Open the source and verify application and eligibility requirements.", { exact: true }).waitFor();
  // A source may expire while the page is open. Focus revalidates cached cards.
  await english.page.clock.install();
  await english.page.clock.fastForward(61000);
  await english.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await english.page.getByRole("heading", { name: "No verified opportunities to show right now" }).waitFor();
  assert.equal(await english.page.locator("main article").count(), 0);
  assert.deepEqual(english.errors, []);
  await english.context.close();
} finally { await browser.close(); }
process.stdout.write(`Radar UI verified with isolated fixtures only. Screenshots: ${output}\n`);
