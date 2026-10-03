import { createHash } from "node:crypto";
import { greenhouseAdapter } from "./greenhouse.js";
import { validateCandidate } from "./normalize.js";
import { canonicalUrl } from "./http.js";
import { validateSource, scopeApproved } from "./registry.js";

function internalIdentity(value) {
  if (value?.provider !== "greenhouse" || typeof value.employer_key !== "string" ||
      !/^[a-z0-9:_-]{1,160}$/.test(value.employer_key) || typeof value.internal_job_id !== "string" ||
      !/^[1-9]\d{0,15}$/.test(value.internal_job_id)) return null;
  return JSON.stringify([value.provider, value.employer_key, value.internal_job_id]);
}

export function expiryPlan(row, source, verifiedAt) {
  const at = Date.parse(verifiedAt);
  if (!Number.isFinite(at)) throw new Error("INVALID_VERIFICATION_TIME");
  const deadlines = [row.deadline_at, row.ends_at].filter(value => value != null).map(Date.parse);
  if (deadlines.some(value => !Number.isFinite(value))) throw new Error("INVALID_EXPIRY_DATE");
  const end = Math.min(at + source.freshnessHours * 3600000, ...deadlines);
  if (end <= at) return { eligible: false, reason: "ALREADY_EXPIRED" };
  return { eligible: true, last_verified_at: new Date(at).toISOString(), expires_at: new Date(end).toISOString() };
}

export function buildPlan(input, snapshot, { existing = [], inventoryComplete = false, mode = "fixture" } = {}) {
  if (!["fixture", "live"].includes(mode)) throw new Error("INVALID_MODE");
  const source = validateSource(input, { live: mode === "live" });
  if (mode === "fixture") source.developmentOnly = true;
  if (!Array.isArray(existing) || existing.length > 10000 || existing.some(row => !row || typeof row.source !== "string" || typeof row.source_item_id !== "string" || typeof row.url !== "string" || typeof row.id !== "string")) throw new Error("INVALID_INVENTORY");
  if (!Array.isArray(snapshot.items) || snapshot.items.length > source.maxImportSize) throw new Error("INVALID_SNAPSHOT_SIZE");
  const republicationApproved = scopeApproved(source.permission.republication);
  const plan = { version: "greenhouse-dry-run-v3", dry_run: true, write_capability: false, mode,
    authorization: source.permission, republication_approved: republicationApproved,
    source: { key: source.key, adapter: source.adapter, employer: source.employer, board: source.board },
    fetched_at: snapshot.fetchedAt, upstream_snapshot_complete: snapshot.complete === true,
    inventory_complete: inventoryComplete, number_fetched: snapshot.upstreamCount ?? snapshot.items.length, number_normalized: 0,
    rejected: [], potential_duplicates: [], url_collisions: [], planned_new_records: [], planned_updates: [], warnings: [...(snapshot.warnings || [])] };
  if (!inventoryComplete) plan.warnings.push("CATALOG_INVENTORY_NOT_VERIFIED_NEW_RECORDS_ARE_PROVISIONAL");
  if (!republicationApproved) plan.warnings.push("REPUBLICATION_NOT_APPROVED");
  if (mode === "fixture") plan.warnings.push("DEVELOPMENT_SIMULATION_NEVER_PUBLISH");
  const allEntries = snapshot.items.map((item, index) => {
    const result = greenhouseAdapter.normalize(item, source);
    if (result.candidate) { validateCandidate(result.candidate); plan.number_normalized++; }
    return { ...result, index };
  });
  for (const entry of allEntries) {
    const facts = entry.reviewFacts;
    const key = internalIdentity(facts.internalJobIdentity);
    const matches = key ? [
      ...allEntries.filter(other => other !== entry && internalIdentity(other.reviewFacts.internalJobIdentity) === key &&
        (other.reviewFacts.postingId !== facts.postingId || other.reviewFacts.canonicalUrl !== facts.canonicalUrl))
        .map(other => ({ source: other.reviewFacts.source, source_item_id: other.reviewFacts.postingId, url: other.reviewFacts.canonicalUrl })),
      ...existing.filter(old => internalIdentity(old.reviewFacts?.internalJobIdentity) === key &&
        (old.source !== facts.source || old.source_item_id !== facts.postingId || old.url !== facts.canonicalUrl))
        .map(old => ({ source: old.source, source_item_id: old.source_item_id, url: old.url, existing_id: old.id })),
    ] : [];
    entry.reconciliationHolds = matches.length ? ["SHARED_EMPLOYER_INTERNAL_JOB_ID_REVIEW"] : [];
    if (matches.length) plan.potential_duplicates.push({ source_item_id: facts.postingId, url: facts.canonicalUrl,
      reason: "SHARED_EMPLOYER_INTERNAL_JOB_ID_REVIEW", identity: facts.internalJobIdentity, matches });
    if (!entry.candidate) plan.rejected.push({ index: entry.index, reasons: entry.issues, reviewFacts: facts,
      evidence: entry.evidence, holds: entry.reconciliationHolds, publishable: false });
  }
  const normalized = allEntries.filter(entry => entry.candidate);
  const identities = new Map(), urls = new Map();
  // Count before normalization too: a malformed duplicate must not silently win
  // or leave the other version of that identity eligible for an update.
  for (const item of snapshot.items) if (Number.isSafeInteger(item?.id)) {
    const id = String(item.id);
    identities.set(id, (identities.get(id) || 0) + 1);
  }
  for (const entry of normalized) {
    const row = entry.candidate;
    urls.set(row.url, (urls.get(row.url) || 0) + 1);
  }
  for (const entry of normalized) {
    const row = entry.candidate;
    if (identities.get(row.source_item_id) > 1) {
      plan.potential_duplicates.push({ source_item_id: row.source_item_id, reason: "DUPLICATE_SOURCE_IDENTITY" }); continue;
    }
    const matches = existing.filter(old => old.source === row.source && old.source_item_id === row.source_item_id);
    const collisions = existing.filter(old => {
      if (old.source === row.source && old.source_item_id === row.source_item_id) return false;
      try { return canonicalUrl(old.url, source.permittedHosts) === row.url; } catch { return old.url === row.url; }
    });
    if (collisions.length || urls.get(row.url) > 1) {
      plan.url_collisions.push({ source_item_id: row.source_item_id, url: row.url, existing_ids: collisions.map(old => old.id) }); continue;
    }
    if (matches.length > 1) { plan.rejected.push({ index: entry.index, reasons: ["AMBIGUOUS_EXISTING_IDENTITY"], reviewFacts: entry.reviewFacts, evidence: entry.evidence, publishable: false }); continue; }
    const similar = existing.filter(old => old.source_item_id !== row.source_item_id && old.organization?.toLowerCase() === row.organization.toLowerCase() && old.title?.toLowerCase() === row.title.toLowerCase());
    if (similar.length) plan.potential_duplicates.push({ source_item_id: row.source_item_id, reason: "SIMILAR_TITLE_EMPLOYER_REVIEW", existing_ids: similar.map(old => old.id) });
    const expiry = expiryPlan(row, source, snapshot.fetchedAt);
    const holds = [...(snapshot.complete ? [] : ["INCOMPLETE_SNAPSHOT"]), ...(!expiry.eligible ? [expiry.reason] : []),
      ...(mode === "fixture" ? ["DEVELOPMENT_ONLY"] : []), ...(!inventoryComplete ? ["UNVERIFIED_INVENTORY"] : []),
      ...(!republicationApproved ? ["REPUBLICATION_NOT_APPROVED"] : []),
      ...entry.reconciliationHolds,
      ...entry.issues.filter(issue => issue === "LOCATION_SEGMENTATION_REQUIRES_REVIEW"),
      ...entry.issues.filter(issue => /^(?:CONTRADICTORY_|PROGRAM_DATES_REQUIRE_REVIEW|PROGRAM_YEAR_CONFLICT|NOMINAL_DURATION_DATE_REVIEW)/.test(issue)),
      ...(similar.length ? ["POTENTIAL_DUPLICATE"] : []), "HUMAN_PUBLICATION_APPROVAL_REQUIRED"];
    if (matches[0]?.verification_status === "rejected" || matches[0]?.published === false) holds.push("PRESERVE_OPERATOR_VISIBILITY_DECISION");
    const operation = { candidate: row, evidence: entry.evidence, reviewFacts: entry.reviewFacts, issues: entry.issues, holds,
      proposed_verification: expiry, verification_status: "unverified", publishable: false };
    if (matches.length) plan.planned_updates.push({ ...operation, existing_id: matches[0].id });
    else plan.planned_new_records.push(operation);
  }
  plan.digest = createHash("sha256").update(JSON.stringify({ source, snapshot, existing, plan })).digest("hex");
  return plan;
}
