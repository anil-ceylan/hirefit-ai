import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { getCareerDnaQuestions } from "../lib/careerOnboarding/careerDna.js";
import { emptyReadinessAnswers } from "../lib/careerOnboarding/readinessBenchmarks.js";
import { EXPERIENCE_SIGNAL_OPTIONS, LEADERSHIP_SIGNAL_OPTIONS, normalizeSignalSelection } from "../lib/careerOnboarding/careerSignalSchema.js";
import { mergeOnboardingDraft } from "../lib/careerOnboarding/stateIntegrity.js";

// Exercise the page's actual handlers, hydration effect, draft payload and selected
// class expression. Unrelated form normalizers are stubbed; no network/browser required.
const source = readFileSync(process.argv[2] || "src/CareerOnboardingPage.jsx", "utf8").replace(/\r\n/g, "\n");
function between(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `page block exists: ${start}`);
  return source.slice(from, to);
}
const hydrateCode = between("  const hydrate = useCallback(", "\n\n  useEffect(");
const effectCode = between("  useEffect(() => {\n    if (authStatus ===", "\n\n  useEffect(");
const persistenceCode = between("  const persistDraft = async", "\n\n  useEffect(");
const localSaveCode = between("  useEffect(() => {\n    if (loading || !draftHydrated || step >= 5)", "\n\n  useEffect(");
const nextCode = between("  const onNext = async", "\n\n  const buildEducationLocationMetadata");
const selectionExpression = source.match(/className=\{(`hf-likert-btn.*`)\}/)?.[1];
const clickExpression = source.match(/onClick=\{\(\) => (setDnaAnswers\([^\n]+)\}/)?.[1];
assert.ok(selectionExpression && clickExpression, "controlled Likert buttons exist");
const backMarker = source.indexOf('if (step === 2 && goalsPanel !== "target")', source.indexOf("{step < 5 ? ("));
const backStart = source.lastIndexOf("onClick={async () => {", backMarker) + "onClick={async () => {".length;
const backEnd = source.indexOf("\n              }}", backMarker);
assert.ok(backMarker > 0 && backEnd > backStart, "Back handler exists");
const backCode = source.slice(backStart, backEnd);
const draftSelectionCode = between("function getDraftTimestamp", "\nfunction buildGenerationSteps");
const dnaCompleteCode = between("function isDnaComplete", "\nconst inputClass");
const questions = getCareerDnaQuestions("TR");
const answers = Object.fromEntries(questions.map((q, index) => [q.id, index % 5 + 1]));
const plain = (value) => JSON.parse(JSON.stringify(value));

function page({ userId = "dna-test-user", storedDraft = null } = {}) {
  const storage = new Map();
  const context = {
    userId, userEmail: "", user: { id: userId }, lang: "TR", tr: true,
    authStatus: "authenticated", isUserEmailVerified: true,
    dnaAnswers: {}, dnaOwnerRef: { current: userId },
    basic: {}, goals: {}, readinessAnswers: {}, cv: {}, mbtiAnswers: {},
    showMbti: false, showAllRoles: false, goalsPanel: "target", readinessPanel: "evidence",
    step: 3, loading: false, draftHydrated: true, saving: false,
    editMode: false, snapshotMode: false, apiBase: "", DRAFT_KEY: "test-draft", DRAFT_SCHEMA_VERSION: 10,
    EXPERIENCE_SIGNAL_OPTIONS, LEADERSHIP_SIGNAL_OPTIONS, normalizeSignalSelection,
    emptyReadinessAnswers, getCareerDnaQuestions,
    normalizeBasicLocation: (value) => value,
    normalizeGoalsLocation: (value) => value,
    getResidenceCountryCode: () => "",
    normalizeLookingFor: () => [],
    normalizeLanguagesArray: (value) => value || [],
    getProfileBasicHydrationPayload: () => null,
    emptyCvProfile: () => ({}),
    buildOnboardingClearFields: () => ({}),
    useCallback: (callback) => callback,
    useEffect: (callback, dependencies) => { context.effect = callback; context.dependencies = dependencies; },
    navigate: () => { throw new Error("unexpected navigation out of onboarding"); },
    getApiAuthHeaders: async () => ({}),
    loadOnboardingDraft: () => storedDraft,
    localStorage: { setItem: (key, value) => storage.set(key, value) },
    window: { setTimeout: (callback) => { context.timer = callback; return 1; }, clearTimeout: () => {} },
    saveOnboardingDraft: async (_base, _headers, payload) => {
      context.saved = plain(payload);
      return { offline: false };
    },
  };
  for (const key of ["dnaAnswers", "basic", "goals", "readinessAnswers", "cv", "mbtiAnswers", "showMbti", "step", "showAllRoles", "goalsPanel", "readinessPanel", "profileExists", "questions", "offlineMode", "summary", "draftHydrated", "loading", "saving", "error"]) {
    context[`set${key[0].toUpperCase()}${key.slice(1)}`] = (update) => {
      context[key] = typeof update === "function" ? update(context[key]) : update;
    };
  }
  context.hydrate = runInNewContext(`(() => { ${hydrateCode}; return hydrate; })()`, context);
  context.persistDraft = runInNewContext(`(() => { ${persistenceCode}; return persistDraft; })()`, context);
  context.onNext = runInNewContext(`(() => { ${nextCode}; return onNext; })()`, context);
  context.isDnaComplete = runInNewContext(`(() => { ${dnaCompleteCode}; return isDnaComplete; })()`, context);
  context.selectHydrationDraft = runInNewContext(`(() => { ${draftSelectionCode}; return selectHydrationDraft; })()`, context);
  context.storage = storage;
  return context;
}

function click(context, q, n) {
  context.q = q;
  context.n = n;
  runInNewContext(`((q, n) => ${clickExpression})(q, n)`, context);
}
function assertSelected(context, expected, label) {
  assert.deepEqual(plain(context.dnaAnswers), expected, label);
  for (const q of questions) {
    for (let n = 1; n <= 5; n += 1) {
      const className = runInNewContext(selectionExpression, { dnaAnswers: context.dnaAnswers, q, n });
      assert.equal(className.includes("hf-likert-btn--active"), Number(expected[q.id]) === n, `${label}: ${q.id}/${n}`);
    }
  }
}

// Regression: even an empty saved answer map used to overwrite the selected draft.
const restored = page();
restored.hydrate({ dnaAnswers: answers, lastStep: 3 }, { career_dna: { answers: {} } });
assertSelected(restored, answers, "draft wins over empty completed-profile answer map");
const edited = page();
edited.hydrate({ dnaAnswers: { likert_1: 5 } }, { career_dna: { answers: { likert_1: 1, likert_2: 2 } } });
assert.equal(edited.dnaAnswers.likert_1, 5, "draft edits win over old saved answers");
assert.equal(edited.dnaAnswers.likert_2, 2, "saved profile fills questions absent from draft");

// Actual click -> parent state -> Next save/navigation -> Back -> selected classes.
const current = page();
for (const q of questions) click(current, q, answers[q.id]);
assertSelected(current, answers, "clicked answers");
await current.onNext();
assert.equal(current.step, 4);
assert.deepEqual(current.saved.draft.dnaAnswers, answers, "remote draft payload includes every answer");
await runInNewContext(`(async () => { ${backCode} })()`, current);
assert.equal(current.step, 3);
assertSelected(current, answers, "Next then Back");
await runInNewContext(`(async () => { ${backCode} })()`, current);
assert.equal(current.step, 2);
current.goalsPanel = "roles";
current.goals = { targetRoles: ["test-role"], primaryRole: "test-role" };
await current.onNext();
assert.equal(current.step, 3);
assertSelected(current, answers, "away to previous step then return");

// Both local debounce and server draft restoration survive a fresh page instance.
runInNewContext(localSaveCode, current);
const cancelLocalSave = current.effect();
current.timer();
cancelLocalSave();
const localDraft = JSON.parse(current.storage.get("test-draft"));
assert.deepEqual(localDraft.dnaAnswers, answers);
const profile = { onboarding_draft: mergeOnboardingDraft({}, current.saved.draft, { step: 3 }), career_dna: { answers: {} } };
for (const draft of [null, localDraft]) {
  const fresh = page();
  fresh.hydrate(fresh.selectHydrationDraft({ localDraft: draft, profile, editMode: false }), profile);
  assertSelected(fresh, answers, draft ? "fresh local draft" : "fresh server draft without localStorage");
}

// A late response must not replace live selections with stale/empty answers.
current.hydrate({ dnaAnswers: { likert_1: 1 } }, { career_dna: { answers: {} } });
assertSelected(current, answers, "late same-user hydration preserves live answers");
const anotherUser = page({ userId: "another-dna-user" });
anotherUser.dnaOwnerRef.current = "dna-test-user";
anotherUser.dnaAnswers = answers;
anotherUser.hydrate({}, null);
assert.deepEqual(plain(anotherUser.dnaAnswers), {}, "answers never carry across accounts");

// Functional setters must also retain every update in a batched render.
const batched = page();
const pending = [];
const applyAnswer = batched.setDnaAnswers;
batched.setDnaAnswers = (update) => pending.push(update);
for (const q of questions) click(batched, q, answers[q.id]);
pending.forEach(applyAnswer);
assertSelected(batched, answers, "batched answer updates");

// Auth object identity changes alone must not trigger rehydration.
const lifecycle = page();
runInNewContext(effectCode, lifecycle);
const dependencies = lifecycle.dependencies;
lifecycle.user = { ...lifecycle.user };
lifecycle.step = 4;
lifecycle.readinessPanel = "final";
runInNewContext(effectCode, lifecycle);
assert.equal(dependencies.length, lifecycle.dependencies.length);
assert.ok(dependencies.every((value, index) => Object.is(value, lifecycle.dependencies[index])), "same-user session events and panel/step changes must not restart hydration");

// A still-active slow request must preserve answers clicked after it started.
const inFlight = page({ storedDraft: { dnaAnswers: {} } });
let finishRequest;
inFlight.fetchCareerOnboarding = () => new Promise((resolve) => { finishRequest = resolve; });
runInNewContext(effectCode, inFlight);
const stopRequest = inFlight.effect();
for (const q of questions) click(inFlight, q, answers[q.id]);
finishRequest({ profile: { career_dna: { answers: {} } }, questions });
await new Promise(setImmediate);
assertSelected(inFlight, answers, "active slow hydration cannot replace live clicks");
stopRequest();

// Cleanup must ignore responses after unmount, account or mode changes.
for (const rejectRequest of [false, true]) {
  const late = page({ storedDraft: { dnaAnswers: { likert_1: 1 } } });
  let resolve;
  let reject;
  late.fetchCareerOnboarding = () => new Promise((yes, no) => { resolve = yes; reject = no; });
  runInNewContext(effectCode, late);
  const cleanup = late.effect();
  cleanup();
  late.dnaAnswers = answers;
  late.setDraftHydrated(false);
  late.setLoading(true);
  if (rejectRequest) reject(new Error("synthetic cancelled request"));
  else resolve({ profile: { career_dna: { answers: {} } }, questions: [] });
  await new Promise(setImmediate);
  assertSelected(late, answers, "cancelled hydration cannot overwrite newer page state");
  assert.equal(late.draftHydrated, false, "cancelled request cannot finish another page's hydration");
  assert.equal(late.loading, true);
}

assert.deepEqual(getCareerDnaQuestions("TR").map((q) => q.id), getCareerDnaQuestions("EN").map((q) => q.id), "question IDs remain stable across languages");
process.stdout.write("Career DNA state: navigation, draft restoration, live-edit precedence, batching, account isolation and cancelled hydration passed.\n");
