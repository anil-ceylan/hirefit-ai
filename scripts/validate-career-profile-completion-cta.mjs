import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { completeCareerOnboarding } from "../src/utils/careerOnboardingClient.js";

const source = readFileSync("src/CareerOnboardingPage.jsx", "utf8");

function testCompletionClientEmitsPost() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          success: true,
          mode: "created",
          profile: {
            user_id: "user_cta_1",
            onboarding_completed: true,
            basic_profile: { fullName: "CTA Test User" },
          },
        };
      },
    };
  };

  return completeCareerOnboarding(
    "",
    async () => ({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    }),
    {
      basic: { fullName: "CTA Test User" },
      goals: { primaryRole: "product_manager" },
      dnaAnswers: {},
      readinessAnswers: {},
      cv: { cvStatus: "none" },
      lang: "TR",
    }
  ).then((result) => {
    globalThis.fetch = originalFetch;
    assert.equal(calls.length, 1, "completion client should make exactly one request");
    assert.equal(calls[0].url, "/api/career-onboarding/complete", "completion client must target the server completion endpoint");
    assert.equal(calls[0].options.method, "POST", "completion client must use POST");
    assert.equal(calls[0].options.headers.Authorization, "Bearer test-token", "completion request must include bearer auth");
    assert.equal(result.success, true, "successful server profile should be propagated as success");
    assert.equal(result.profile?.user_id, "user_cta_1", "successful completion must return server-backed profile");
  }).catch((error) => {
    globalThis.fetch = originalFetch;
    throw error;
  });
}

async function testFailedCompletionDoesNotAllowSnapshotSuccess() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { success: true, mode: "local", profile: null, storageUnavailable: true };
    },
  });

  try {
    const result = await completeCareerOnboarding("", async () => ({ Authorization: "Bearer test-token" }), {});
    assert.equal(result.success, false, "storage-unavailable completion must be failure");
    assert.equal(result.profile, null, "storage-unavailable completion must not include a fake local profile");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testVisibleCtaPathUsesTerminalCompletionOnly() {
  assert.match(source, /const READINESS_PANEL_ORDER = \["evidence", "experience", "final"\]/, "step 4 should have explicit internal panel order");
  assert.match(source, /const onReadinessNext = async \(\) => \{[\s\S]*validateReadinessPanelBeforeNext\(\)[\s\S]*moveReadinessPanel\(1\)/, "non-terminal readiness panels should advance internally");
  assert.match(source, /readinessPanel !== "final" \? \([\s\S]*onClick=\{onReadinessNext\}[\s\S]*\) : \([\s\S]*onClick=\{onComplete\}/, "visible completion CTA should only call onComplete on the final readiness panel");
  assert.match(source, /if \(!validation\.ok\) \{[\s\S]*resolveCompletionTargetFromMissing\(validation\.missing, lang\)[\s\S]*return;/, "validation early returns should route the user to the missing panel");
  assert.match(source, /const result = await completeCareerOnboarding\([\s\S]*if \(!result\.success \|\| result\.offline \|\| !result\.profile\)/, "Snapshot transition must require a real server-backed completion result");
}

await testCompletionClientEmitsPost();
await testFailedCompletionDoesNotAllowSnapshotSuccess();
testVisibleCtaPathUsesTerminalCompletionOnly();

process.stdout.write("Career Profile completion CTA validation passed.\n");
