import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as constants from "../lib/careerOnboarding/constants.js";

// Execute the actual page handlers and memo/effect dependency lifecycle with the
// real role catalogue and normalizers. No network or database is involved.
const source = readFileSync(process.argv[2] || "src/CareerOnboardingPage.jsx", "utf8").replace(/\r\n/g, "\n");
const plain = (value) => JSON.parse(JSON.stringify(value));
function between(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return source.slice(from, to);
}
const roleStart = source.includes("  const selectedIndustriesKey") ? "  const selectedIndustriesKey" : "  const selectedIndustries =";
const roleCode = between(roleStart, "  const hasCreativeDirection");
const effectCode = between("  useEffect(() => {\n    if (!selectedIndustries.length) return;", "\n\n  useEffect(");
const normalizer = between("function normalizeGoalsLocation", "function isDnaComplete");
const toggleCode = between("  const toggleTargetRole", "  const updateReadinessSignals");
const nextCode = between("  const onNext = async", "\n\n  const buildEducationLocationMetadata");
const marker = source.indexOf('if (step === 2 && goalsPanel !== "target")', source.indexOf("{step < 5 ? ("));
const backStart = source.lastIndexOf("onClick={async () => {", marker) + "onClick={async () => {".length;
const backCode = source.slice(backStart, source.indexOf("\n              }}", marker));
const button = source.match(/<button\s+type="button"\s+className="hf-onboard-show-more-roles"[\s\S]*?<\/button>/)?.[0];
assert.ok(button, "expansion is a non-submit button");
const click = button.match(/onClick=\{([^\n]+)\}/)?.[1];
assert.ok(click && button.includes("aria-expanded={showAllRoles}"));
assert.ok(source.includes("visibleRoleOptions.map((role) => ("), "render uses computed options");
const disabled = source.match(/<RoleChip[\s\S]*?disabled=\{([\s\S]*?)\}/)?.[1];
assert.ok(disabled, "role selection disabled gate exists");
const industries = constants.INDUSTRIES.slice(0, 3).map(({ id }) => id);
const context = {
  ...constants, INITIAL_ROLE_VISIBLE: 10, lang: "TR", tr: true,
  goals: constants.normalizeCareerGoals({ industries }),
  showAllRoles: false, step: 2, goalsPanel: "roles", saving: false,
  basic: {}, error: "", getResidenceCountryCode: () => "TR",
};
let dirty = false;
for (const key of ["goals", "showAllRoles", "step", "saving", "error", "roleLimitNotice"]) {
  context[`set${key[0].toUpperCase()}${key.slice(1)}`] = (update) => {
    const value = typeof update === "function" ? update(context[key]) : update;
    dirty ||= !Object.is(value, context[key]);
    context[key] = value;
  };
}
const same = (a, b) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const memos = [];
let cursor;
let effectDeps;
context.useMemo = (factory, deps) => {
  const index = cursor++;
  if (!same(memos[index]?.deps, deps)) memos[index] = { deps, value: factory() };
  return memos[index].value;
};
context.useEffect = (callback, deps) => {
  if (!same(effectDeps, deps)) { effectDeps = deps; callback(); }
};
runInNewContext(`${normalizer}\nthis.normalizeGoalsLocation = normalizeGoalsLocation;`, context);
context.persistDraft = async () => { context.saved = plain({ goals: context.goals, ui: { showAllRoles: context.showAllRoles } }); };
function render() {
  for (let pass = 0; pass < 10; pass += 1) {
    dirty = false;
    cursor = 0;
    context.primaryIndustry = context.goals.primaryIndustry;
    runInNewContext(`(() => { ${roleCode}\n${effectCode}\nthis.visible = visibleRoleOptions; })()`, context);
    if (!dirty) return;
  }
  assert.fail("role reconciliation must settle instead of looping/resetting expansion");
}
function toggle(role) {
  context.role = role;
  runInNewContext(`(() => { ${toggleCode}; toggleTargetRole(role); })()`, context);
  render();
}
render();
assert.deepEqual(plain(context.visible), constants.getTopRolesForIndustries(industries, 10));
const initial = plain(context.visible);
initial.slice(0, 3).forEach(toggle);
runInNewContext(`(${click})()`, context);
render();
assert.equal(context.showAllRoles, true);
const extra = context.visible.find((role) => !initial.includes(role));
assert.ok(extra, "expansion exposes additional roles even at 3/3");
assert.equal(runInNewContext(disabled, { goals: context.goals, MAX_TARGET_ROLES: 3, role: extra }), true);
toggle(extra);
assert.equal(context.goals.targetRoles.length, 3);
assert.ok(!context.goals.targetRoles.includes(extra), "handler also enforces cap");
toggle(initial[0]);
assert.equal(runInNewContext(disabled, { goals: context.goals, MAX_TARGET_ROLES: 3, role: extra }), false);
toggle(extra);
const finalRoles = plain(context.goals.targetRoles);
assert.equal(finalRoles.length, 3);
assert.ok(finalRoles.includes(extra));
await runInNewContext(`(async () => { ${nextCode}; await onNext(); })()`, context);
assert.equal(context.step, 3, context.error);
await runInNewContext(`(async () => { ${backCode} })()`, context);
render();
assert.equal(context.step, 2);
assert.deepEqual(plain(context.goals.targetRoles), finalRoles);
assert.equal(context.showAllRoles, true);
assert.deepEqual(context.saved.goals.targetRoles, finalRoles);
// Recreate the arrays as draft hydration does; unchanged sectors must not run
// reconciliation again or undo the restored expansion preference.
context.setGoals(context.normalizeGoalsLocation(plain(context.saved.goals)));
context.setShowAllRoles(context.saved.ui.showAllRoles);
render();
assert.equal(context.showAllRoles, true);
assert.ok(context.visible.includes(extra));
assert.deepEqual(plain(context.goals.targetRoles), finalRoles);
process.stdout.write("Role expansion: subset, click, cap, replacement, Next/Back, draft restoration and effect stability passed.\n");
