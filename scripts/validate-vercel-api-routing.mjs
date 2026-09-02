import assert from "node:assert/strict";
import fs from "node:fs";

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

function mockRequest(method, url, headers = {}) {
  return {
    method,
    url,
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

function testVercelEntryFiles() {
  const rootCatchAll = read("api/[...route].js");
  const nestedCatchAll = read("api/[route]/[...rest].js");
  const vercelConfig = JSON.parse(read("vercel.json"));
  const spaFallback = vercelConfig.rewrites?.find((rewrite) => rewrite.destination === "/index.html");

  assert.match(rootCatchAll, /handleCareerApi/, "Root API catch-all must delegate to the shared router.");
  assert.match(nestedCatchAll, /handleCareerApi/, "Nested API catch-all must delegate to the shared router.");
  assert.ok(spaFallback?.source?.includes("api/"), "SPA fallback should continue excluding /api routes.");
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
}

testVercelEntryFiles();
testSharedRouterInventory();
await testRuntimeRouteHandling();

process.stdout.write("Vercel API routing validation passed.\n");
