import assert from "node:assert/strict";
import fs from "node:fs";

import vercelHandler, { normalizeVercelApiPath } from "../api/[...route].js";
import { handleCareerApi } from "../lib/vercelApi/careerApiRouter.js";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = "";
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  end(chunk = "") {
    this.body += String(chunk);
    return this;
  }
}

function mockRequest(method, url, headers = {}, query = {}) {
  return {
    method,
    url,
    query,
    headers: {
      host: "www.hirefit.co",
      ...headers,
    },
    async *[Symbol.asyncIterator]() {},
  };
}

async function invoke(method, path, headers) {
  const req = mockRequest(method, path, headers);
  const res = new MockResponse();
  await handleCareerApi(req, res, path);
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    json = null;
  }
  return { status: res.statusCode, body: res.body, json, headers: res.headers };
}

async function invokeVercelEntry(method, url, query) {
  const req = mockRequest(method, url, {}, query);
  const res = new MockResponse();
  await vercelHandler(req, res);
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    json = null;
  }
  return { status: res.statusCode, body: res.body, json, headers: res.headers };
}

function listApiFunctionFiles() {
  return fs
    .readdirSync("api", { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath || "api"}/${entry.name}`.replaceAll("\\", "/"));
}

function testVercelEntryFiles() {
  const rootCatchAll = read("api/[...route].js");
  const vercelConfig = JSON.parse(read("vercel.json"));
  const spaFallback = vercelConfig.rewrites?.find((rewrite) => rewrite.destination === "/index.html");
  const apiFiles = listApiFunctionFiles();

  assert.match(rootCatchAll, /handleCareerApi/, "Root API catch-all must delegate to the shared router.");
  assert.equal(apiFiles.length, 1, "Vercel API layout should use one non-conflicting catch-all function.");
  assert.deepEqual(apiFiles, ["api/[...route].js"], "Do not reintroduce conflicting nested catch-all routes.");
  assert.ok(spaFallback?.source?.includes("api/"), "SPA fallback should continue excluding /api routes.");
}

function testPathNormalization() {
  assert.equal(
    normalizeVercelApiPath(mockRequest("POST", "/api/[...route]?route=account/avatar", {}, { route: "account/avatar" })),
    "/api/account/avatar",
    "String route params should normalize nested avatar paths."
  );
  assert.equal(
    normalizeVercelApiPath(mockRequest("GET", "/api/[...route]?route=career-actions&route=current", {}, { route: ["career-actions", "current"] })),
    "/api/career-actions/current",
    "Array route params should normalize nested career action paths."
  );
  assert.equal(
    normalizeVercelApiPath(mockRequest("POST", "/api/[...route]?route=api/career-onboarding/complete", {}, { route: "api/career-onboarding/complete" })),
    "/api/career-onboarding/complete",
    "Route params that already contain api should not duplicate the prefix."
  );
  assert.equal(
    normalizeVercelApiPath(mockRequest("GET", "/api/health")),
    "/api/health",
    "URL pathname fallback should preserve direct /api paths."
  );
  assert.equal(
    normalizeVercelApiPath(mockRequest("POST", "/account/avatar")),
    "/api/account/avatar",
    "URL pathname fallback should add the /api prefix for catch-all runtime paths."
  );
}

function testSharedRouterInventory() {
  const router = read("lib/vercelApi/careerApiRouter.js");

  for (const expected of [
    'path === "/api/account/avatar" && method === "POST"',
    'path === "/api/account/avatar" && method === "DELETE"',
    'path === "/api/career-actions/current" && method === "GET"',
    'path === "/api/career-profile" && method === "GET"',
    'path === "/api/health" && method === "GET"',
  ]) {
    assert.ok(router.includes(expected), `Shared Vercel router missing ${expected}.`);
  }
}

async function testRuntimeRouteHandling() {
  const health = await invoke("GET", "/api/health");
  assert.equal(health.status, 200, "Health route should remain available.");
  assert.equal(health.json?.ok, true, "Health route should return ok: true.");

  const careerProfile = await invoke("GET", "/api/career-profile");
  assert.equal(careerProfile.status, 200, "Career profile should preserve unauthenticated safe response.");
  assert.equal(careerProfile.json?.success, true, "Career profile should keep its existing safe body.");

  const avatarUpload = await invoke("POST", "/api/account/avatar");
  assert.equal(avatarUpload.status, 401, "Unauthenticated avatar upload must reach auth, not 404.");
  assert.equal(avatarUpload.json?.error, "Missing bearer token");

  const avatarDelete = await invoke("DELETE", "/api/account/avatar");
  assert.equal(avatarDelete.status, 401, "Unauthenticated avatar delete must reach auth, not 404.");
  assert.equal(avatarDelete.json?.error, "Missing bearer token");

  const currentAction = await invoke("GET", "/api/career-actions/current");
  assert.equal(currentAction.status, 401, "Nested career action routes should reach auth, not Vercel 404.");
  assert.equal(currentAction.json?.error, "Missing bearer token");

  const onboardingComplete = await invoke("POST", "/api/career-onboarding/complete");
  assert.equal(onboardingComplete.status, 401, "Other nested API routes should reach auth, not Vercel 404.");
  assert.equal(onboardingComplete.json?.error, "Missing bearer token");
}

async function testVercelEntryRouteHandling() {
  const avatarUpload = await invokeVercelEntry("POST", "/api/[...route]?route=account/avatar", {
    route: "account/avatar",
  });
  assert.equal(avatarUpload.status, 401, "String route param avatar upload should reach auth.");
  assert.equal(avatarUpload.json?.error, "Missing bearer token");

  const avatarDelete = await invokeVercelEntry("DELETE", "/api/[...route]?route=account/avatar", {
    route: ["account", "avatar"],
  });
  assert.equal(avatarDelete.status, 401, "Array route param avatar delete should reach auth.");
  assert.equal(avatarDelete.json?.error, "Missing bearer token");

  const currentAction = await invokeVercelEntry("GET", "/api/[...route]?route=career-actions&route=current", {
    route: ["career-actions", "current"],
  });
  assert.equal(currentAction.status, 401, "Array route param career action should reach auth.");
  assert.equal(currentAction.json?.error, "Missing bearer token");
}

testVercelEntryFiles();
testPathNormalization();
testSharedRouterInventory();
await testRuntimeRouteHandling();
await testVercelEntryRouteHandling();

process.stdout.write("Vercel API routing validation passed.\n");
