# Location foundation — disconnected slice 1

Nothing in this folder is imported by production Radar. No API, UI, browser
permission, ranking/retrieval, ingestion or catalog writer integration exists.

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
Only service_role has CRUD; future preference helpers MUST scope every operation
to authenticated user ID because service_role bypasses RLS. Timestamps are
server/default managed; the future API must reject client ownership/timestamps.
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
