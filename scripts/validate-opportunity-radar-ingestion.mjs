import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { SOURCES, validateSource } from "../lib/opportunityRadar/ingestion/registry.js";
import { canonicalUrl, publicIPv4, resolvePublic, readJson, requestOnce } from "../lib/opportunityRadar/ingestion/http.js";
import { normalizeGreenhouse, plainText } from "../lib/opportunityRadar/ingestion/normalize.js";
import { greenhouseAdapter, parseSnapshot } from "../lib/opportunityRadar/ingestion/greenhouse.js";
import { buildPlan, expiryPlan } from "../lib/opportunityRadar/ingestion/plan.js";
import { sanitizeDescription } from "../lib/opportunityRadar/ingestion/sanitize.js";
import { rfsmartReview, streamdownFragment } from "./fixtures/rfsmart-review.mjs";
import { vercelIntern, vercelLocationLabels } from "./fixtures/vercel-review.mjs";

const source = validateSource(JSON.parse(readFileSync(new URL("./fixtures/greenhouse-source.json", import.meta.url), "utf8")));
const input = JSON.parse(readFileSync(new URL("./fixtures/greenhouse-snapshot.json", import.meta.url), "utf8"));
const job = input.jobs[0];
const now = "2030-01-01T00:00:00.000Z";
assert.deepEqual(SOURCES, []);
assert.equal(validateSource({ ...source, enabled: undefined }).enabled, false);
assert.throws(() => validateSource(source, { live: true }), /SOURCE_NOT_APPROVED/);
// In-memory test-only permission; never registered or used to contact a live source.
const approved = { ...source, key: "greenhouse:approved", board: "approved", employer: "Authorized Employer", enabled: true, developmentOnly: false,
  permittedHosts: ["boards-api.greenhouse.io", "boards.greenhouse.io"], permission: { technicalFetch: { status: "approved", reference: "in-memory-test", reviewedBy: "test", reviewedAt: "2025-01-01", notes: "Read-only test authorization" }, descriptionAllowed: true } };
assert.throws(() => validateSource({ ...approved, board: "demo" }, { live: true }), /DEVELOPMENT_SOURCE/);
assert.throws(() => validateSource({ ...source, limits: { maxPages: 2 } }), /REQUEST_LIMIT/);
const normalized = normalizeGreenhouse(job, source);
assert.equal(normalized.candidate.subtype, "internship");
assert.equal(normalized.candidate.source_item_id, "101");
assert.equal(normalized.candidate.url, "https://jobs.fixture.invalid/jobs/101");
assert.equal(normalized.candidate.country, "TR");
assert.equal(normalized.candidate.published, false);
assert.deepEqual(normalized.candidate.eligibility, {});
for (const patch of [{ metadata: [] }, { metadata: [{ name: "Employment Type", value: "Contract" }] }]) {
  assert.deepEqual(normalizeGreenhouse({ ...job, ...patch }, source).issues, ["SUBTYPE_REQUIRES_REVIEW"]);
}
for (const patch of [{ internal_job_id: null }, { title: "Talent Community" }, { title: "General Application" }]) assert.equal(normalizeGreenhouse({ ...job, ...patch }, source).candidate, null);
const remote = normalizeGreenhouse({ ...job, location: { name: "Remote - Europe" }, metadata: [...job.metadata.filter(m => m.name !== "Workplace"), { name: "Workplace", value: "Remote" }] }, source).candidate;
assert.equal(remote.work_mode, "remote");
assert.equal(remote.country, null);
assert.equal(remote.city, null);
assert.deepEqual(remote.eligibility, {});
assert.equal(normalizeGreenhouse({ ...job, location: { name: "Remote" }, metadata: job.metadata.slice(0, 1) }, source).candidate.work_mode, null);
assert.equal(normalizeGreenhouse({ ...job, application_deadline: "2030-02-01" }, source).candidate, null);
assert.equal(normalizeGreenhouse(job, { ...source, permission: {} }).candidate.description, "");
assert.equal(plainText('&lt;script&gt;secret()&lt;/script&gt;<p>Hello &amp; welcome</p><img src=x onerror=alert(1)>'), "Hello & welcome");
assert.equal(plainText("&#60;style&#62;hidden&#60;/style&#62;Safe"), "Safe");
assert.equal(plainText("a".repeat(13000)).length, 12000);
assert.throws(() => plainText("a".repeat(200001)), /INVALID_DESCRIPTION/);
for (const url of ["javascript:alert(1)", "https://user:secret@boards.greenhouse.io/job", "https://127.0.0.1/job", "https://boards.greenhouse.io.evil.org/job", "http://boards.greenhouse.io/job", "https://boards.greenhouse.io:444/job", "not a url"]) assert.throws(() => canonicalUrl(url, approved.permittedHosts));
assert.equal(canonicalUrl("https://boards.greenhouse.io/Careers?gh_jid=12&utm_source=x#top", approved.permittedHosts), "https://boards.greenhouse.io/Careers?gh_jid=12");
for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.1.1", "192.168.0.1", "100.64.0.1", "198.18.0.1", "::1", "::ffff:127.0.0.1"]) assert.equal(publicIPv4(ip), false);
assert.equal(publicIPv4("8.8.8.8"), true);
await assert.rejects(resolvePublic("boards.greenhouse.io", async () => [{ address: "127.0.0.1" }]), /UNSAFE_DNS/);
await assert.rejects(resolvePublic("boards.greenhouse.io", () => new Promise(() => {}), 5), /DNS_TIMEOUT/);
// Exercise the actual byte reader and request deadline without opening a socket.
function fakeGet(body, { stall = false, contentType = "application/json" } = {}) {
  return (_url, options, callback) => {
    assert.equal(options.agent, false);
    options.lookup("ignored-host", { all: true }, (error, addresses) => {
      assert.equal(error, null);
      assert.deepEqual(addresses, [{ address: "8.8.8.8", family: 4 }]);
    });
    const req = new EventEmitter();
    req.destroy = error => { req.emit("error", error); req.emit("close"); };
    if (!stall) queueMicrotask(() => {
      const res = new EventEmitter();
      Object.assign(res, { statusCode: 200, headers: { "content-type": contentType }, destroy: () => req.emit("close") });
      callback(res);
      res.emit("data", Buffer.from(body));
      res.emit("end");
      req.emit("close");
    });
    return req;
  };
}
const smallLimits = { maxBytes: 10, timeoutMs: 10 };
await assert.rejects(requestOnce("https://boards.greenhouse.io", "8.8.8.8", smallLimits, fakeGet("x".repeat(11))), /RESPONSE_TOO_LARGE/);
await assert.rejects(requestOnce("https://boards.greenhouse.io", "8.8.8.8", smallLimits, fakeGet("{bad")), /INVALID_JSON/);
await assert.rejects(requestOnce("https://boards.greenhouse.io", "8.8.8.8", smallLimits, fakeGet("", { stall: true })), /REQUEST_TIMEOUT/);
await assert.rejects(requestOnce("https://boards.greenhouse.io", "8.8.8.8", smallLimits, fakeGet("{}", { contentType: "text/html" })), /INVALID_CONTENT_TYPE/);
assert.deepEqual((await requestOnce("https://boards.greenhouse.io", "8.8.8.8", smallLimits, fakeGet("{}"))).data, {});
let requests = 0;
await assert.rejects(readJson("https://boards-api.greenhouse.io/jobs", validateSource(approved), {
  resolve: async () => "8.8.8.8", request: async () => { requests++; return { status: 302, location: "https://127.0.0.1/private" }; },
}), /UNSAFE_URL_HOST/);
assert.equal(requests, 1);
let dnsCalls = 0;
await assert.rejects(readJson("https://boards-api.greenhouse.io/jobs", validateSource(approved), {
  resolve: async () => { if (++dnsCalls === 2) throw new Error("UNSAFE_DNS_DESTINATION"); return "8.8.8.8"; },
  request: async () => ({ status: 302, location: "https://boards.greenhouse.io/jobs" }),
}), /UNSAFE_DNS_DESTINATION/);
assert.equal(dnsCalls, 2);
await assert.rejects(readJson("https://boards-api.greenhouse.io/jobs", validateSource(approved), {
  resolve: async () => "8.8.8.8", request: async () => ({ status: 302, location: "/again" }),
}), /REDIRECT_LIMIT/);
requests = 0;
await assert.rejects(readJson("https://boards-api.greenhouse.io/jobs", validateSource(approved), {
  resolve: async () => "8.8.8.8", request: async () => { requests++; return { status: 503 }; }, sleep: async () => {},
}), /UPSTREAM_HTTP_503/);
assert.equal(requests, 2);
await assert.rejects(readJson("https://boards-api.greenhouse.io/jobs", validateSource(approved), {
  resolve: async () => "8.8.8.8", request: async () => ({ status: 429, retryAfter: "60" }),
}), /RETRY_DEFERRED/);
const snapshot = parseSnapshot(input, source, now);
assert.equal(snapshot.complete, true);
for (const bad of [{ jobs: [job], meta: { total: 2 } }, { jobs: [job] }, { jobs: [job], meta: { total: 1 }, next: "https://evil.org/page2" }, { error: "failure" }]) assert.equal(parseSnapshot(bad, source, now).complete, false);
const failedPage = await greenhouseAdapter.fetchSnapshot(approved, { transport: async () => { throw new Error("UPSTREAM_HTTP_503"); }, clock: () => new Date(now) });
assert.equal(failedPage.complete, false);
assert.deepEqual(failedPage.warnings, ["UPSTREAM_HTTP_503"]);
let called = false;
await assert.rejects(greenhouseAdapter.fetchSnapshot(source, { transport: async () => { called = true; } }));
assert.equal(called, false);
assert.equal(expiryPlan(normalized.candidate, source, now).expires_at, "2030-01-03T00:00:00.000Z");
assert.equal(expiryPlan({ ...normalized.candidate, deadline_at: now }, source, now).eligible, false);
assert.equal(expiryPlan({ ...normalized.candidate, deadline_at: "2030-01-01T12:00:00Z" }, source, now).expires_at, "2030-01-01T12:00:00.000Z");
const plan = buildPlan(source, snapshot);
assert.equal(plan.number_fetched, 2);
assert.equal(plan.number_normalized, 1);
assert.equal(plan.rejected.length, 1);
assert.equal(plan.planned_new_records.length, 1);
assert.equal(plan.planned_new_records[0].publishable, false);
const old = { ...normalized.candidate, id: "11111111-1111-4111-8111-111111111111" };
const update = buildPlan(source, snapshot, { existing: [old] });
assert.equal(update.planned_new_records.length, 0);
assert.equal(update.planned_updates[0].existing_id, old.id);
assert.ok(update.planned_updates[0].holds.includes("PRESERVE_OPERATOR_VISIBILITY_DECISION"));
const collision = buildPlan(source, snapshot, { existing: [{ ...old, source: "other:board" }] });
assert.equal(collision.url_collisions.length, 1);
assert.equal(collision.planned_new_records.length, 0);
const duplicate = buildPlan(source, { ...snapshot, items: [job, job] });
assert.equal(duplicate.potential_duplicates.length, 2);
assert.equal(duplicate.planned_new_records.length, 0);
assert.equal(buildPlan(source, { ...snapshot, items: [job, { ...job, metadata: [] }] }).planned_new_records.length, 0);
const incomplete = buildPlan(source, { ...snapshot, complete: false });
assert.ok(incomplete.planned_new_records[0].holds.includes("INCOMPLETE_SNAPSHOT"));
assert.equal(buildPlan(source, snapshot).digest, plan.digest);

// Independent scopes; no legacy or implicit republication approval.
assert.equal(validateSource(approved, { live: true }).permission.republication.status, "unreviewed");
assert.throws(() => validateSource({ ...approved, permission: { status: "approved" } }), /LEGACY_PERMISSION/);
assert.throws(() => validateSource({ ...approved, permission: { republication: approved.permission.technicalFetch } }, { live: true }), /SOURCE_NOT_APPROVED/);
assert.throws(() => validateSource({ ...approved, permission: { ...approved.permission, republication: { status: "approved" } } }), /INVALID_PERMISSION_SCOPE/);
const liveJob = { ...job, absolute_url: "https://boards.greenhouse.io/approved/jobs/101" };
const technicalPlan = buildPlan(approved, { ...snapshot, items: [liveJob] }, { mode: "live", inventoryComplete: true });
assert.equal(technicalPlan.republication_approved, false);
assert.equal(technicalPlan.authorization.technicalFetch.notes, "Read-only test authorization");
assert.ok(technicalPlan.planned_new_records[0].holds.includes("REPUBLICATION_NOT_APPROVED"));
assert.equal(technicalPlan.planned_new_records[0].publishable, false);
const bothScopes = buildPlan({ ...approved, permission: { ...approved.permission, republication: { ...approved.permission.technicalFetch } } },
  { ...snapshot, items: [liveJob] }, { mode: "live", inventoryComplete: true });
assert.equal(bothScopes.republication_approved, true);
assert.equal(bothScopes.planned_new_records[0].publishable, false);

// Minimal identity facts from the Duolingo pilot; no network or descriptions.
const duo = { ...source, employer: "Duolingo", employerKey: "duolingo", key: "greenhouse:duolingounirecruitment",
  locationMappings: { "Pittsburgh, PA": { country: "US", city: "Pittsburgh" }, "New York, NY": { country: "US", city: "New York" }, "Seattle, WA": { country: "US", city: "Seattle" } } };
for (const [universityId, mainId, internalId] of [[8806188002, 8806187002, 6524029002], [8806878002, 8805925002, 6523904002], [8806115002, 8806114002, 6523993002]]) {
  const university = { ...job, id: universityId, internal_job_id: internalId, absolute_url: `https://jobs.fixture.invalid/university/${universityId}` };
  const main = normalizeGreenhouse({ ...university, id: mainId, absolute_url: `https://jobs.fixture.invalid/main/${mainId}` }, { ...duo, key: "greenhouse:duolingo" });
  const inventory = { ...main.candidate, id: old.id, reviewFacts: main.reviewFacts };
  const reconciliation = buildPlan(duo, { ...snapshot, items: [university] }, { existing: [inventory] });
  assert.ok(reconciliation.potential_duplicates.some(d => d.reason === "SHARED_EMPLOYER_INTERNAL_JOB_ID_REVIEW"));
  assert.equal(reconciliation.planned_updates.length, 0, "Never merge on internal identity");
  assert.equal(reconciliation.planned_new_records[0].candidate.source_item_id, String(universityId));
  assert.ok(reconciliation.planned_new_records[0].holds.includes("SHARED_EMPLOYER_INTERNAL_JOB_ID_REVIEW"));
  const otherEmployer = { ...inventory, reviewFacts: { ...main.reviewFacts, internalJobIdentity: { ...main.reviewFacts.internalJobIdentity, employer_key: "different-employer" } } };
  assert.ok(!buildPlan(duo, { ...snapshot, items: [university] }, { existing: [otherEmployer] }).potential_duplicates.some(d => d.reason === "SHARED_EMPLOYER_INTERNAL_JOB_ID_REVIEW"));
}
const multiJob = { ...job, location: { name: "Pittsburgh, PA; New York, NY; Seattle, WA" }, metadata: job.metadata.slice(0, 1) };
const multi = normalizeGreenhouse(multiJob, duo);
assert.deepEqual(multi.reviewFacts.locations.map(l => l.city), ["Pittsburgh", "New York", "Seattle"]);
assert.equal(multi.candidate.country, null);
assert.equal(multi.candidate.city, null);
assert.equal(multi.candidate.work_mode, null);
assert.equal(Object.hasOwn(multi.candidate, "reviewFacts"), false);
const single = normalizeGreenhouse({ ...job, location: { name: "Pittsburgh, PA" } }, duo);
assert.equal(single.candidate.city, "Pittsburgh");
assert.equal(single.candidate.country, "US");
assert.equal(single.reviewFacts.locations.length, 1);
assert.equal(normalizeGreenhouse(job, source).reviewFacts.internalJobIdentity, null, "Never infer employer scope from display name");
assert.equal(normalizeGreenhouse({ ...job, location: { name: Array(11).fill("City").join(";") } }, duo).candidate, null);
assert.equal(buildPlan(duo, { ...snapshot, items: [multiJob] }).planned_new_records[0].reviewFacts.locations.length, 3);

const rfSource = validateSource({ ...source, key: "greenhouse:rfsmart", employer: "RF-SMART", employerKey: "rfsmart",
  evidenceRules: { sourceKey: "greenhouse:rfsmart", status: "approved", reference: "Offline RF-SMART regression review", reviewedBy: "test", reviewedAt: "2025-01-01", titleInternship: true, statements: true },
  locationMappings: { "Jacksonville, Florida, United States": { country: "US", city: "Jacksonville" } } });
const rf = normalizeGreenhouse(rfsmartReview, rfSource);
assert.equal(rf.candidate.subtype, "internship");
assert.ok(rf.evidence.some(e => e.rule === "standalone-internship-title-v1" && e.source === rfSource.key));
assert.equal(rf.candidate.work_mode, null, "Narrative facts do not silently become work-mode classification");
assert.deepEqual(rf.candidate.eligibility, {});
assert.deepEqual(rf.candidate.requirements, {});
assert.ok(rf.reviewFacts.workAuthorization.some(e => e.excerpt.includes("without future sponsorship") && e.postingId === String(rfsmartReview.id)));
assert.ok(rf.reviewFacts.education.some(e => /Junior or Senior/.test(e.excerpt)));
assert.ok(rf.reviewFacts.education.some(e => /undergraduate.*graduate/.test(e.excerpt)));
assert.ok(rf.reviewFacts.workplace.some(e => e.excerpt.includes("in-office")));
assert.ok(normalizeGreenhouse({ ...rfsmartReview, content: "<p>Work on-site in Jacksonville.</p>" }, rfSource).reviewFacts.workplace[0].excerpt.includes("on-site"));
assert.equal(rf.reviewFacts.programPeriods[0].startDate, "2027-05-30");
assert.equal(rf.reviewFacts.programPeriods[0].endDate, "2027-07-30");
assert.equal(rf.reviewFacts.durationClaims[0].value, 12);
assert.ok(rf.issues.includes("CONTRADICTORY_DURATION_DATE_EVIDENCE"));
assert.equal(rf.candidate.deadline_at, null);
assert.equal(rf.candidate.starts_at, null);
assert.equal(rf.candidate.ends_at, null);
assert.equal(expiryPlan(rf.candidate, rfSource, now).expires_at, "2030-01-03T00:00:00.000Z", "Program duration is not freshness expiry");
const rfPlan = buildPlan(rfSource, { ...snapshot, items: [rfsmartReview] });
assert.ok(rfPlan.planned_new_records[0].holds.includes("CONTRADICTORY_DURATION_DATE_EVIDENCE"));
for (const title of ["Product Strategy Intern", "Product Engineering Software Developer Internship", "Agile Delivery (Scrum Master) Internship - Spring & Summer 2027", "Software Development Intern - Spring and Summer 2027", "SaaS Sales Internship"]) assert.equal(normalizeGreenhouse({ ...rfsmartReview, title }, rfSource).candidate.subtype, "internship");
for (const title of ["International Sales", "Internal Auditor", "Software Developer", "Intern or Analyst", "Internship Coordinator", "Non-Intern Role"]) {
  const rejected = normalizeGreenhouse({ ...rfsmartReview, title }, rfSource);
  assert.equal(rejected.candidate, null, title);
  assert.equal(rejected.reviewFacts.postingId, String(rfsmartReview.id));
  assert.equal(rejected.reviewFacts.internalJobIdentity.internal_job_id, String(rfsmartReview.internal_job_id));
  assert.ok(rejected.reviewFacts.workAuthorization.length > 0);
}
assert.equal(normalizeGreenhouse(rfsmartReview, { ...rfSource, evidenceRules: undefined }).candidate, null);
assert.throws(() => validateSource({ ...rfSource, evidenceRules: { ...rfSource.evidenceRules, sourceKey: "another-employer" } }), /INVALID_SOURCE_EVIDENCE_RULES/);
assert.equal(normalizeGreenhouse({ ...rfsmartReview, metadata: [{ name: source.subtypeField, value: "Contract" }] }, rfSource).candidate, null);
const rejectedPlan = buildPlan(rfSource, { ...snapshot, items: [{ ...rfsmartReview, title: "Software Developer" }] });
assert.equal(rejectedPlan.rejected[0].reviewFacts.title, "Software Developer");
assert.equal(rejectedPlan.rejected[0].reviewFacts.canonicalUrl, rfsmartReview.absolute_url);
assert.equal(rejectedPlan.rejected[0].publishable, false);
assert.equal(rejectedPlan.planned_new_records.length, 0);
const rfMulti = normalizeGreenhouse({ ...rfsmartReview, location: { name: "Jacksonville, Florida, United States; Distributed - US" } }, rfSource);
assert.equal(rfMulti.reviewFacts.locations.length, 2);
assert.equal(rfMulti.candidate.city, null);
assert.equal(rfMulti.candidate.work_mode, null);
const twoPeriods = normalizeGreenhouse({ ...rfsmartReview, content: "<p>Duration: January 4, 2027 - April 30, 2027 (Spring) and May 30, 2027 - July 30th (12 weeks)</p>" }, rfSource);
assert.ok(twoPeriods.issues.includes("PROGRAM_DATES_REQUIRE_REVIEW"));
assert.ok(!twoPeriods.issues.includes("CONTRADICTORY_DURATION_DATE_EVIDENCE"), "Do not apply summer duration to spring period");
// Second RF-SMART pilot: review diagnostics only, no eligibility conclusions.
const review = (content, title = "Internship - Summer 2027") => normalizeGreenhouse({ ...rfsmartReview, title, content }, rfSource);
const service = review('<p>Escalation of complex issues to senior team members.</p><p>Work with senior leadership and senior engineers.</p><p>Currently enrolled in a degree program.</p><p>Considered a Junior or Senior by credit hours.</p>');
assert.equal(service.reviewFacts.education.length, 2);
assert.ok(service.reviewFacts.education.every(e => !/team members|leadership|engineers/.test(e.excerpt)));
for (const academic of ['undergraduate student', 'graduate student', 'university enrollment', 'college degree', 'senior academic standing', 'academic credit']) assert.equal(review(`<p>${academic}</p>`).reviewFacts.education.length, 1);
for (const [title, body] of [
  ['Hardware Support Internship - Summer 2027', '<p>RF-SMART Summer 2026 Internship Program</p><p>Duration: 5/10/2026 – 7/30/2026 (12 Weeks)</p>'],
  ['Supply Chain Analyst Internship - Summer 2027', '<p>This internship is part of the Summer 2026 Internship Program.</p><p>Duration: May 10th 2027, – July 31st, 2027 (12 Weeks)</p>'],
]) {
  const conflict = review(body, title);
  assert.ok(conflict.issues.includes('PROGRAM_YEAR_CONFLICT'));
  assert.equal(conflict.candidate.deadline_at, null);
  assert.ok(buildPlan(rfSource, { ...snapshot, items: [{ ...rfsmartReview, title, content: body }] }).planned_new_records[0].holds.includes('PROGRAM_YEAR_CONFLICT'));
}
assert.ok(!review('<p>Company founded in 2020.</p><p>Summer 2027 Program</p>').issues.includes('PROGRAM_YEAR_CONFLICT'));
assert.ok(!review('<p>Winter 2026–2027 Program</p>', 'Internship - Winter 2026–2027').issues.includes('PROGRAM_YEAR_CONFLICT'));
const strategy = review('<p>Duration: May 10, 2027 – July 30, 2027 (12 weeks)</p>', 'Product Strategy Intern - Summer 2027');
assert.ok(strategy.issues.includes('NOMINAL_DURATION_DATE_REVIEW'));
assert.ok(!strategy.issues.includes('CONTRADICTORY_DURATION_DATE_EVIDENCE'));
assert.ok(!strategy.issues.includes('PROGRAM_DATES_REQUIRE_REVIEW'));
assert.ok(rf.issues.includes('CONTRADICTORY_DURATION_DATE_EVIDENCE'), 'Accounting May 30–July 30 materially differs from 12 weeks');
for (const range of ['May 10, 2027 - August 2, 2027', 'May 10, 2027 - August 1, 2027']) {
  assert.ok(!review(`<p>Duration: ${range} (12 weeks)</p>`).issues.some(i => /DURATION.*REVIEW|CONTRADICTORY/.test(i)));
}
assert.ok(review('<p>Duration: May 10, 2027 - August 2, 2027 (approximately 12 weeks)</p>').issues.includes('NOMINAL_DURATION_DATE_REVIEW'));
assert.ok(review('<p>Duration: May 30, 2027 - July 30, 2027 (approximately 12 weeks)</p>').issues.includes('CONTRADICTORY_DURATION_DATE_EVIDENCE'));
for (const body of ['Summer 2027 Internship Program', 'A 12-week summer program', 'Program announcement: May 10, 2027']) assert.ok(!review(`<p>${body}</p>`).issues.includes('PROGRAM_DATES_REQUIRE_REVIEW'), body);
for (const body of ['Duration: May 30, 2027 - July 30th', 'Duration: 5/10/2027 – 7/30/2027']) assert.ok(review(`<p>${body}</p>`).issues.includes('PROGRAM_DATES_REQUIRE_REVIEW'), body);
const bounded = review(`<p>${'contextword '.repeat(40)}Currently enrolled in a degree program ${'followingword '.repeat(50)}</p>`).reviewFacts.education[0];
// Ordinal evidence must remain visible even when punctuation prevents safe parsing.
const supplyOrdinal = review('<p>Summer 2026 Internship Program</p><p>Duration: May 10th 2027, – July 31st, 2027 (12 Weeks)</p>', 'Supply Chain Analyst Internship - Summer 2027');
assert.ok(supplyOrdinal.issues.includes('PROGRAM_DATES_REQUIRE_REVIEW'));
assert.ok(supplyOrdinal.issues.includes('PROGRAM_YEAR_CONFLICT'));
assert.deepEqual(supplyOrdinal.reviewFacts.programPeriods, []);
assert.equal(supplyOrdinal.candidate.deadline_at, null);
assert.equal(supplyOrdinal.candidate.starts_at, null);
assert.equal(supplyOrdinal.candidate.ends_at, null);
for (const ordinal of ['1st', '2nd', '3rd', '4th', '10th', '21st', '22nd', '23rd', '31st']) {
  const unresolved = review(`<p>Duration: May ${ordinal} 2027, – July 31st, 2027 (12 Weeks)</p>`);
  assert.ok(unresolved.issues.includes('PROGRAM_DATES_REQUIRE_REVIEW'), ordinal);
  assert.deepEqual(unresolved.reviewFacts.programPeriods, [], ordinal);
  assert.ok(!unresolved.issues.includes('CONTRADICTORY_DURATION_DATE_EVIDENCE'), ordinal);
  assert.ok(!review(`<p>Program announcement: May ${ordinal}, 2027</p>`).issues.includes('PROGRAM_DATES_REQUIRE_REVIEW'), `Harmless ${ordinal}`);
}
const supportedOrdinal = review('<p>Duration: May 10th 2027 – July 31st, 2027 (12 Weeks)</p>');
assert.equal(supportedOrdinal.reviewFacts.programPeriods[0].startDate, '2027-05-10');
assert.equal(supportedOrdinal.reviewFacts.programPeriods[0].endDate, '2027-07-31');
assert.ok(!supportedOrdinal.issues.includes('PROGRAM_DATES_REQUIRE_REVIEW'));
assert.ok(supportedOrdinal.issues.includes('NOMINAL_DURATION_DATE_REVIEW'));
assert.ok(bounded.truncated);
assert.ok(bounded.excerpt.length <= 400);
assert.ok(/^(contextword|Currently)\b/.test(bounded.excerpt));
assert.ok(/\bfollowingword$/.test(bounded.excerpt));
assert.equal(normalizeGreenhouse({ ...rfsmartReview, application_deadline: "2027-01-01T00:00:00Z" }, rfSource).candidate.deadline_at, "2027-01-01T00:00:00.000Z");
const sanitized = sanitizeDescription(streamdownFragment);
assert.ok(!sanitized.text.includes("data-streamdown"));
assert.ok(!sanitized.text.includes("inline"));
assert.ok(sanitized.text.includes("Build software & learn."));
assert.ok(sanitized.text.includes("\n"));
assert.equal(plainText('<p>A &copy; &eacute;</p><script>bad()</script><style>bad{}</style>'), "A © é");
assert.equal(plainText('&lt;li class=&quot;[&amp;&gt;p]:inline&quot; data-streamdown=&quot;list-item&quot;&gt;Safe&lt;/li&gt;'), "- Safe");
const largeMarkup = '<p title="' + 'x'.repeat(13000) + '">Short.</p>';
assert.equal(sanitizeDescription(largeMarkup).rawLarge, true);
assert.equal(sanitizeDescription(largeMarkup).truncated, false);
assert.equal(sanitizeDescription("a".repeat(12000)).truncated, false);
assert.equal(sanitizeDescription("a".repeat(12001)).truncated, true);
const shortOutput = normalizeGreenhouse({ ...rfsmartReview, content: largeMarkup }, rfSource);
assert.ok(shortOutput.issues.includes("RAW_HTML_LARGE"));
assert.ok(!shortOutput.issues.includes("DESCRIPTION_TRUNCATED"));
assert.ok(normalizeGreenhouse({ ...rfsmartReview, content: "x".repeat(12001) }, rfSource).issues.includes("DESCRIPTION_TRUNCATED"));

// Exercise the real CLI subprocess with poisoned DB settings: it still only emits a plan.
const vercelSource = validateSource({ ...rfSource, key: 'greenhouse:vercel', employer: 'Vercel', employerKey: 'vercel',
  evidenceRules: { ...rfSource.evidenceRules, sourceKey: 'greenhouse:vercel', locationLabels: vercelLocationLabels },
  locationMappings: { 'San Francisco': { country: 'US', city: 'San Francisco' }, 'New York City': { country: 'US', city: 'New York City' }, Austin: { country: 'US', city: 'Austin' } } });
const vercel = normalizeGreenhouse(vercelIntern, vercelSource);
assert.deepEqual(vercel.reviewFacts.locations.map(l => l.city), ['San Francisco', 'New York City', 'Austin']);
assert.equal(vercel.reviewFacts.rawLocationLabel, vercelIntern.location.name);
assert.equal(vercel.candidate.city, null);
assert.equal(vercel.candidate.country, null);
assert.equal(vercel.candidate.work_mode, null);
assert.ok(vercel.reviewFacts.workplace[0].excerpt.includes('commute Mon/Tues/Fri'));
assert.equal(vercel.reviewFacts.abbreviatedProgramYears[0].value, "Summer '27");
assert.equal(vercel.reviewFacts.abbreviatedProgramYears[0].resolvedYear, null);
assert.ok(!vercel.issues.includes('PROGRAM_YEAR_CONFLICT'), 'Graduation dates are not program dates');
assert.equal(vercel.candidate.starts_at, null);
for (const suffix of ["'27", '’27']) {
  const result = normalizeGreenhouse({ ...vercelIntern, title: `Intern - Winter ${suffix}`, content: `<p>Summer ${suffix} internship</p><p>Version '42 and 27 projects.</p>` }, vercelSource);
  assert.equal(result.reviewFacts.abbreviatedProgramYears.length, 2);
  assert.ok(result.reviewFacts.abbreviatedProgramYears.every(e => e.yearToken === '27'));
  assert.deepEqual(result.reviewFacts.programPeriods, []);
}
const ambiguousLocation = normalizeGreenhouse({ ...vercelIntern, location: { name: 'Hybrid - Portland, OR, Austin' } }, vercelSource);
assert.equal(ambiguousLocation.reviewFacts.locations.length, 1);
assert.ok(ambiguousLocation.issues.includes('LOCATION_SEGMENTATION_REQUIRES_REVIEW'));
assert.equal(ambiguousLocation.candidate.city, null);
assert.equal(normalizeGreenhouse(vercelIntern, { ...vercelSource, evidenceRules: { ...vercelSource.evidenceRules, locationLabels: undefined } }).reviewFacts.locations.length, 1);
assert.equal(normalizeGreenhouse({ ...vercelIntern, location: { name: 'Hybrid - San Francisco' } }, vercelSource).candidate.city, 'San Francisco');
assert.throws(() => validateSource({ ...vercelSource, evidenceRules: { ...vercelSource.evidenceRules, locationLabels: { raw: [] } } }), /INVALID_LOCATION_EVIDENCE_RULES/);
// Repeated live-observed internal ID with synthetic posting IDs/URLs, both rejected.
const internalPair = [801, 802].map(id => ({ ...vercelIntern, id, internal_job_id: 5049056004, title: 'Software Engineer', absolute_url: `https://jobs.fixture.invalid/vercel/${id}` }));
const reconcile = buildPlan(vercelSource, { ...snapshot, items: internalPair });
assert.equal(reconcile.rejected.length, 2);
assert.equal(reconcile.potential_duplicates.length, 2);
assert.equal(reconcile.planned_new_records.length, 0);
assert.equal(reconcile.planned_updates.length, 0);
assert.ok(reconcile.rejected.every(r => r.holds.includes('SHARED_EMPLOYER_INTERNAL_JOB_ID_REVIEW')));
assert.equal(reconcile.potential_duplicates[0].url, internalPair[0].absolute_url);
assert.equal(reconcile.potential_duplicates[0].matches[0].source_item_id, '802');
assert.equal(reconcile.potential_duplicates[0].identity.internal_job_id, '5049056004');
const mixedReconcile = buildPlan(vercelSource, { ...snapshot, items: [internalPair[0], { ...internalPair[1], title: 'Intern' }] });
assert.equal(mixedReconcile.planned_new_records.length, 1);
assert.ok(mixedReconcile.planned_new_records[0].holds.includes('SHARED_EMPLOYER_INTERNAL_JOB_ID_REVIEW'));
assert.equal(mixedReconcile.planned_updates.length, 0);
const args = ["scripts/opportunity-radar-dry-run.mjs", "--source", "scripts/fixtures/greenhouse-source.json", "--fixture", "scripts/fixtures/greenhouse-snapshot.json", "--now", now];
const result = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, VITE_SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: "must-not-be-used" } });
assert.equal(result.status, 0, result.stderr);
assert.equal(JSON.parse(result.stdout).write_capability, false);
assert.equal(spawnSync(process.execPath, [...args, "--apply"], { encoding: "utf8" }).status, 1);
assert.equal(spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } }).status, 1);
// Architectural boundary: enumerate all module imports, not CSS/source string behavior assertions.
const folder = new URL("../lib/opportunityRadar/ingestion/", import.meta.url);
for (const name of readdirSync(folder)) {
  const content = readFileSync(new URL(name, folder), "utf8");
  for (const match of content.matchAll(/from\s+["']([^"']+)["']/g)) {
    assert.ok(match[1].startsWith("node:") || match[1].startsWith("./") || match[1] === "../constants.js" || match[1] === "htmlparser2", `Unexpected ingestion dependency: ${match[1]}`);
  }
}
process.stdout.write("PASS: ingestion registry, normalization, URL/SSRF/DNS/redirect safety, bounded retries, incomplete/pagination snapshots, sanitizer, duplicate plans, expiry, stable identity, read-only CLI and dependency boundary.\n");
