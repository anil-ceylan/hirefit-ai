import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { rowToFullProfile } from "../lib/careerOnboarding/persistence.js";
import { mergeProfileSectionPreservingExisting } from "../lib/careerOnboarding/stateIntegrity.js";
import {
  getProfileBasicHydrationPayload,
  getResidenceCountryCode,
  getUniversityCities,
  normalizeProfileBasicForForm,
} from "../src/utils/careerProfileFormHydration.js";

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

process.stdout.write("Career Profile server restoration validation passed.\n");
