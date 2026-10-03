# Opportunity Radar: Jobs/Internships foundation

No UI, live ingestion, LLM, scheduled job, production seed, profile write, or deployment is included.

## Database and application procedure

Migration: `supabase/migrations/20260925120000_opportunity_radar.sql`.

This is an additive **one-time** migration, not an idempotent SQL script. Before
applying via the project's normal Supabase migration workflow, confirm the target
project and inspect `to_regclass('public.opportunities')` and
`to_regclass('public.opportunity_user_states')`. If either exists, stop and compare
its schema/policies before preparing a reviewed follow-up migration. Do not drop
or overwrite it. The transaction deliberately refuses existing tables, including
when this migration is run twice. A failed SQL Editor transaction may need a
`ROLLBACK`; no existing rows are changed. This implementation has not applied it.

Prerequisites are the existing Supabase `auth.users`, `auth.uid()`, `anon`,
`authenticated`, `service_role`, and PostgreSQL `gen_random_uuid()`.

Tables: shared `opportunities`, plus user-scoped `opportunity_user_states`.
Anonymous clients have no access. Authenticated clients can read only visible
jobs and their own state, not write either table directly. All writes use the
authenticated API and the existing service-role client. Service-role bypasses
RLS, so the helper explicitly scopes every state query/upsert to the server's
authenticated user ID. Its conflict key is `(user_id, opportunity_id)`.
Repeated identical state submissions preserve both row count and `updated_at`.
Account deletion cascades its states; deleting a referenced opportunity is
restricted. Archive catalog entries instead.

The schema reserves `person`/`event` types but the API and catalog read policy
expose only jobs. Job subtypes: `full-time`, `part-time`, `freelance`, `internship`.
Country uses ISO alpha-2 codes. Reuse onboarding role/sector IDs. Requirements
use `experience_levels` with existing onboarding IDs (`intern`, `new_graduate`,
`entry`, `mid`, `senior`, `manager`); other eligibility/requirements remain
source facts shown for review, not invented or treated as proven eligibility.

Controlled future imports must normalize source IDs and canonical URLs before
writing: `(source, source_item_id)` and exact URL are unique. No source import
endpoint exists in this slice. Verified rows require non-fixture provenance,
`last_verified_at`, and an explicit future `expires_at`. Jobs must also be
published/active, not past their deadline/end date, and not verified in the future.
Importers must maintain verification and expiry; the API cannot prove that a
remote listing is still open. No page-request scraping or synthetic fallback.

`scripts/fixtures/opportunity-radar.mjs` contains only two clearly labeled,
unpublished/unverified fixtures with `.invalid` URLs. Neither application code
nor SQL imports them. Database constraints and runtime filters block fixture
publication. Validators simulate verified rows only inside isolated test stores.

## API

Both endpoints require an existing Supabase bearer session and return JSON with
`Cache-Control: private, no-store`. Clients never supply a trusted profile/user ID.

- `GET /api/opportunity-radar?limit=20&lang=TR`: limit 1–50; language TR/EN.
  Optional `state=saved|dismissed|acted_on`. By default dismissed entries are
  omitted. Only currently visible jobs are returned even when filtering saved
  entries. Unknown filters are rejected. Career Memory is loaded server-side.
  Response: `{success:true, opportunities:[...], meta:{ranking_version,
  score_kind,evaluated_at,candidate_limit,candidates_truncated,limit}}`.
- `PATCH /api/opportunity-radar/:uuid/state`: body exactly
  `{state:"saved"|"dismissed"|"acted_on"}`. Response:
  `{success:true,opportunity_id,state,updated_at}`. Idempotent; no automatic
  application/contact or Weekly Action completion. Unpublished/expired/missing
  IDs return 404 without writing state.
- Errors: 401 auth; 400 invalid query/body/UUID/JSON; 413 oversized body;
  404 unavailable opportunity/path; 405 method; 409 `CAREER_PROFILE_REQUIRED`;
  503 `RADAR_UNAVAILABLE`. No private storage/provider exception details escape.

The list ranks the latest 200 verified eligible candidates (stable verification
date/ID order). `candidates_truncated` explicitly signals a larger catalog. This
bounded MVP window is not a global/paginated search or a complete saved archive;
expand candidate retrieval before scaling beyond this window.

## Ranking v1

Weights: target role 30, sector 15, recorded skills 20, target location 10, work
mode 10, experience level 10, job/internship direction 5. Direction is explicit
onboarding `lookingFor`, not a new AI-derived identity. Explicit goals precede CV
inferences. Location uses target countries/cities, not assumed relocation from
residence; remote does not imply worldwide eligibility.

For comparable dimensions, exact normalized matches score 1; known preference
mismatches score 0. Skills use recorded overlap / listed skills; unrecorded skills
are labeled **not evidenced**, not asserted absent. Missing profile or opportunity
dimensions are omitted from the denominator. Score is rounded weighted alignment
over known dimensions; no comparable information gives `null`, never zero.
`alignment_coverage` (0–100 weight points) must accompany the score in the future
UI so sparse profiles do not appear to have fully supported 100% matches.

Each item includes matched and missing/uncertain signals, TR/EN matching reasons,
source-backed `why_now` (future deadline/start date only; otherwise null), a source
review action, and `current_user_state` (null until first action). Match score is
alignment, **not hiring probability**, eligibility certification or Profile Score.

## Validation and release boundary

- `node scripts/validate-opportunity-radar.mjs`
- `node scripts/validate-opportunity-radar-schema.mjs` requires
  `@electric-sql/pglite`, optionally located via `HIREFIT_PGLITE_MODULE`. It runs
  real PostgreSQL constraints/RLS and the persistence helper in an isolated DB.
- `node scripts/validate-opportunity-radar-routing.mjs` requires official
  `@vercel/fs-detectors` and `@vercel/routing-utils`, optionally located via
  `HIREFIT_ROUTE_AUDIT_MODULE` and `HIREFIT_ROUTE_UTILS`. It compiles the current
  Vercel routes and dispatches requests through the actual adapter.

Express and Vercel share the same Radar handler. A narrow state-path rewrite uses
the existing single-segment adapter; no function is added (10 existing functions).
Run existing profile, Weekly Action, Companion and Vercel regressions plus lint,
build and diff checks. Local compiler/DB tests do not establish production
deployment, live Supabase policies, real-source availability or browser acceptance.
Next iteration: authenticated Radar page/preview using this API, explicit
coverage labeling, empty/error states and user-triggered state updates.
