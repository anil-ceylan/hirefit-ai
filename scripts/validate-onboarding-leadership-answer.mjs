import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { isOnboardingReadinessComplete, validateOnboardingForComplete } from "../lib/careerOnboarding/validateOnboarding.js";
import { mergeOnboardingDraft } from "../lib/careerOnboarding/stateIntegrity.js";
import { normalizeProfileBasicForForm } from "../src/utils/careerProfileFormHydration.js";

const source = readFileSync("src/CareerOnboardingPage.jsx", "utf8");
const statusSetter = source.indexOf("leadershipExperienceStatus: option.id");
const clickStart = source.lastIndexOf("onClick={() => {", statusSetter) + "onClick={() => {".length;
const clickEnd = source.indexOf("\n                              }}", statusSetter);
assert.ok(statusSetter > 0 && clickEnd > clickStart, "leadership chip handler must be present");
const clickBody = source.slice(clickStart, clickEnd);
const nextStart = source.indexOf("  const validateReadinessPanelBeforeNext =");
const nextEnd = source.indexOf("\n  useEffect(", nextStart);
assert.ok(nextStart > 0 && nextEnd > nextStart, "Next validation and handler must be present");
const nextHandlers = source.slice(nextStart, nextEnd);

const otherAnswers = { english: "basic", network: "no_professional_network", experience: "none", projects: "none", leadership: "" };

// Execute the page's actual controlled chip handler and Next gate, without a browser or network.
for (const status of ["yes", "no", "unsure", ""]) {
  const context = {
    basic: { leadershipExperienceStatus: "", leadershipSignals: [] },
    readinessAnswers: { ...otherAnswers },
    readinessPanel: "experience",
    tr: true,
    option: { id: status },
    error: "",
    moves: [],
    isOnboardingReadinessComplete,
  };
  context.setBasic = (update) => { context.basic = update(context.basic); };
  context.setReadinessAnswers = (update) => { context.readinessAnswers = update(context.readinessAnswers); };
  context.setError = (value) => { context.error = value; };
  context.moveReadinessPanel = async (direction) => { context.moves.push(direction); };
  if (status) runInNewContext(clickBody, context);
  await runInNewContext(`${nextHandlers}\nonReadinessNext();`, context);
  assert.equal(context.moves.length, status ? 1 : 0, `${status || "unanswered"}: Next progression`);
  assert.equal(Boolean(context.error), !status, `${status || "unanswered"}: validation error`);
  assert.equal(context.basic.leadershipExperienceStatus, status, "controlled value must retain its meaning");

  const validation = validateOnboardingForComplete({ basic: context.basic, readinessAnswers: context.readinessAnswers, lang: "EN" });
  assert.equal(validation.missing.includes("Career readiness benchmarks"), !status, "final completion must use the same readiness gate");
  const draft = mergeOnboardingDraft({}, { basic: context.basic, readinessAnswers: context.readinessAnswers });
  const restored = normalizeProfileBasicForForm({}, { basic_profile: JSON.parse(JSON.stringify(draft.basic)) }, "TR");
  assert.equal(restored.leadershipExperienceStatus, status, "draft/server basic_profile round trip must retain the disclosure");
}

for (const unanswered of ["", null, "invalid"]) {
  assert.equal(isOnboardingReadinessComplete({ ...otherAnswers, leadership: "none" }, { leadershipExperienceStatus: unanswered }), false, "stale benchmark must not override an explicit unanswered/invalid disclosure");
}
assert.equal(isOnboardingReadinessComplete(otherAnswers, {}), false, "no disclosure and no legacy benchmark is unanswered");
assert.equal(isOnboardingReadinessComplete({ ...otherAnswers, leadership: "project_lead" }, {}), true, "legacy answered profiles remain valid");
for (const key of ["english", "network", "experience", "projects"]) {
  assert.equal(isOnboardingReadinessComplete({ ...otherAnswers, [key]: "" }, { leadershipExperienceStatus: "unsure" }), false, `${key} is still required`);
}

process.stdout.write("Onboarding leadership answers: yes/no/unsure proceed; unanswered blocked; completion and restoration passed.\n");
