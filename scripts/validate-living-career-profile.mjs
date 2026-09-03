import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mergeOnboardingDraft,
  mergeProfileSectionPreservingExisting,
} from "../lib/careerOnboarding/stateIntegrity.js";
import {
  buildProfileChangeEvents,
  mergeProfileProgressIntoCareerGps,
  getRecentProfileProgress,
} from "../lib/careerOnboarding/profileProgress.js";

const now = "2026-08-22T12:00:00.000Z";

const existingProfile = {
  onboarding_completed: true,
  basic_profile: {
    fullName: "Existing User",
    university: "Existing University",
    languages: [{ id: "english", level: "B1" }],
    experienceSignals: ["internship_1"],
    leadershipSignals: ["none"],
    cvStatus: "uploaded_local",
    linkedin: "https://linkedin.example/safe",
  },
  career_goals: {
    targetRoles: ["business_analyst"],
    industries: ["TECH"],
    companyStages: ["startup"],
  },
  career_gps: {
    decision_loop: {
      actions: [{ action_id: "action_1", status: "started" }],
      outcomes: [{ outcome_id: "outcome_1" }],
      evidence_candidates: [{ candidate_id: "candidate_existing", target_dimension: "stakeholder" }],
    },
    profile_history: [],
    snapshot: {
      careerPotential: 63,
      careerReadiness: 59,
      recruiterTrust: 24,
      roleMatch: 56,
    },
  },
};

const updatedProfile = {
  ...existingProfile,
  basic_profile: {
    ...existingProfile.basic_profile,
    languages: [{ id: "english", level: "B2" }],
    leadershipSignals: ["project_lead"],
  },
  career_gps: {
    ...existingProfile.career_gps,
    snapshot: {
      ...existingProfile.career_gps.snapshot,
      careerReadiness: 61,
    },
  },
};

function testSafeMerge() {
  const merged = mergeProfileSectionPreservingExisting(
    { university: "Existing University", targetRoles: ["business_analyst"], linkedin: "https://linkedin.example/safe" },
    { university: "", targetRoles: [], linkedin: "" }
  );
  assert.equal(merged.university, "Existing University", "empty UI default must not erase existing university");
  assert.deepEqual(merged.targetRoles, ["business_analyst"], "empty multiselect must not erase existing target roles");
  assert.equal(merged.linkedin, "https://linkedin.example/safe", "empty link default must not erase existing link");

  const explicitResidenceClear = mergeProfileSectionPreservingExisting(
    {
      residenceCountryCode: "TR",
      residenceCountry: "TR",
      countryCode: "TR",
      country: "TR",
      residenceCity: "Istanbul",
      city: "Istanbul",
      homeCity: "Istanbul",
    },
    {
      residenceCountryCode: "",
      residenceCountry: "",
      countryCode: "",
      country: "",
      residenceCity: "",
      city: "",
      homeCity: "",
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
  assert.equal(explicitResidenceClear.residenceCountryCode, "", "intentional residence country clear must persist");
  assert.equal(explicitResidenceClear.countryCode, "", "legacy country alias must clear with residence country");
  assert.equal(explicitResidenceClear.residenceCity, "", "dependent residence city must clear");
  assert.equal(explicitResidenceClear.city, "", "legacy city alias must clear with residence city");

  const remoteDraftClear = mergeOnboardingDraft(
    {
      basic: {
        residenceCountryCode: "TR",
        countryCode: "TR",
        residenceCity: "Istanbul",
        city: "Istanbul",
      },
    },
    {
      basic: {
        residenceCountryCode: "",
        countryCode: "",
        residenceCity: "",
        city: "",
      },
    },
    {
      step: 1,
      clearFields: {
        basic: ["residenceCountryCode", "countryCode", "residenceCity", "city"],
      },
    }
  );
  assert.equal(remoteDraftClear.basic.residenceCountryCode, "", "remote draft merge must preserve cleared country");
  assert.equal(remoteDraftClear.basic.city, "", "remote draft merge must preserve cleared city");
}

function testChangeHistory() {
  const events = buildProfileChangeEvents(existingProfile, updatedProfile, { now, source: "profile_edit" });
  assert.ok(events.some((event) => event.field === "english_level"), "English level change should be recorded");
  assert.ok(events.some((event) => event.field === "leadership_signals"), "Leadership change should be recorded");
  assert.ok(events.some((event) => event.field === "career_readiness"), "real score movement should be recorded when output changes");
  assert.equal(events.some((event) => event.field === "fullName"), false, "cosmetic personal name changes should not drive progress history");

  const gps = mergeProfileProgressIntoCareerGps(existingProfile.career_gps, updatedProfile.career_gps, events, {
    userId: "user_1",
    now,
  });
  assert.equal(gps.decision_loop.actions.length, 1, "active weekly action must be preserved");
  assert.equal(gps.decision_loop.outcomes.length, 1, "existing outcomes must be preserved");
  assert.ok(
    gps.decision_loop.evidence_candidates.some((candidate) => candidate.candidate_type === "profile_development"),
    "evidence-worthy profile changes should create a conservative profile development candidate"
  );
  assert.ok(gps.profile_history.length >= 3, "meaningful profile changes should be retained in history");
  assert.equal(getRecentProfileProgress({ career_gps: gps }, { days: 30, now }).length, gps.profile_history.length);

  const noOpEvents = buildProfileChangeEvents(updatedProfile, updatedProfile, { now, source: "profile_edit" });
  assert.equal(noOpEvents.length, 0, "saving unchanged profile should be idempotent");
}

function testCompletedProfileRouteSource() {
  const onboardingSource = readFileSync("src/CareerOnboardingPage.jsx", "utf8");
  assert.match(onboardingSource, /function selectHydrationDraft/, "hydration should use an explicit draft precedence helper");
  assert.match(
    onboardingSource,
    /localTime >= serverTime \? localDraft : null/,
    "local drafts must not beat newer persisted server drafts"
  );
  assert.match(onboardingSource, /if \(loading \|\| !draftHydrated\) return;/, "draft persistence must wait for definitive hydration");
  assert.match(onboardingSource, /mode: editMode \? "edit" : "create"/, "drafts should record whether they belong to an active edit flow");
  assert.match(
    onboardingSource,
    /data\.profile\?\.onboarding_completed && \(snapshotMode \|\| !editMode\)/,
    "completed /career-dna route should open saved profile/snapshot by default"
  );
  assert.match(onboardingSource, /Profili Düzenle/, "saved profile surface should expose edit action");
  assert.match(onboardingSource, /Değişiklikleri Kaydet/, "edit mode should use explicit save language");
  assert.match(onboardingSource, /Yeni Gelişme Ekle/, "profile should expose new development entry point");
  assert.match(onboardingSource, /buildOnboardingClearFields/, "onboarding should send explicit clear metadata");
  assert.match(
    onboardingSource,
    /onResidenceCountryChange=\{\(code\) =>\s*\n\s*setBasic\(\(current\) =>/s,
    "residence country changes must use functional state to avoid stale batched restores"
  );
  assert.match(
    onboardingSource,
    /onResidenceCityChange=\{\(c\) => setBasic\(\(current\) =>/,
    "residence city changes must use functional state"
  );
}

testSafeMerge();
testChangeHistory();
testCompletedProfileRouteSource();

process.stdout.write("Living Career Profile validation passed.\n");
