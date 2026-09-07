import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { rowToFullProfile } from "../lib/careerOnboarding/persistence.js";
import { mergeProfileSectionPreservingExisting } from "../lib/careerOnboarding/stateIntegrity.js";
import {
  getProfileBasicHydrationPayload,
  getResidenceCountryCode,
  getUniversityCities,
  normalizeProfileBasicForForm,
} from "../src/utils/careerProfileFormHydration.js";

async function testCompletionRouteContracts() {
  const root = new URL("../", import.meta.url);
  const expressUrl = new URL("lib/careerOnboarding/onboardingRoutes.js", root).href;
  const vercelUrl = new URL("lib/vercelApi/careerApiRouter.js", root).href;
  const persistenceUrl = new URL("lib/careerOnboarding/persistence.js", root).href;
  const authUrl = new URL("lib/auth/verifySupabaseJwt.js", root).href;
  const fixtureKey = "__hirefitCompletionRouteTest";
  const sensitive = "SYNTHETIC_PRIVATE_PROFILE_SQL_TOKEN_SECRET";
  const user = { id: "authenticated-test-user" };
  const calls = [];
  const logs = [];
  let outcome;
  const fixture = {
    async complete(...args) {
      calls.push(args);
      if (outcome.exception) throw outcome.exception;
      return outcome.result;
    },
    async getUser(token) {
      if (token === "unavailable-session") throw new Error("network unavailable");
      return token === "valid-session"
        ? { data: { user }, error: null }
        : { data: { user: null }, error: { message: sensitive } };
    },
  };
  const mockUrl = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
  const persistenceMock = mockUrl(`
    export const completeOnboarding = (...args) => globalThis.${fixtureKey}.complete(...args);
    const unused = () => { throw new Error('Unexpected non-completion persistence call'); };
    export { unused as loadFullCareerProfile, unused as upsertOnboardingDraft, unused as saveFirstAnalysis };
  `);
  const authClientMock = mockUrl(`
    export const createClient = () => ({ auth: {
      getUser: (...args) => globalThis.${fixtureKey}.getUser(...args)
    }});
  `);
  const originalFixture = globalThis[fixtureKey];
  const originalError = console.error;
  const envNames = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
  const originalEnv = envNames.map((name) => process.env[name]);
  globalThis[fixtureKey] = fixture;
  process.env.VITE_SUPABASE_URL = "https://completion-test.invalid";
  process.env.VITE_SUPABASE_ANON_KEY = "synthetic-anon-key";
  // Load real route registration/dispatch and real auth middleware. Replace only
  // the completion boundary and auth SDK transport; no HTTP/database calls occur.
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL === authUrl && specifier === "@supabase/supabase-js") {
        return { url: authClientMock, shortCircuit: true };
      }
      if ([expressUrl, vercelUrl].includes(context.parentURL) && specifier.startsWith(".")) {
        if (new URL(specifier, context.parentURL).href === persistenceUrl) {
          return { url: persistenceMock, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    const { registerOnboardingRoutes } = await import(expressUrl);
    const { default: vercelHandler } = await import(new URL("api/career-onboarding/[...rest].js", root));
    const routes = new Map();
    const app = Object.fromEntries(["get", "post", "patch"].map((method) => [
      method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers),
    ]));
    registerOnboardingRoutes(app);
    const expressHandlers = routes.get("post /api/career-onboarding/complete");
    assert.ok(expressHandlers?.length >= 2, "completion retains its auth middleware");
    console.error = (...args) => logs.push(args);

    const storageFailure = {
      success: false, profile: null, storageUnavailable: true,
      error: "Career profile storage unavailable",
    };
    const exceptionFailure = {
      success: false, profile: null, error: "Career profile completion failed",
    };
    const profile = { user_id: user.id, onboarding_completed: true };
    const cases = [
      { name: "created", result: { mode: "created", profile }, status: 200, expected: { success: true, mode: "created", profile } },
      { name: "updated", result: { mode: "updated", profile }, status: 200, expected: { success: true, mode: "updated", profile } },
      { name: "storage unavailable", result: { mode: "local", storageUnavailable: true, profile: { private: sensitive }, diagnostics: { message: sensitive, details: sensitive, hint: sensitive } }, status: 503, expected: storageFailure },
      { name: "missing profile", result: { storageUnavailable: false, profile: null }, status: 503, expected: storageFailure },
      { name: "missing result", result: undefined, status: 503, expected: storageFailure },
      { name: "thrown persistence error", exception: { code: "PGRST205", message: sensitive, details: sensitive, hint: sensitive, sql: sensitive, token: sensitive }, status: 500, expected: exceptionFailure },
      { name: "unexpected application error", exception: new Error(sensitive), status: 500, expected: exceptionFailure },
    ];
    for (const implementation of ["Express", "Vercel"]) {
      async function invoke(authorization) {
        const req = {
          method: "POST", url: "/api/career-onboarding/complete",
          query: { rest: ["complete"] },
          headers: authorization ? { authorization } : {},
          body: { user_id: "forged-client-user", basic: { fullName: sensitive }, lang: "TR" },
        };
        const res = {
          statusCode: 200, body: null,
          setHeader() {},
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
          end(body) { this.body = JSON.parse(body); },
        };
        if (implementation === "Vercel") await vercelHandler(req, res);
        else {
          const next = (index = 0) => expressHandlers[index]?.(req, res, () => next(index + 1));
          await next();
        }
        return res;
      }
      for (const testCase of cases) {
        outcome = testCase;
        calls.length = 0;
        logs.length = 0;
        const res = await invoke("Bearer valid-session");
        const label = `${implementation}: ${testCase.name}`;
        assert.equal(res.statusCode, testCase.status, label);
        assert.deepEqual(res.body, testCase.expected, label);
        assert.equal(calls.length, 1, `${label}: one persistence call`);
        assert.equal(calls[0][0], user.id, `${label}: authenticated user ID wins over request body`);
        assert.ok(!JSON.stringify(logs).includes(sensitive), `${label}: no sensitive logs`);
        assert.ok(!JSON.stringify(res.body).includes(sensitive), `${label}: no sensitive public diagnostics`);
        assert.notEqual(res.body.mode, "local", `${label}: no local success fallback`);
        if (testCase.status !== 200) {
          assert.equal(res.body.success, false, label);
          assert.equal(res.body.profile, null, label);
          assert.deepEqual(logs, [[testCase.status === 503
            ? "[career-onboarding:complete] storage_unavailable"
            : "[career-onboarding:complete] completion_failed"]], `${label}: fixed event only`);
        }
      }
      for (const [authorization, status, error] of [
        [undefined, 401, "Missing bearer token"],
        ["Bearer invalid-session", 401, "Invalid session token"],
        ["Bearer unavailable-session", 503, "Auth service unavailable"],
      ]) {
        calls.length = 0;
        logs.length = 0;
        const res = await invoke(authorization);
        assert.equal(res.statusCode, status, `${implementation}: auth status unchanged`);
        assert.deepEqual(res.body, { error }, `${implementation}: auth response unchanged`);
        assert.equal(calls.length, 0, `${implementation}: auth failure prevents persistence`);
        assert.deepEqual(logs, [], `${implementation}: rejected auth does not log input`);
      }
    }
  } finally {
    hooks.deregister();
    console.error = originalError;
    if (originalFixture === undefined) delete globalThis[fixtureKey];
    else globalThis[fixtureKey] = originalFixture;
    envNames.forEach((name, index) => {
      if (originalEnv[index] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[index];
    });
  }
}

const emptyBasic = {
  firstName: "",
  lastName: "",
  fullName: "",
  age: "",
  ageRange: "",
  country: "",
  countryCode: "",
  city: "",
  residenceCountry: "",
  residenceCountryCode: "",
  residenceCity: "",
  universityCountryCode: "",
  universityCountry: "",
  universityCity: "",
  universityCities: [],
  educationCities: [],
};

function freshFormInstance(profile) {
  return normalizeProfileBasicForForm({ ...emptyBasic }, profile, "TR");
}

function assertCoreFields(hydrated, label) {
  assert.equal(hydrated.fullName, "Muhammet Anıl Ceylan", `${label}: full name must hydrate from server`);
  assert.equal(hydrated.age, "24", `${label}: age must hydrate from server`);
  assert.equal(getResidenceCountryCode(hydrated), "TR", `${label}: residence country must hydrate from server`);
  assert.equal(hydrated.residenceCity, "İstanbul", `${label}: residence city must hydrate from server`);
  assert.equal(hydrated.universityCountryCode, "CY", `${label}: university country must hydrate from server`);
  assert.deepEqual(getUniversityCities(hydrated), ["Gazimağusa"], `${label}: education cities must hydrate from server`);
}

function buildCurrentServerRow() {
  return {
    user_id: "user_restore_1",
    onboarding_completed: true,
    updated_at: "2026-09-04T09:00:00.000Z",
    basic_profile: {
      fullName: "Muhammet Anıl Ceylan",
      age: "24",
      residenceCountryCode: "TR",
      residenceCountry: "TR",
      countryCode: "TR",
      country: "TR",
      residenceCity: "İstanbul",
      city: "İstanbul",
      universityCountryCode: "CY",
      universityCountry: "CY",
      universityCities: ["Gazimağusa"],
      educationCities: ["Gazimağusa"],
      educationLocation: {
        country: "CY",
        countryCode: "CY",
        city: "Gazimağusa",
        cities: ["Gazimağusa"],
        educationCities: ["Gazimağusa"],
      },
    },
    career_goals: {
      industries: ["technology"],
      primaryIndustry: "technology",
      targetRoles: ["product_manager"],
      primaryRole: "product_manager",
      experienceLevels: ["intern", "entry"],
      companyStages: ["startup"],
      targetCountries: ["Germany"],
    },
    career_dna: { answers: {} },
    career_readiness: { benchmarks: {} },
    career_gps: {
      decision_loop: {
        actions: [{ action_id: "action_existing", status: "started" }],
      },
      snapshot: { careerPotential: 63 },
    },
  };
}

function buildLegacyNestedServerRow() {
  return {
    user_id: "user_restore_legacy",
    onboarding_completed: true,
    updated_at: "2026-09-04T09:00:00.000Z",
    basic_profile: {
      fullName: "Muhammet Anıl Ceylan",
      age: "24",
      residenceLocation: {
        countryCode: "TR",
        city: "İstanbul",
      },
      education_location: {
        country: "CY",
        countryCode: "CY",
        city: "Gazimağusa",
        cities: ["Gazimağusa"],
      },
    },
    career_goals: {},
    career_dna: { answers: {} },
    career_readiness: { benchmarks: {} },
    career_gps: {
      inputs: {
        educationLocation: {
          countryCode: "CY",
          city: "Gazimağusa",
          cities: ["Gazimağusa"],
        },
      },
      decision_loop: { actions: [{ action_id: "action_existing" }] },
    },
  };
}

function testServerFetchHydratesFreshInstances() {
  const profile = rowToFullProfile(buildCurrentServerRow());
  const firstFreshInstance = freshFormInstance(profile);
  assertCoreFields(firstFreshInstance, "first fresh instance");

  const secondFreshInstance = freshFormInstance(profile);
  assertCoreFields(secondFreshInstance, "second fresh instance after remount");
}

function testLegacyNestedServerProfileHydratesFreshInstance() {
  const profile = rowToFullProfile(buildLegacyNestedServerRow());
  const payload = getProfileBasicHydrationPayload(profile);
  assert.ok(payload.educationLocation?.countryCode, "legacy education location must be part of hydration payload");
  const hydrated = freshFormInstance(profile);
  assertCoreFields(hydrated, "legacy nested server profile");
}

function testSaveThenFreshFetchHydrate() {
  const savePayload = {
    fullName: "Muhammet Anıl Ceylan",
    age: "24",
    residenceCountryCode: "TR",
    residenceCountry: "TR",
    countryCode: "TR",
    country: "TR",
    residenceCity: "İstanbul",
    city: "İstanbul",
    homeCity: "İstanbul",
    universityCountryCode: "CY",
    universityCountry: "CY",
    universityCities: ["Gazimağusa"],
    educationCities: ["Gazimağusa"],
    educationLocation: {
      country: "CY",
      countryCode: "CY",
      city: "Gazimağusa",
      cities: ["Gazimağusa"],
      educationCities: ["Gazimağusa"],
    },
  };
  const savedRow = {
    ...buildCurrentServerRow(),
    basic_profile: savePayload,
  };
  const fetchedProfile = rowToFullProfile(savedRow);
  const hydrated = freshFormInstance(fetchedProfile);
  assertCoreFields(hydrated, "save -> fresh fetch -> hydrate");
}

function testEmptyDefaultsCannotOverwritePersistedProfileWithoutExplicitClears() {
  const existing = buildCurrentServerRow().basic_profile;
  const incomingDefaults = {
    fullName: "",
    age: "",
    residenceCountryCode: "",
    residenceCountry: "",
    countryCode: "",
    country: "",
    residenceCity: "",
    city: "",
    universityCountryCode: "",
    universityCountry: "",
    universityCities: [],
    educationCities: [],
  };
  const protectedMerge = mergeProfileSectionPreservingExisting(existing, incomingDefaults);
  assert.equal(protectedMerge.fullName, existing.fullName, "empty defaults must not erase server full name");
  assert.equal(protectedMerge.age, existing.age, "empty defaults must not erase server age");
  assert.equal(protectedMerge.residenceCountryCode, existing.residenceCountryCode, "empty defaults must not erase residence country");
  assert.equal(protectedMerge.residenceCity, existing.residenceCity, "empty defaults must not erase residence city");
  assert.equal(protectedMerge.universityCountryCode, existing.universityCountryCode, "empty defaults must not erase university country");
  assert.deepEqual(protectedMerge.universityCities, existing.universityCities, "empty defaults must not erase education cities");
}

function testResidenceClearRemainsNarrowAndAtomic() {
  const existing = buildCurrentServerRow().basic_profile;
  const cleared = mergeProfileSectionPreservingExisting(
    existing,
    {
      residenceCountryCode: "",
      residenceCountry: "",
      countryCode: "",
      country: "",
      residenceCity: "",
      city: "",
      homeCity: "",
      universityCountryCode: "",
      universityCities: [],
    },
    {
      clearFields: [
        "residenceCountryCode",
        "residenceCountry",
        "countryCode",
        "country",
        "residenceCity",
        "city",
        "homeCity",
      ],
    }
  );
  assert.equal(cleared.residenceCountryCode, "", "explicit residence country clear must persist");
  assert.equal(cleared.residenceCity, "", "residence city must clear with residence country");
  assert.equal(cleared.universityCountryCode, "CY", "university country must survive residence clear");
  assert.deepEqual(cleared.universityCities, ["Gazimağusa"], "education cities must survive residence clear");
}

function testHydrationPathIsUsedByCareerOnboardingPage() {
  const source = readFileSync("src/CareerOnboardingPage.jsx", "utf8");
  const clientSource = readFileSync("src/utils/careerOnboardingClient.js", "utf8");
  assert.match(
    source,
    /normalizeProfileBasicForForm\(b, profile, lang\)/,
    "CareerOnboardingPage must hydrate visible form state from server profile via canonical profile normalizer"
  );
  assert.match(
    source,
    /if \(loading \|\| !draftHydrated\) return;/,
    "remote/local draft saves must stay blocked until hydration is resolved"
  );
  assert.match(
    source,
    /getProfileBasicHydrationPayload\(profile\)/,
    "server basic profile payload must be normalized before UI hydration"
  );
  assert.match(
    source,
    /if \(!result\.success \|\| result\.offline \|\| !result\.profile\)/,
    "Career Profile completion must require a successful server-backed profile"
  );
  assert.match(
    source,
    /if \(!result\.success \|\| result\.offline \|\| !result\.profile\)[\s\S]*return;[\s\S]*localStorage\.removeItem\(DRAFT_KEY\)/,
    "failed server completion must return before the local draft is removed or Snapshot transition is allowed"
  );
  assert.doesNotMatch(
    source,
    /if \(result\.offline \|\| !profile\)[\s\S]*buildLocalOnboardingProfile/,
    "CareerOnboardingPage must not fabricate a saved local profile when server completion fails"
  );
  assert.match(
    clientSource,
    /mode: "storage_unavailable"[\s\S]*success: false|success: false[\s\S]*mode: "storage_unavailable"/,
    "careerOnboardingClient must report storage-unavailable completion as failure"
  );
  assert.match(
    clientSource,
    /if \(body\?\.storageUnavailable\) \{\s*return \{\s*success: false,\s*mode: "storage_unavailable",\s*profile: null,/,
    "careerOnboardingClient must not convert failed server completion into a local success"
  );
}

testServerFetchHydratesFreshInstances();
testLegacyNestedServerProfileHydratesFreshInstance();
testSaveThenFreshFetchHydrate();
testEmptyDefaultsCannotOverwritePersistedProfileWithoutExplicitClears();
testResidenceClearRemainsNarrowAndAtomic();
testHydrationPathIsUsedByCareerOnboardingPage();
await testCompletionRouteContracts();

process.stdout.write("Career Profile server restoration and Express/Vercel completion contracts passed.\n");
