# Location Intelligence — slices 1–3 (unreleased)

Slice 3 adds shared location evaluation, catalog-location reads, location-aware
ranking and server-side Nearby. No UI, browser permission, ingestion/writer,
notifications or new opportunity types. The migration remains UNAPPLIED.

**RELEASE GATE:** Every authenticated valid Radar list request now reads the
preference table once. Missing table/storage failure is 503, not no preference.
Release order: isolated migration acceptance -> authorized migration apply ->
schema verification -> app deployment -> authenticated All/Saved/Nearby smoke.
Deploying this app before migration WOULD break All/Saved. No silent fallback.

## Slice 3 evaluation and reads

Absent/disabled preference preserves the old Career Memory location signal and
`jobs-v1` version. Enabled preference uses `jobs-location-v1`, same weights and
`profile_alignment` semantics. Profile/preference are never client supplied.
`getForEvaluation` is internal, distinct from the safe public preference GET.

Up to 1000 eligible compact rows -> owner-state exclusion -> bounded location
reads -> one shared evaluator -> Nearby filter if requested -> sort/best 200 ->
hydrate + visibility/state recheck -> fresh location read -> same evaluator and
Nearby recheck -> detailed rank -> 20/default, 50/max. No user-state writes.

Location repository uses parent ID batches of 100 and FK embedding of location
rows, so each response includes both completeness and the child set. Parent UUID
keysets drain even pages smaller than requested. Child results request 11 rows
to detect/reject exceeding the 10-record cap. Invalid/unrelated rows and DB errors
fail closed. Matching fields only; no evidence references or unrelated catalog.
At normal page sizes each nonempty batch takes one data + one drain query; at
1000 candidates + 200 hydrated: up to 24 such requests, plus one preference read.
Lower server page caps require additional bounded keyset reads, never per-item
N+1. Parent/child reads are type-neutral; the existing feed stays jobs-only.

The unapplied migration now adds `opportunities.location_set_complete boolean
NOT NULL DEFAULT false`. This explicit assertion is required for an all-outside
negative; row count alone cannot establish complete coverage. No code sets it
here. A future approved writer must atomically maintain the flag with its child
set; unresolved/deleted/unverified alternatives require false. Existing rows
remain incomplete by default. Base migration remains unchanged.

Within or same reviewed city without coordinates scores 1; complete/all-outside
scores 0; boundary or unknown/partial evidence scores null. One positive is enough.
There is NO fallback/geocoding from legacy city text when enabled. Remote always
has null physical-location score; include_remote only controls Nearby inclusion.
Work-mode scoring is untouched. Unknown work mode is not inferred as remote.

`view=nearby` cannot combine with any state filter. It requires enabled preference
(409 LOCATION_PREFERENCE_REQUIRED). Includes within/same-city/boundary candidates
and optionally remote; unknown/outside remain available in All/Saved. Current
city-only pilot entries enable canonical-city evidence, not fabricated distances.
Browser uncertainty is still null, so coordinates alone cannot confirm radius
membership; this is a deliberate limitation until defensible error evidence exists.

`location_match` is added only when enabled: kind, radius_relation, reason, and
when supported whole-km approximate_distance_km plus distance_basis (source_point
or city_centroid). No user coordinates or hidden evidence. Same-city/unknown use
radius_relation=unknown; remote uses null and has no distance. Distances are to
the selected supporting reviewed point/centroid, not an asserted office/commute.

## Preference API

GET/PUT/PATCH/DELETE `/api/opportunity-radar/location-preference` uses the existing
shared handler and narrow Vercel alias `radarEndpoint=location-preference`.
Authentication is required; completed Career Profile is not. Missing GET returns
null; failed storage returns RADAR_UNAVAILABLE, never a fabricated empty result.
PATCH only accepts `{enabled:boolean}`; a missing row returns
LOCATION_PREFERENCE_NOT_FOUND. DELETE is owner-scoped and idempotent.

PUT requires enabled/source/radius_km/include_remote/consent_version plus either
place_id (manual) or approximate_latitude/approximate_longitude (browser). Unknown
fields fail closed. Consent uses the exported LOCATION_CONSENT_VERSION constant.
Every explicit PUT renews consented_at using the server clock; enable/disable
does not change consented_at. Both source paths replace all normalized fields,
so switching to manual clears old browser coordinates. The repository re-derives
the allowlisted write and injects authenticated ownership, even for internal
callers. Reads/updates/deletes filter user_id; upsert injects it, uses the unique
user_id conflict key and filters the returned row by the same owner.

The existing 2048-byte mutation reader is reused. No Supabase/SQL error details
are returned or logged. Clients reuse auth, abort and timeout handling; browser
coordinates are coarsened before transmission and again before persistence.
Browser uncertainty stays null: grid displacement cannot bound unknown sensor
error. Country/city remain null, with no reverse geocoding.

Public responses omit coordinates, uncertainty, user IDs, consent and timestamps.
Manual display facts are derived from the reviewed vocabulary. A generic
“Paylaşılan yaklaşık konum” label is sufficient for browser preference status.
Full browser PUT replacement requires newly supplied coordinates; this slice
does not add partial radius editing or a UI that would need retained coordinates.
No localStorage or location history is used. Slice 2 itself required no migration
adjustment; Slice 3 adds the completeness assertion described above.

## Pure contracts

- `validateCoordinates({latitude,longitude})`: strict finite numbers, inclusive
  ±90/±180 bounds; rejects additional properties. Returns a fresh pair.
- `coarsenBrowserCoordinates(pair)`: rounds to 0.01 degrees, normalizes negative
  zero, returns only rounded coordinates and `grid_0_01_degree`. Call before
  transmission and repeat before durable storage. Exact samples are never output.
- `haversineKm(a,b)`: spherical straight-line distance, R=6371.0088 km, not commute
  distance. All computed distances remain approximate even for source points.
- `radiusRelation(d,r,u)`: within when d+u<=r, outside when max(0,d-u)>r,
  otherwise boundary_uncertain. Null uncertainty returns unknown, never zero.
- `validateLocationEvidence(record)`: strict bounded projection; coordinate pairs,
  precision and uncertainty validated. No addresses or opaque raw source payloads.
- `evaluateLocation(search,record,radiusKm)`: same-city needs matching reviewed
  global place IDs, not equal display strings. Country may be null; explicit
  conflicting countries prevent a same-city claim. City centroids without a
  defensible extent may yield distance but never confirmed radius membership.
- `evaluateOpportunityLocations(search,records,options)`: max 10; retains every
  per-location result, no primary selection. `locationsComplete` defaults false:
  all-outside is negative only with explicit complete coverage. Any confirmed
  inside establishes local alignment. Same-city/boundary remains uncertain.
  Explicit `remote` yields no local-alignment or geography-eligibility claim.

## Privacy

0.01-degree rounding reduces precision; it does NOT anonymize location. Grid
spacing is ~1.1 km north/south and latitude-dependent east/west. Rounding can
add ~0.8 km displacement; sensor error is additional. Future callers must not
claim zero browser uncertainty. If no defensible combined estimate is available,
use null. No history, storage, logs, reverse geocoding, URL serialization or I/O.
Future UI must never persist/transmit the original browser Position object.

## Pilot vocabulary

`pilot-city-only-v2`: Gazimağusa/Famagusta (0001), Lefkoşa/Nicosia (0002),
Girne/Kyrenia (0003), İstanbul/Istanbul (0004), Ankara (0005), İzmir/Izmir (0006).
IDs are `hf:place:NNNN`, immutable identities independent of aliases or country.
The first three have null country/region; the last three use normalized TR.
Cyprus island is a geographic display qualifier only, not a jurisdiction,
nationality, work-authorization or eligibility assertion. No subdivision/boundary
is asserted for Lefkoşa/Nicosia. Regions are omitted rather than fabricated.
This replaces the unshipped London/Berlin/Paris catalog; old IDs are not remapped.
TR/EN names and explicit aliases are immutable. `resolvePilotPlaceAlias` performs
exact normalized matching (case/diacritics/whitespace), never fuzzy selection.
Ambiguous aliases return null unless stable-ID/country/region context resolves
exactly one entry. Null country is not a wildcard. This is an internal identity
review, NOT a coordinate/geospatial accuracy review. No broad province
entry is promoted to a precise point. New centroid evidence requires a separately
reviewed dataset/version and attribution; no paid/external geocoder is selected.
`getPilotPlace()` rejects unknown IDs by returning null. Future manual-preference
validation must resolve IDs server-side; never trust client labels/coordinates.

## Prepared schema (NOT APPLIED)

`20261008120000_opportunity_radar_location_v1.sql` requires the existing Radar
base tables/update trigger function and auth.users. New object/type conflicts
abort the transaction. One-time only, not an idempotent rerun. No seeds/backfill.
PK indexes suffice. Both tables default-deny all client access, including reads.
Only service_role has CRUD; preference helpers scope every operation
to authenticated user ID because service_role bypasses RLS. Timestamps are
server/default managed; the API rejects client ownership/timestamps.
Manual reviewed-ID membership is application-enforced, not a SQL allowlist.
Manual anchors and reviewed city mappings require place_id + city, not a country
assertion. The optional country still has its uppercase two-letter constraint.
RLS, evidence, coordinate, ownership and precision constraints remain unchanged.

Catalog evidence is `source_point` (type-neutral), never employer-only. Reference
strings must identify reviewed evidence, not contain addresses; future writer
validation must enforce that distinction and a maximum 10-record set. User-state
and Career Memory tables are untouched. The future writer's module/capability
must not expose preference operations; service_role itself is not a least-
privilege writer credential and this migration does not create one.

Validate locally, review target/schema separately, then obtain explicit migration
authorization. Do not run this file automatically. Without PostgreSQL tooling,
the schema validator reports structural checks separately from unavailable SQL
execution. Production acceptance remains gated on real database validation.
