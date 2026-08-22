import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  mergeOnboardingDraft,
  resolveExperienceSignalsForPersistence,
  resolveLeadershipSignalsForPersistence,
} from "../lib/careerOnboarding/stateIntegrity.js";
import { getCvProcessingLabel, resolveCvProcessingState } from "../lib/careerOnboarding/cvOptions.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");

const preservedDraft = mergeOnboardingDraft(
  {
    basic: {
      experienceSignals: ["startup_builder", "product_project"],
      leadershipSignals: ["team_lead"],
    },
  },
  {
    basic: {
      experienceSignals: [],
      leadershipSignals: [],
      city: "Istanbul",
    },
  },
  { step: 3 }
);

assert.deepEqual(preservedDraft.basic.experienceSignals, ["startup_builder", "product_project"]);
assert.deepEqual(preservedDraft.basic.leadershipSignals, ["team_lead"]);
assert.equal(preservedDraft.basic.city, "Istanbul");
assert.equal(preservedDraft.lastStep, 3);

assert.deepEqual(
  resolveExperienceSignalsForPersistence({
    incoming: [],
    basicValue: [],
    existing: ["internship"],
    benchmark: "",
  }),
  ["one_internship"]
);

assert.deepEqual(
  resolveLeadershipSignalsForPersistence({
    incoming: ["none"],
    basicValue: ["team_lead"],
    existing: ["founder"],
    benchmark: "team",
  }),
  ["none"]
);

assert.equal(
  getCvProcessingLabel(resolveCvProcessingState({ basic_profile: { cvUploaded: true, cvFileName: "cv.pdf" } }), "TR"),
  "CV yerel olarak yüklendi. Daha güvenilir analiz için CV’mi Analiz Et butonuyla işle."
);

assert.equal(
  getCvProcessingLabel(resolveCvProcessingState({ first_analysis: { cvSignalCount: 4 } }), "TR"),
  "CV — Analiz edildi"
);

const onboardingSource = read("src/CareerOnboardingPage.jsx");
assert.match(onboardingSource, /loadOnboardingDraft\(user\?\.id\)/);
assert.match(onboardingSource, /userId: user\?\.id \|\| null/);
assert.match(onboardingSource, /setBasic\(\(current\) =>/);
assert.match(onboardingSource, /leadershipSignals: option\.id === "no" \? \["none"\]/);

const persistenceSource = read("lib/careerOnboarding/persistence.js");
assert.match(persistenceSource, /mergeOnboardingDraft/);
assert.match(persistenceSource, /decision_loop: existing\?\.career_gps\?\.decision_loop/);

const firstAnalysisSource = read("src/components/onboarding/FirstCareerAnalysisFlow.jsx");
assert.match(firstAnalysisSource, /buildSnapshotWeeklyActionPayload/);
assert.match(firstAnalysisSource, /upsertRecommendedCareerAction/);

const navSource = read("src/App.jsx");
assert.match(navSource, /careerProfile\.career_snapshot\?\.readinessScore/);
assert.match(navSource, /Number\(potential\) > 0/);

console.error("Production stabilization validation passed.");
