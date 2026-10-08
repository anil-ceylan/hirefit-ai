-- PREPARED ONLY: separate target/schema review and authorization before applying.
-- One-time additive migration; reruns/conflicting objects fail atomically.
-- No seeds, backfill, profile changes, new opportunity types, or writer authority.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.opportunity_location_preferences') IS NOT NULL OR
     to_regclass('public.opportunity_locations') IS NOT NULL OR
     to_regtype('public.opportunity_location_preferences') IS NOT NULL OR
     to_regtype('public.opportunity_locations') IS NOT NULL THEN
    RAISE EXCEPTION 'Location objects already exist; review schema before applying';
  END IF;
END $$;

CREATE TABLE public.opportunity_location_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  source text NOT NULL CHECK (source IN ('browser', 'manual')),
  place_id text CHECK (length(btrim(place_id)) BETWEEN 1 AND 160),
  country_code text CHECK (country_code ~ '^[A-Z]{2}$'),
  region text CHECK (length(btrim(region)) BETWEEN 1 AND 160),
  city text CHECK (length(btrim(city)) BETWEEN 1 AND 160),
  approximate_latitude numeric(5,2) CHECK (approximate_latitude BETWEEN -90 AND 90),
  approximate_longitude numeric(6,2) CHECK (approximate_longitude BETWEEN -180 AND 180),
  location_precision text NOT NULL CHECK (location_precision IN ('grid_0_01_degree', 'city_centroid', 'city_only')),
  uncertainty_km numeric CHECK (uncertainty_km >= 0 AND uncertainty_km < 'Infinity'::numeric),
  radius_km smallint NOT NULL CHECK (radius_km IN (10, 25, 50, 100)),
  include_remote boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL CHECK (length(btrim(consent_version)) BETWEEN 1 AND 80),
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_location_preferences_coordinate_pair CHECK ((approximate_latitude IS NULL) = (approximate_longitude IS NULL)),
  CONSTRAINT opportunity_location_preferences_precision CHECK ((location_precision = 'city_only') = (approximate_latitude IS NULL)),
  CONSTRAINT opportunity_location_preferences_source CHECK (
    (source = 'browser' AND location_precision = 'grid_0_01_degree' AND approximate_latitude IS NOT NULL AND place_id IS NULL) OR
    (source = 'manual' AND place_id IS NOT NULL AND city IS NOT NULL AND location_precision IN ('city_only', 'city_centroid'))
  ),
  CONSTRAINT opportunity_location_preferences_anchor CHECK (NOT enabled OR approximate_latitude IS NOT NULL OR (place_id IS NOT NULL AND city IS NOT NULL))
);
-- place_id membership is enforced by the future server validator against the
-- versioned reviewed vocabulary, not a duplicated SQL city allowlist. Service
-- callers must omit user-supplied ownership/timestamps and re-coarsen numbers.
-- Country may be unasserted: reviewed place_id + city is the manual anchor.

CREATE TABLE public.opportunity_locations (
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  location_key text NOT NULL CHECK (length(btrim(location_key)) BETWEEN 1 AND 160),
  country_code text CHECK (country_code ~ '^[A-Z]{2}$'),
  region text CHECK (length(btrim(region)) BETWEEN 1 AND 160),
  city text CHECK (length(btrim(city)) BETWEEN 1 AND 160),
  place_id text CHECK (length(btrim(place_id)) BETWEEN 1 AND 160),
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(10,6) CHECK (longitude BETWEEN -180 AND 180),
  location_precision text NOT NULL CHECK (location_precision IN ('city_only', 'city_centroid', 'source_point')),
  uncertainty_km numeric CHECK (uncertainty_km >= 0 AND uncertainty_km < 'Infinity'::numeric),
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('reviewed_city_mapping', 'source_point')),
  evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) BETWEEN 1 AND 512),
  normalization_version text NOT NULL CHECK (length(btrim(normalization_version)) BETWEEN 1 AND 80),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_locations_pk PRIMARY KEY (opportunity_id, location_key),
  CONSTRAINT opportunity_locations_coordinate_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT opportunity_locations_precision CHECK ((location_precision = 'city_only') = (latitude IS NULL)),
  CONSTRAINT opportunity_locations_evidence CHECK (
    (location_precision = 'source_point' AND evidence_kind = 'source_point') OR
    (location_precision IN ('city_only', 'city_centroid') AND evidence_kind = 'reviewed_city_mapping' AND place_id IS NOT NULL AND city IS NOT NULL)
  )
);
-- source_point is intentionally not employer-specific. This table references
-- opportunities without restricting type. References identify evidence, not
-- street addresses. Future application validation caps a complete set at 10.
-- PK prefixes support owner/parent reads; no redundant or spatial indexes.

CREATE TRIGGER opportunity_location_preferences_touch_updated_at
  BEFORE UPDATE ON public.opportunity_location_preferences
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_radar_touch_updated_at();
CREATE TRIGGER opportunity_locations_touch_updated_at
  BEFORE UPDATE ON public.opportunity_locations
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_radar_touch_updated_at();

ALTER TABLE public.opportunity_location_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_location_preferences, public.opportunity_locations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_location_preferences, public.opportunity_locations TO service_role;
-- No client grants or policies: default-deny RLS. Service-role queries bypass
-- RLS and MUST scope preferences to the authenticated user. A future catalog
-- writer must not receive preference access through its module/capability API.
COMMIT;
