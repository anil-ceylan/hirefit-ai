# Opportunity Radar UI — Jobs / Internships

This slice adds the authenticated `/opportunity-radar` page and a two-item preview
directly after Weekly Decision Center, before the unchanged Career Companion card.
Global navigation and the landing page are unchanged. There is no ingestion,
People/Events behavior, production migration application, or deployment.

## Structure and behavior

- `OpportunityRadarPage.jsx` uses the existing auth/profile readiness resolver.
  Unauthenticated users go to sign-in with the Radar return path; email
  verification and profile restoration complete before Radar requests start.
  Missing memory links to the existing Career Profile, without duplicating it.
- `OpportunityCard` renders source facts, subtype/location, alignment and neutral
  coverage, matching/uncertain signals, source-backed timing and next action.
  Unknown context is never styled as failure. The score explicitly is not hiring
  probability. External links are HTTP(S), new-tab, noopener/noreferrer; opening
  one does not automatically mark an application or Weekly Action complete.
- All/Saved are the only filters. Saved queries use the backend `state=saved`
  filter. Dismissed records disappear only after successful acknowledgement.
  Saved/acted-on state labels reflect the returned backend state.
- `useOpportunityRadar` is component-local, keyed by authenticated account and
  language. It keeps no cross-user/localStorage opportunity cache. Filter changes
  and unmount cancel requests, and generation checks discard stale results.
  Requests have bounded timeouts including session-header retrieval.
- State changes are deliberately **not optimistic**. Buttons and filters are
  temporarily locked against duplicate writes. On failure the existing card/state
  remains and a safe message offers refresh. A timeout can occur after a server
  commit, so the message does not falsely promise that no write occurred.
- Refresh reads the authoritative API again. Verified/current/job-only checks are
  reused defensively on responses and when the window regains focus or every
  30 seconds, so expired cached cards are removed. No fallback/test catalog is
  imported by the application UI.

## Tests

`node scripts/validate-opportunity-radar-client.mjs` tests payloads, filters,
response validation, live/verified guards, timeouts/cancellation and safe errors.

`node scripts/validate-opportunity-radar-ui.mjs` uses Playwright/Edge against the
local Vite server at `http://127.0.0.1:5173`. Set `HIREFIT_PLAYWRIGHT` to an external
Playwright installation when it is not locally available; `HIREFIT_UI_OUTPUT`
sets the screenshot directory. Start Vite first. The validator reads only the
public Supabase URL for an isolated fake session, intercepts every auth/API
request, blocks other external requests, and never writes production data.

Browser checks cover 390/768/1100/1440px, auth/verification redirects, loading,
empty/error/missing memory, unknown context, Save/Dismiss, failure preservation,
reload persistence, duplicate write prevention, filter request races, links,
keyboard focus, overflow and dashboard placement. An English scenario also checks
copy and expiry while the page is open. Screenshots contain labeled test fixtures,
not live opportunities. Existing profile, Weekly Action, Companion, routing and
backend validators are run separately.

## Remaining release boundaries

The migration is still unapplied by this work. Real catalog availability and live
Supabase/deployment behavior are not established by mocked browser tests. The
backend's bounded 200-candidate window remains unchanged; Saved is not a complete
archive and does not include expired opportunities. Full App.jsx lint has existing
baseline issues; compare baseline/current diagnostics rather than expanding this
slice into unrelated cleanup. Ranking weights and backend contracts are unchanged.
