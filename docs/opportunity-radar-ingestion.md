# Greenhouse development-only ingestion

No database client, catalog writes, publishing, application API, scheduler or
deployment is included. Existing Opportunity Radar behavior is unchanged.
The registry is empty; no employer has been approved. JSON source configs default
to disabled. Live *read-only* fetches require enabled plus an approved
permission.technicalFetch scope with reviewer/date/reference, attribution and
retention notes. permission.republication is independent and defaults to
unreviewed. Both scopes support unreviewed/approved/denied and preserve notes.
Legacy permission.status configurations fail closed and require explicit review;
approval is never inferred or copied between scopes. These declarations are
operator assertions, not automatic legal approval. The bundled source is synthetic.

## Dry-run usage (stdout only)

```sh
node scripts/opportunity-radar-dry-run.mjs --source scripts/fixtures/greenhouse-source.json --fixture scripts/fixtures/greenhouse-snapshot.json --now 2030-01-01T00:00:00Z
node scripts/opportunity-radar-dry-run.mjs --source /path/to/reviewed-source.json --live
```

Optional `--existing /path/to/catalog-inventory.json` reads a bounded, previously
exported array containing id/source/source_item_id/url and optionally title,
organization and visibility. It does not connect to Supabase. Inventory cannot be
verified fresh/complete by this CLI, so planned inserts remain provisional. No
--apply, --write, output-file flag or production environment loading exists.
The command also refuses NODE_ENV=production or VERCEL_ENV=production.
Exit 0 means a complete dry-run report, not permission to publish; 2 means an
incomplete upstream snapshot; 1 means invalid config/input or command failure.

## Contract and normalization

See adapter.js for fetchSnapshot/normalize. Greenhouse list is documented as one
complete response with meta.total. Missing totals, unknown pagination, oversized
lists and fetch failures fail completeness rather than chasing arbitrary links.
Prospect postings (null internal_job_id), general-interest titles, unsupported
subtypes and unsafe URLs are excluded. Stable posting id is source_item_id.
Exact reviewed metadata mappings provide subtype. With absent metadata, an
explicitly reviewed source-scoped evidenceRules.titleInternship rule may match
standalone Intern/Internship title terms. Ambiguous titles and conflicting metadata
still require review; there is no global title classifier or full-time fallback.
Unknown/contract types do not become full-time/freelance. Location uses exact reviewed labels; remote never
implies worldwide eligibility. Unprovided dates, requirements and tags stay empty.
Authorized descriptions are decoded and reduced to bounded plain text, never HTML.
htmlparser2 parses tags/attributes and entities (including bounded encoded markup);
scripts/styles and other non-content elements are excluded. Block/list line breaks
are retained. Raw input is capped at 200,000 characters, output at 12,000 Unicode
characters. RAW_HTML_LARGE is informational; DESCRIPTION_TRUNCATED is emitted only
when sanitized text actually exceeds the output bound. No HTML is rendered.

RF-SMART-style review rules (configuration only, not source/publication approval):
evidenceRules contains sourceKey matching the source, status=approved, reference,
reviewedBy, reviewedAt, and optional titleInternship/statements booleans. Arbitrary
regexes are not accepted; fixed versioned rules are used. Defaults are disabled.
The caller must explicitly review these rules per source before enabling them.
The report records the subtype rule, source field, value and source identity.

Review facts are collected before acceptance. Rejected records retain bounded
posting/title/organization/URL/location/internal-ID evidence without becoming
candidates. Description access still requires descriptionAllowed. Reviewed
statement extraction stores up to eight 400-character attributed excerpts per
category: education, workAuthorization, workplace, programStatements,
durationStatements and applicationStatements. Truncated excerpts are marked.
These are source statements, not user eligibility decisions or ranking inputs.
No narrative work-mode assumption populates candidate.work_mode.

Structured review-only programPeriods use date-only values from explicit English
month ranges with both years. Unsupported/numeric/incomplete periods remain
excerpts with PROGRAM_DATES_REQUIRE_REVIEW. Duration claims remain separate.
A simple single-period week claim inconsistent with calendar length (allowing
one day for endpoint conventions) produces CONTRADICTORY_DURATION_DATE_EVIDENCE.
Multiple/incomplete periods are not silently combined. These issues add review
holds. Narrative dates never set deadline_at, starts_at, ends_at or expiry;
only the explicit API application_deadline field sets candidate.deadline_at.

Default HTTP limits: 8-second DNS and request deadlines, 2 MB response, 1 retry,
2 redirects, 1 page, 100 items. Config ceilings: 15 seconds, 5 MB, 2 retries,
3 redirects, 1 page and 200 items. HTTPS exact-host allowlists, public IPv4-only
DNS resolution pinned to the TLS connection, revalidation per redirect, and no
proxy/env credentials. IPv6-only sources fail closed. Retry-After longer than two
seconds defers the run. No URLs from job bodies are fetched.

## Plan semantics

All candidates remain inactive/unpublished/unverified. Proposed verification and
expiry are separate, informational fields, never applied. Fixture plans are held.
Expiry is the minimum of observed time + freshnessHours (default 48, maximum 72),
actual deadline and actual end date. Expired-at-boundary records are held.
Complete snapshot is necessary but not sufficient for publication. A successful
fetch does not verify employer legitimacy, legal reuse or a working destination.

Same-source identity duplicates are held, not last-write-wins. Canonical URL
collisions across identities are held. Existing identity updates retain the UUID;
similar title/employer records are flagged, never merged. No missing-row deletion
or closure reconciliation exists. Operator-rejected/unpublished rows are held.
Plan digest includes configuration, input snapshot, inventory and decisions.

## Before enabling any writes in a separate iteration

Dry-run v3 includes authorization metadata and a REPUBLICATION_NOT_APPROVED hold
unless republication is explicitly reviewed/approved. Even both approvals never
enable writes or set publishable=true. Description inspection permission is not
republication permission. Future writers must revalidate scopes, not trust reports.

Normalization returns reviewFacts separately from candidate (no API/schema change):
locations holds up to 10 labels, each at most 240 characters, with optional exact
reviewed country/city mappings. Explicit semicolon-separated lists are preserved;
multiple locations leave scalar country/city null, never imply remote eligibility.
Other ambiguous labels remain unsplit/unknown. Oversized evidence is rejected.
Optional employerKey is a reviewed, stable employer identity shared across boards.
With an explicit source internal_job_id, reviewFacts.internalJobIdentity contains
provider/employer_key/internal_job_id/source_field. Matching these facts across
different postings adds a reconciliation hold, never merges or changes posting IDs.
Offline inventory may carry reviewFacts alongside existing rows; ordinary catalog
exports lack this sidecar, so cross-board identity checks require enriched inventory.
Internal IDs are not globally unique; employer display names are never used as scope.

Verify actual production schema and permissions independently. Approve each real
employer/feed and reuse scope; validate destination and source identity. Implement
a separate server-only writer with target confirmation, fresh inventory recheck,
approved-plan digest, serialized execution, row-atomic writes and durable audit.
Do not allow plans to reactivate rejected/manual-hidden rows, change UUIDs, overwrite
other sources or modify user states. Test all failure/race cases in an isolated DB.
Keep initial visible volume within the existing 200-candidate window. None of these
steps is authorized or performed by the dry-run command.

Validation: node scripts/validate-opportunity-radar-ingestion.mjs.
