-- Additive, one-time migration. Never seeds opportunities or changes profiles.
-- If either name already exists, STOP for schema review; do not overwrite it.
-- Apply via the normal migration workflow after a target/schema preflight.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.opportunities') IS NOT NULL OR
     to_regclass('public.opportunity_user_states') IS NOT NULL THEN
    RAISE EXCEPTION 'Opportunity Radar tables already exist; review schema before applying';
  END IF;
END $$;

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('job', 'person', 'event')),
  subtype text NOT NULL CHECK (length(btrim(subtype)) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  organization text CHECK (length(organization) <= 240),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 12000),
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 1 AND 160),
  source_type text NOT NULL CHECK (source_type IN ('employer', 'job_board', 'curated', 'fixture')),
  source_item_id text NOT NULL CHECK (length(btrim(source_item_id)) BETWEEN 1 AND 240),
  url text NOT NULL CHECK (length(url) <= 2048 AND url ~ '^https?://[^[:space:]]+$'),
  country text CHECK (country ~ '^[A-Z]{2}$'),
  city text CHECK (length(city) <= 160),
  work_mode text CHECK (work_mode IN ('onsite', 'hybrid', 'remote', 'flexible')),
  role_tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(role_tags) <= 30),
  sector_tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(sector_tags) <= 30),
  skill_tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(skill_tags) <= 60),
  eligibility jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(eligibility) = 'object' AND octet_length(eligibility::text) <= 16000),
  requirements jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(requirements) = 'object' AND octet_length(requirements::text) <= 16000),
  deadline_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  published boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'rejected')),
  last_verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_source_item_unique UNIQUE (source, source_item_id),
  CONSTRAINT opportunities_url_unique UNIQUE (url),
  CONSTRAINT opportunities_job_subtype CHECK (type <> 'job' OR subtype IN ('full-time', 'part-time', 'freelance', 'internship')),
  CONSTRAINT opportunities_date_order CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT opportunities_verified_provenance CHECK (verification_status <> 'verified' OR
    (source_type <> 'fixture' AND last_verified_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at > last_verified_at)),
  CONSTRAINT opportunities_fixture_not_published CHECK (source_type <> 'fixture' OR (NOT published AND NOT active))
);

CREATE INDEX opportunities_visible_jobs_idx ON public.opportunities (last_verified_at DESC, id)
  WHERE type = 'job' AND published AND active AND verification_status = 'verified' AND source_type <> 'fixture';
CREATE INDEX opportunities_expiry_idx ON public.opportunities (expires_at) WHERE published AND active;

CREATE TABLE public.opportunity_user_states (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('saved', 'dismissed', 'acted_on')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_user_states_pk PRIMARY KEY (user_id, opportunity_id)
);
CREATE INDEX opportunity_user_states_user_state_idx ON public.opportunity_user_states (user_id, state, updated_at DESC);
CREATE INDEX opportunity_user_states_opportunity_idx ON public.opportunity_user_states (opportunity_id);

CREATE FUNCTION public.opportunity_radar_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunities_touch_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_radar_touch_updated_at();
CREATE TRIGGER opportunity_user_states_touch_updated_at BEFORE UPDATE ON public.opportunity_user_states
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_radar_touch_updated_at();

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_user_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunities, public.opportunity_user_states FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.opportunities, public.opportunity_user_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities, public.opportunity_user_states TO service_role;

CREATE POLICY opportunities_read_verified_jobs ON public.opportunities FOR SELECT TO authenticated USING (
  type = 'job' AND published AND active AND verification_status = 'verified' AND source_type <> 'fixture'
  AND last_verified_at <= now() AND expires_at > now()
  AND (deadline_at IS NULL OR deadline_at > now()) AND (ends_at IS NULL OR ends_at > now())
);
CREATE POLICY opportunity_user_states_read_own ON public.opportunity_user_states FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- No direct client write policies/grants. Writes go through the authenticated
-- API, whose service-role queries must explicitly scope to the verified user.
COMMIT;
