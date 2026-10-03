import assert from "node:assert/strict";
import { listOpportunities, updateOpportunityState, requestOpportunityRadar, radarErrorMessage } from "../src/utils/opportunityRadarClient.js";
import { opportunityFixtures } from "./fixtures/opportunity-radar.mjs";

const originalFetch = globalThis.fetch;
const calls = [];
const headers = async options => { assert.equal(options.requireSession, true); return { Authorization: "Bearer test-only" }; };
const live = { ...opportunityFixtures[0], source_type: "employer", active: true, published: true, verification_status: "verified", last_verified_at: "2025-01-01T00:00:00Z", expires_at: "2099-01-01T00:00:00Z", current_user_state: null };
const respond = (body, status = 200) => { globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }; };
try {
  respond({ success: true, opportunities: [live, ...opportunityFixtures, { ...live, active: false }, { ...live, deadline_at: "2000-01-01T00:00:00Z" }, { ...live, current_user_state: "dismissed" }] });
  const data = await listOpportunities(headers);
  assert.equal(data.opportunities.length, 1);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-only");
  assert.equal(calls[0].options.body, undefined, "No profile/user ID sent by the client");
  respond({ success: true, opportunities: [{ ...live, current_user_state: "saved" }, live] });
  assert.equal((await listOpportunities(headers, { filter: "saved" })).opportunities.length, 1);
  assert.match(calls.at(-1).url, /state=saved/);
  for (const state of ["saved", "dismissed"]) {
    respond({ success: true, opportunity_id: live.id, state });
    await updateOpportunityState(headers, live.id, state);
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), { state });
    assert.equal(calls.at(-1).options.method, "PATCH");
  }
  respond({ success: true, opportunity_id: "another", state: "saved" });
  await assert.rejects(updateOpportunityState(headers, live.id, "saved"), error => error.code === "INVALID_RESPONSE");
  respond({ success: true, opportunities: null });
  await assert.rejects(listOpportunities(headers), error => error.code === "INVALID_RESPONSE");
  for (const [status, body, code] of [[401, {}, "AUTH_REQUIRED"], [409, { error: "CAREER_PROFILE_REQUIRED" }, "CAREER_PROFILE_REQUIRED"], [503, { error: "sensitive server details" }, "RADAR_UNAVAILABLE"]]) {
    respond(body, status);
    await assert.rejects(listOpportunities(headers), error => error.code === code && !error.message.includes("sensitive"));
  }
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return new Promise(() => {}); };
  await assert.rejects(requestOpportunityRadar("/api/opportunity-radar", () => new Promise(() => {}), { timeoutMs: 10 }), error => error.code === "TIMEOUT");
  assert.equal(requests, 0, "Timeout also bounds session retrieval");
  await assert.rejects(requestOpportunityRadar("/api/opportunity-radar", headers, { timeoutMs: 10 }), error => error.code === "TIMEOUT");
  const controller = new AbortController();
  controller.abort();
  const before = requests;
  await assert.rejects(listOpportunities(headers, { signal: controller.signal }), error => error.code === "CANCELLED");
  assert.equal(requests, before);
  assert.match(radarErrorMessage({ code: "TIMEOUT" }, "TR", true), /doğrulanamadı/);
  process.stdout.write("Radar client: verified/live guards, All/Saved filters, exact state payloads, safe errors, response validation, timeout including session lookup and cancellation passed.\n");
} finally { globalThis.fetch = originalFetch; }
