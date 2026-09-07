import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as constants from "../lib/careerOnboarding/constants.js";
import React from "react";
import { transformSync } from "esbuild";
import { mergeOnboardingDraft } from "../lib/careerOnboarding/stateIntegrity.js";

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
// Render the actual selected-card component and invoke its remove/rank buttons.
const componentCode = between("function RankedPriorityList", "function OnboardingSubnav");
const labelsCode = between("function rankSlotLabel", "function RecommendedBadge");
const RankedPriorityList = runInNewContext(
  `${transformSync(`${labelsCode}\n${componentCode}`, { loader: "jsx", jsx: "transform" }).code}\nRankedPriorityList`,
  { React, ArrowUp: () => null, ArrowDown: () => null }
);
assert.match(source, /onMove=\{moveRankedRole\}\s+onRemove=\{toggleTargetRole\}/, "selected roles wire removal to the existing controlled handler");
const moveCode = between("  const moveRankedRole", "  const [dnaAnswers");
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
}
function cards(lang = "TR") {
  return nodes(RankedPriorityList({
    items: context.goals.targetRoles, getItemLabel: (role) => constants.getRoleLabel(role, lang),
    onMove: (roleValue, direction) => {
      context.roleValue = roleValue;
      context.direction = direction;
      runInNewContext(`(() => { ${moveCode}; moveRankedRole(roleValue, direction); })()`, context);
      render();
    },
    onRemove: toggle, lang, kind: "role",
  })).filter((node) => node.props?.className === "hf-onboard-role-rank-row");
}
function assertRanking(expected) {
  assert.deepEqual(plain(context.goals.targetRoles), expected);
  assert.deepEqual([context.goals.primaryRole, context.goals.secondaryRole, context.goals.tertiaryRole],
    [expected[0] || "", expected[1] || "", expected[2] || ""]);
  cards().forEach((row, index) => {
    assert.equal(nodes(row).find((n) => n.props?.className === "hf-onboard-role-rank-index").props.children, index + 1);
    assert.equal(nodes(row).find((n) => n.type === "small").props.children,
      ["En güçlü rol yönün", "Yedek rol yönün", "Keşif rol yönün"][index]);
  });
}
for (const removedIndex of [0, 1, 2]) {
  const original = initial.slice(0, 3);
  context.setGoals(context.normalizeGoalsLocation({ industries, targetRoles: original }));
  render();
  const rows = cards();
  assert.equal(rows.length, 3);
  for (const row of rows) {
    const buttons = nodes(row).filter((n) => n.type === "button");
    assert.equal(buttons.length, 3, "each card has two rank controls and a distinct remove button");
    const remove = buttons.find((n) => n.props.children === "Kaldır");
    assert.equal(remove.props.type, "button");
    assert.ok(remove.props["aria-label"].endsWith("kaldır"));
    assert.ok(!remove.props.disabled);
  }
  nodes(rows[removedIndex]).find((n) => n.props?.children === "Kaldır").props.onClick();
  const remaining = original.filter((_, index) => index !== removedIndex);
  assertRanking(remaining);
  assert.equal(context.goals.targetRoles.length, 2, "count frees a slot immediately");
  assert.equal(runInNewContext(disabled, { goals: context.goals, MAX_TARGET_ROLES: 3, role: extra }), false);
  toggle(extra);
  const replacement = [...remaining, extra];
  assertRanking(replacement);
  toggle(original[removedIndex]);
  assertRanking(replacement); // fourth selection remains blocked
  await runInNewContext(`(async () => { ${nextCode}; await onNext(); })()`, context);
  assert.equal(context.step, 3);
  await runInNewContext(`(async () => { ${backCode} })()`, context);
  render();
  assertRanking(replacement);
  // Local JSON and server draft merge retain order through real goal normalization.
  for (const draft of [plain(context.saved), mergeOnboardingDraft({}, context.saved, { step: 2 })]) {
    context.setGoals(context.normalizeGoalsLocation(draft.goals));
    render();
    assertRanking(replacement);
  }
  assert.equal(context.showAllRoles, true);
  const up = nodes(cards()[2]).find((n) => n.type === "button" && n.props["aria-label"]?.endsWith("yukarı taşı"));
  up.props.onClick();
  assertRanking([replacement[0], replacement[2], replacement[1]]);
  const down = nodes(cards()[1]).find((n) => n.type === "button" && n.props["aria-label"]?.endsWith("aşağı taşı"));
  down.props.onClick();
  assertRanking(replacement);
}
assert.equal(nodes(cards("EN")[0]).filter((n) => n.props?.children === "Remove").length, 1);
assert.equal(nodes(RankedPriorityList({ items: ["sector"], getItemLabel: (v) => v, onMove: () => {}, lang: "TR", kind: "industry" })).filter((n) => n.type === "button").length, 2, "other ranked lists are unchanged");
process.stdout.write("Selected role removal: all ranks, controls, priorities, replacement, cap, navigation, draft order and ranking passed.\n");
// All other ranked sections use the same rendered control and their existing
// toggle/reorder handlers. Exercise each rank at its real selection cap.
const handlers = between("  const toggleIndustry", "  const toggleInternationalIndustry");
const movePanelCode = between("  const moveGoalsPanel", "  const moveReadinessPanel");
context.MAX_PRIORITY_COUNTRIES = 5;
context.GOALS_PANEL_ORDER = ["target", "environment", "roles"];
context.setGoalsPanel = (panel) => { context.goalsPanel = panel; };
for (const name of ["Industry", "CompanyIndustry", "LookingFor", "TargetCountry"]) {
  context[`set${name}LimitNotice`] = () => {};
}
const sections = [
  { field: "industries", toggle: "toggleIndustry", move: "moveRankedIndustry", options: constants.INDUSTRIES.map((o) => o.id), cap: 3, kind: "industry" },
  { field: "lookingFor", toggle: "toggleLookingFor", move: "moveRankedLookingFor", options: constants.LOOKING_FOR_OPTIONS.map((o) => o.id), cap: 3, kind: "looking" },
  { field: "companyIndustries", toggle: "toggleCompanyIndustry", move: "moveRankedCompanyIndustry", options: constants.COMPANY_INDUSTRY_OPTIONS.map((o) => o.id), cap: 3, kind: "companyIndustry" },
  { field: "targetCountries", toggle: "toggleInternationalCountry", move: "moveRankedInternationalCountry", options: constants.INTERNATIONAL_COUNTRY_GROUPS.flatMap((g) => g.countries), cap: 5, kind: "companyIndustry" },
];
for (const section of sections) {
  assert.ok(source.includes(`onRemove={${section.toggle}}`), `${section.field} wires remove`);
  const options = [...new Set(section.options)];
  assert.ok(options.length > section.cap);
  function invoke(name, item, direction) {
    context.item = item;
    context.direction = direction;
    runInNewContext(`(() => { ${handlers}; ${name}(item, direction); })()`, context);
    render();
  }
  function sectionRows() {
    return nodes(RankedPriorityList({
      items: context.goals[section.field], getItemLabel: (item) => item, lang: "TR", kind: section.kind,
      onMove: (item, direction) => invoke(section.move, item, direction),
      onRemove: (item) => invoke(section.toggle, item),
    })).filter((n) => n.props?.className === "hf-onboard-role-rank-row");
  }
  function check(expected) {
    assert.deepEqual(plain(context.goals[section.field]), expected, section.field);
    if (section.field === "industries") {
      assert.deepEqual([context.goals.primaryIndustry, context.goals.secondaryIndustry, context.goals.tertiaryIndustry],
        [expected[0] || "", expected[1] || "", expected[2] || ""]);
    }
    sectionRows().forEach((row, index) => {
      assert.equal(nodes(row).find((n) => n.props?.className === "hf-onboard-role-rank-index").props.children, index + 1);
      assert.equal(nodes(row).filter((n) => n.props?.children === "Kaldır").length, 1);
    });
  }
  for (let rank = 0; rank < section.cap; rank += 1) {
    const original = options.slice(0, section.cap);
    context.setGoals(context.normalizeGoalsLocation({ industries, [section.field]: original }));
    render();
    check(original);
    nodes(sectionRows()[rank]).find((n) => n.props?.children === "Kaldır").props.onClick();
    const remaining = original.filter((_, index) => index !== rank);
    check(remaining);
    invoke(section.toggle, options[section.cap]);
    const replacement = [...remaining, options[section.cap]];
    check(replacement);
    invoke(section.toggle, original[rank]);
    check(replacement); // cap still blocks an additional selection
    context.step = 2;
    context.goalsPanel = "environment";
    context.selectedIndustries = context.goals.industries;
    context.moveGoalsPanel = runInNewContext(`(() => { ${movePanelCode}; return moveGoalsPanel; })()`, context);
    await runInNewContext(`(async () => { ${nextCode}; await onNext(); })()`, context);
    assert.equal(context.goalsPanel, "roles");
    await runInNewContext(`(async () => { ${backCode} })()`, context);
    assert.equal(context.goalsPanel, "environment");
    check(replacement);
    for (const draft of [plain(context.saved), mergeOnboardingDraft({}, context.saved, { step: 2 })]) {
      context.setGoals(context.normalizeGoalsLocation(draft.goals));
      render();
      check(replacement);
    }
    nodes(sectionRows()[1]).find((n) => n.type === "button" && n.props["aria-label"]?.endsWith("yukarı taşı")).props.onClick();
    check([replacement[1], replacement[0], ...replacement.slice(2)]);
    nodes(sectionRows()[0]).find((n) => n.type === "button" && n.props["aria-label"]?.endsWith("aşağı taşı")).props.onClick();
    check(replacement);
  }
}
assert.equal((source.match(/<RankedPriorityList/g) || []).length, sections.length + 1, "every ranked section is audited");
process.stdout.write("Ranked sectors, employment preferences, company industries and countries: removal at every rank, caps, replacement, navigation, restoration and reorder passed.\n");
process.stdout.write("Role expansion: subset, click, cap, replacement, Next/Back, draft restoration and effect stability passed.\n");
