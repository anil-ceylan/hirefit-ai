import assert from "node:assert/strict";
import { createCareerCompanionCase, generateCareerCompanionGuidance, normalizeCareerCompanionCase, requestCareerCompanion } from "../src/utils/careerCompanionClient.js";
import { parseGuidancePayload } from "../lib/careerCompanion/aiGuidance.js";
import { readFile } from "node:fs/promises";

const originalFetch = globalThis.fetch;
const headers = async () => ({ Authorization: "Bearer test" });
const calls = [];
const caseRecord = { id: "case-1", title: "Terfi görüşmesi", status: "draft" };
const guidedRecord = { ...caseRecord, status: "guided", guidance: { situation_summary: "summary" } };

try {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    if (String(url).endsWith("/cases") && options.method === "POST") return new Response(JSON.stringify({ case: caseRecord }), { status: 201 });
    if (String(url).endsWith("/guidance") && options.method === "POST") return new Response(JSON.stringify({ case: guidedRecord }), { status: 200 });
    throw new Error("unexpected request");
  };
  const saved = await createCareerCompanionCase(headers, { title: caseRecord.title });
  const guided = await generateCareerCompanionGuidance(headers, saved.case.id, "TR");
  assert.equal(guided.case.id, caseRecord.id);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/cases\/case-1\/guidance$/);
  assert.deepEqual(JSON.parse(calls[1].body), { lang: "TR" });
  assert.deepEqual(normalizeCareerCompanionCase({ ...caseRecord, guidance: JSON.stringify(guidedRecord.guidance) }).guidance, guidedRecord.guidance);
  assert.deepEqual(parseGuidancePayload("```json\n{\"guidance\":{\"situation_summary\":\"ok\"}}\n```"), { situation_summary: "ok" });
  assert.equal(parseGuidancePayload("{\"situation_summary\":\"unterminated"), null);

  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
  });
  await assert.rejects(() => requestCareerCompanion("/api/career-companion/cases/case-1/guidance", headers, { method: "POST" }, { timeoutMs: 10 }), (error) => error.code === "CAREER_COMPANION_TIMEOUT" && error.message.includes("Kaydın korunuyor"));

  const page = await readFile(new URL("../src/CareerCompanionPage.jsx", import.meta.url), "utf8");
  const persistence = await readFile(new URL("../lib/careerCompanion/persistence.js", import.meta.url), "utf8");
  assert.match(page, /if \(busy\) return/);
  assert.match(page, /replaceCase\(data\.case\)/);
  assert.match(page, /selected\?\.id && !selected\.guidance/);
  assert.match(page, /finally \{ setBusy\(false\); \}/);
  assert.match(persistence, /\.update\(updates\)\.eq\("id", value\.id\)\.eq\("user_id", userId\)/);
  assert.match(persistence, /value\[field\] !== null && value\[field\] !== undefined/);
  assert.match(persistence, /onConflict: "id"/);
  process.stdout.write("Career Companion guidance-flow validation passed.\n");
} finally {
  globalThis.fetch = originalFetch;
}
