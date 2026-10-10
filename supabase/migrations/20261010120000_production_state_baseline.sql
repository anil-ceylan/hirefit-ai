-- NON-ACTIVE DRAFT: production-state fidelity baseline, 2026-10-08.
-- REVIEW ONLY. Not authorized for execution or production adoption.
-- Source: hirefit-prod-schema-capture-20261008.txt + approved sequence correction.
-- No data, buckets, platform internals, migration history, or uncertain bootstrap DDL.
-- Fresh isolated Supabase-compatible PostgreSQL 17 target ONLY. Not rerunnable.
-- See REPLAY-CONTRACT.md. The application migration chain remains untouched.

BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Explicit operator acknowledgement is necessary but NOT proof of target identity.
-- Independently verify a disposable target before any future execution.
DO $preflight$
BEGIN
  IF current_setting('hirefit.baseline_replay_target', true) IS DISTINCT FROM 'isolated-reviewed-target' THEN
    RAISE EXCEPTION 'DRAFT: isolated replay authorization/target verification required';
  END IF;
  IF current_user <> 'postgres' OR current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'Reviewed postgres execution role and PostgreSQL 17 required';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Supabase auth platform prerequisites missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_default_acl
    WHERE defaclrole = 'postgres'::regrole AND defaclnamespace = 0
  ) THEN
    RAISE EXCEPTION 'Unexpected global postgres default ACL; compatibility review required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (ARRAY[
      'analyses', 'career_companion_cases', 'career_companion_outcomes', 'career_profiles', 'career_progress_snapshots', 'opportunities', 'opportunity_location_preferences', 'opportunity_locations', 'opportunity_user_states', 'profiles', 'user_plans', 'user_plans_id_seq', 'waitlist'
    ])
  ) THEN
    RAISE EXCEPTION 'Target is not empty for baseline objects; never apply this draft to production';
  END IF;
  IF to_regprocedure('public.increment_user_plan_analysis(uuid)') IS NOT NULL
     OR to_regprocedure('public.opportunity_radar_touch_updated_at()') IS NOT NULL THEN
    RAISE EXCEPTION 'Application functions already exist; stop, do not replace';
  END IF;
  IF to_regprocedure('public.rls_auto_enable()') IS NULL THEN
    RAISE EXCEPTION 'Uncertain bootstrap absent: separate authorization required; baseline will not create it';
  END IF;
  IF replace(pg_get_functiondef('public.rls_auto_enable()'::regprocedure), chr(13), '')
       IS DISTINCT FROM replace($accepted_definition$CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
$accepted_definition$, chr(13), '')
     OR NOT EXISTS (
       SELECT 1 FROM pg_proc p
       WHERE p.oid = 'public.rls_auto_enable()'::regprocedure
         AND p.proowner = 'postgres'::regrole
         AND (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a)
           = (SELECT array_agg(a::text ORDER BY a::text) FROM unnest('{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) a)
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_event_trigger e
       WHERE e.evtname = 'ensure_rls' AND e.evtevent = 'ddl_command_end'
         AND e.evtenabled = 'O' AND e.evtowner = 'postgres'::regrole
         AND e.evtfoid = 'public.rls_auto_enable()'::regprocedure
         AND (SELECT array_agg(t ORDER BY t) FROM unnest(e.evttags) t)
           = ARRAY['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']::text[]
     )
     OR (SELECT count(*) FROM pg_event_trigger WHERE evtfoid = 'public.rls_auto_enable()'::regprocedure) <> 1 THEN
    RAISE EXCEPTION 'Uncertain bootstrap differs: stop for separate review; no automatic changes';
  END IF;
END;
$preflight$;

-- Tables: preserve captured ordinal column order, types, defaults and nullability.
CREATE TABLE "public"."analyses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" uuid DEFAULT gen_random_uuid(),
  "cv_text" text COLLATE "default",
  "job_description" text COLLATE "default",
  "alignment_score" bigint,
  "report" text COLLATE "default",
  "role" text COLLATE "default",
  "user_email" text COLLATE "default",
  "matched_skills" jsonb DEFAULT '[]'::jsonb,
  "missing_skills" jsonb DEFAULT '[]'::jsonb,
  "top_keywords" jsonb DEFAULT '[]'::jsonb,
  "rejection_reasons" jsonb DEFAULT '{}'::jsonb,
  "seniority" text COLLATE "default"
) USING heap;
ALTER TABLE "public"."analyses" OWNER TO postgres;
ALTER TABLE "public"."analyses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."analyses" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."analyses" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."career_companion_cases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "scenario_type" text COLLATE "default" NOT NULL,
  "title" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "what_happened" text COLLATE "default" NOT NULL,
  "desired_outcome" text COLLATE "default" NOT NULL,
  "role_context" text COLLATE "default" NOT NULL,
  "achievements" text COLLATE "default" NOT NULL,
  "urgency" text COLLATE "default" NOT NULL,
  "manager_context" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "guidance" jsonb,
  "guidance_model" text COLLATE "default",
  "guidance_prompt_version" text COLLATE "default",
  "status" text COLLATE "default" DEFAULT 'draft'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
) USING heap;
ALTER TABLE "public"."career_companion_cases" OWNER TO postgres;
ALTER TABLE "public"."career_companion_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_companion_cases" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_companion_cases" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."career_companion_outcomes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "manager_response" text COLLATE "default" NOT NULL,
  "measurable_effect" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "proof_reference" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "outcome_date" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
) USING heap;
ALTER TABLE "public"."career_companion_outcomes" OWNER TO postgres;
ALTER TABLE "public"."career_companion_outcomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_companion_outcomes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_companion_outcomes" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."career_profiles" (
  "user_id" uuid NOT NULL,
  "career_identity" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "career_level" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "strong_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "weak_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "experience" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "projects" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "target_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "weaknesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "profile_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "analysis_count" integer DEFAULT 0 NOT NULL,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "onboarding_draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "basic_profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "career_goals" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "career_dna" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "best_fit_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "recommended_next_move" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "growth_plan_30d" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "career_gps" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "university_intelligence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "city_intelligence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "career_readiness" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "primary_industry" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "target_countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
) USING heap;
ALTER TABLE "public"."career_profiles" OWNER TO postgres;
ALTER TABLE "public"."career_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_profiles" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_profiles" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."career_progress_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "analysis_id" uuid,
  "role" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "career_score" integer DEFAULT 0 NOT NULL,
  "ats_score" integer DEFAULT 0 NOT NULL,
  "recruiter_confidence" integer DEFAULT 0 NOT NULL,
  "product_readiness" integer DEFAULT 0 NOT NULL,
  "interview_readiness" integer DEFAULT 0 NOT NULL,
  "biggest_improvement" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "biggest_weakness" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
) USING heap;
ALTER TABLE "public"."career_progress_snapshots" OWNER TO postgres;
ALTER TABLE "public"."career_progress_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_progress_snapshots" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."career_progress_snapshots" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."opportunities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text COLLATE "default" NOT NULL,
  "subtype" text COLLATE "default" NOT NULL,
  "title" text COLLATE "default" NOT NULL,
  "organization" text COLLATE "default",
  "description" text COLLATE "default" DEFAULT ''::text NOT NULL,
  "source" text COLLATE "default" NOT NULL,
  "source_type" text COLLATE "default" NOT NULL,
  "source_item_id" text COLLATE "default" NOT NULL,
  "url" text COLLATE "default" NOT NULL,
  "country" text COLLATE "default",
  "city" text COLLATE "default",
  "work_mode" text COLLATE "default",
  "role_tags" text[] COLLATE "default" DEFAULT '{}'::text[] NOT NULL,
  "sector_tags" text[] COLLATE "default" DEFAULT '{}'::text[] NOT NULL,
  "skill_tags" text[] COLLATE "default" DEFAULT '{}'::text[] NOT NULL,
  "eligibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "deadline_at" timestamp with time zone,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "published" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT false NOT NULL,
  "verification_status" text COLLATE "default" DEFAULT 'unverified'::text NOT NULL,
  "last_verified_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "location_set_complete" boolean DEFAULT false NOT NULL
) USING heap;
ALTER TABLE "public"."opportunities" OWNER TO postgres;
ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunities" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunities" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."opportunity_location_preferences" (
  "user_id" uuid NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "source" text COLLATE "default" NOT NULL,
  "place_id" text COLLATE "default",
  "country_code" text COLLATE "default",
  "region" text COLLATE "default",
  "city" text COLLATE "default",
  "approximate_latitude" numeric(5,2),
  "approximate_longitude" numeric(6,2),
  "location_precision" text COLLATE "default" NOT NULL,
  "uncertainty_km" numeric,
  "radius_km" smallint NOT NULL,
  "include_remote" boolean DEFAULT false NOT NULL,
  "consent_version" text COLLATE "default" NOT NULL,
  "consented_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
) USING heap;
ALTER TABLE "public"."opportunity_location_preferences" OWNER TO postgres;
ALTER TABLE "public"."opportunity_location_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunity_location_preferences" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunity_location_preferences" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."opportunity_locations" (
  "opportunity_id" uuid NOT NULL,
  "location_key" text COLLATE "default" NOT NULL,
  "country_code" text COLLATE "default",
  "region" text COLLATE "default",
  "city" text COLLATE "default",
  "place_id" text COLLATE "default",
  "latitude" numeric(9,6),
  "longitude" numeric(10,6),
  "location_precision" text COLLATE "default" NOT NULL,
  "uncertainty_km" numeric,
  "evidence_kind" text COLLATE "default" NOT NULL,
  "evidence_reference" text COLLATE "default" NOT NULL,
  "normalization_version" text COLLATE "default" NOT NULL,
  "verified_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
) USING heap;
ALTER TABLE "public"."opportunity_locations" OWNER TO postgres;
ALTER TABLE "public"."opportunity_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunity_locations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunity_locations" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."opportunity_user_states" (
  "user_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "state" text COLLATE "default" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
) USING heap;
ALTER TABLE "public"."opportunity_user_states" OWNER TO postgres;
ALTER TABLE "public"."opportunity_user_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunity_user_states" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."opportunity_user_states" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text COLLATE "default" NOT NULL,
  "plan" text COLLATE "default",
  "created_at" timestamp without time zone DEFAULT now()
) USING heap;
ALTER TABLE "public"."profiles" OWNER TO postgres;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."user_plans" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY (SEQUENCE NAME public.user_plans_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE) NOT NULL,
  "user_id" text COLLATE "default" NOT NULL,
  "plan" text COLLATE "default" DEFAULT 'free'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "analysis_count" integer DEFAULT 0,
  "last_reset_at" timestamp with time zone DEFAULT now()
) USING heap;
ALTER TABLE "public"."user_plans" OWNER TO postgres;
ALTER TABLE "public"."user_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_plans" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_plans" REPLICA IDENTITY DEFAULT;

CREATE TABLE "public"."waitlist" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "email" text COLLATE "default"
) USING heap;
ALTER TABLE "public"."waitlist" OWNER TO postgres;
ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."waitlist" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."waitlist" REPLICA IDENTITY DEFAULT;

-- Constraints: keys/checks first, then foreign keys. Exact captured definitions.
ALTER TABLE public."analyses" ADD CONSTRAINT "analyses_pkey" PRIMARY KEY (id);
ALTER TABLE public."career_companion_cases" ADD CONSTRAINT "career_companion_cases_id_user_unique" UNIQUE (id, user_id);
ALTER TABLE public."career_companion_cases" ADD CONSTRAINT "career_companion_cases_pkey" PRIMARY KEY (id);
ALTER TABLE public."career_companion_cases" ADD CONSTRAINT "career_companion_cases_scenario_type_check" CHECK ((scenario_type = 'promotion_raise'::text));
ALTER TABLE public."career_companion_cases" ADD CONSTRAINT "career_companion_cases_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'guided'::text, 'outcome_recorded'::text])));
ALTER TABLE public."career_companion_cases" ADD CONSTRAINT "career_companion_cases_urgency_check" CHECK ((urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
ALTER TABLE public."career_companion_outcomes" ADD CONSTRAINT "career_companion_outcomes_case_id_key" UNIQUE (case_id);
ALTER TABLE public."career_companion_outcomes" ADD CONSTRAINT "career_companion_outcomes_pkey" PRIMARY KEY (id);
ALTER TABLE public."career_profiles" ADD CONSTRAINT "career_profiles_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."career_progress_snapshots" ADD CONSTRAINT "career_progress_snapshots_pkey" PRIMARY KEY (id);
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_city_check" CHECK ((length(city) <= 160));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_country_check" CHECK ((country ~ '^[A-Z]{2}$'::text));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_date_order" CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at >= starts_at)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_description_check" CHECK ((length(description) <= 12000));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_eligibility_check" CHECK (((jsonb_typeof(eligibility) = 'object'::text) AND (octet_length((eligibility)::text) <= 16000)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_fixture_not_published" CHECK (((source_type <> 'fixture'::text) OR ((NOT published) AND (NOT active))));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_job_subtype" CHECK (((type <> 'job'::text) OR (subtype = ANY (ARRAY['full-time'::text, 'part-time'::text, 'freelance'::text, 'internship'::text]))));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_organization_check" CHECK ((length(organization) <= 240));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY (id);
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_requirements_check" CHECK (((jsonb_typeof(requirements) = 'object'::text) AND (octet_length((requirements)::text) <= 16000)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_role_tags_check" CHECK ((cardinality(role_tags) <= 30));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_sector_tags_check" CHECK ((cardinality(sector_tags) <= 30));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_skill_tags_check" CHECK ((cardinality(skill_tags) <= 60));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_source_check" CHECK (((length(btrim(source)) >= 1) AND (length(btrim(source)) <= 160)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_source_item_id_check" CHECK (((length(btrim(source_item_id)) >= 1) AND (length(btrim(source_item_id)) <= 240)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_source_item_unique" UNIQUE (source, source_item_id);
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_source_type_check" CHECK ((source_type = ANY (ARRAY['employer'::text, 'job_board'::text, 'curated'::text, 'fixture'::text])));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_subtype_check" CHECK (((length(btrim(subtype)) >= 1) AND (length(btrim(subtype)) <= 80)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_title_check" CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 240)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_type_check" CHECK ((type = ANY (ARRAY['job'::text, 'person'::text, 'event'::text])));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_url_check" CHECK (((length(url) <= 2048) AND (url ~ '^https?://[^[:space:]]+$'::text)));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_url_unique" UNIQUE (url);
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_verification_status_check" CHECK ((verification_status = ANY (ARRAY['unverified'::text, 'verified'::text, 'rejected'::text])));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_verified_provenance" CHECK (((verification_status <> 'verified'::text) OR ((source_type <> 'fixture'::text) AND (last_verified_at IS NOT NULL) AND (expires_at IS NOT NULL) AND (expires_at > last_verified_at))));
ALTER TABLE public."opportunities" ADD CONSTRAINT "opportunities_work_mode_check" CHECK ((work_mode = ANY (ARRAY['onsite'::text, 'hybrid'::text, 'remote'::text, 'flexible'::text])));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_anchor" CHECK (((NOT enabled) OR (approximate_latitude IS NOT NULL) OR ((place_id IS NOT NULL) AND (city IS NOT NULL))));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_approximate_latitude_check" CHECK (((approximate_latitude >= ('-90'::integer)::numeric) AND (approximate_latitude <= (90)::numeric)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_approximate_longitude_check" CHECK (((approximate_longitude >= ('-180'::integer)::numeric) AND (approximate_longitude <= (180)::numeric)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_city_check" CHECK (((length(btrim(city)) >= 1) AND (length(btrim(city)) <= 160)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_consent_version_check" CHECK (((length(btrim(consent_version)) >= 1) AND (length(btrim(consent_version)) <= 80)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_coordinate_pair" CHECK (((approximate_latitude IS NULL) = (approximate_longitude IS NULL)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_country_code_check" CHECK ((country_code ~ '^[A-Z]{2}$'::text));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_location_precision_check" CHECK ((location_precision = ANY (ARRAY['grid_0_01_degree'::text, 'city_centroid'::text, 'city_only'::text])));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_place_id_check" CHECK (((length(btrim(place_id)) >= 1) AND (length(btrim(place_id)) <= 160)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_precision" CHECK (((location_precision = 'city_only'::text) = (approximate_latitude IS NULL)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_radius_km_check" CHECK ((radius_km = ANY (ARRAY[10, 25, 50, 100])));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_region_check" CHECK (((length(btrim(region)) >= 1) AND (length(btrim(region)) <= 160)));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_source" CHECK ((((source = 'browser'::text) AND (location_precision = 'grid_0_01_degree'::text) AND (approximate_latitude IS NOT NULL) AND (place_id IS NULL)) OR ((source = 'manual'::text) AND (place_id IS NOT NULL) AND (city IS NOT NULL) AND (location_precision = ANY (ARRAY['city_only'::text, 'city_centroid'::text])))));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_source_check" CHECK ((source = ANY (ARRAY['browser'::text, 'manual'::text])));
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_uncertainty_km_check" CHECK (((uncertainty_km >= (0)::numeric) AND (uncertainty_km < 'Infinity'::numeric)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_city_check" CHECK (((length(btrim(city)) >= 1) AND (length(btrim(city)) <= 160)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_coordinate_pair" CHECK (((latitude IS NULL) = (longitude IS NULL)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_country_code_check" CHECK ((country_code ~ '^[A-Z]{2}$'::text));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_evidence" CHECK ((((location_precision = 'source_point'::text) AND (evidence_kind = 'source_point'::text)) OR ((location_precision = ANY (ARRAY['city_only'::text, 'city_centroid'::text])) AND (evidence_kind = 'reviewed_city_mapping'::text) AND (place_id IS NOT NULL) AND (city IS NOT NULL))));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_evidence_kind_check" CHECK ((evidence_kind = ANY (ARRAY['reviewed_city_mapping'::text, 'source_point'::text])));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_evidence_reference_check" CHECK (((length(btrim(evidence_reference)) >= 1) AND (length(btrim(evidence_reference)) <= 512)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_latitude_check" CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_location_key_check" CHECK (((length(btrim(location_key)) >= 1) AND (length(btrim(location_key)) <= 160)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_location_precision_check" CHECK ((location_precision = ANY (ARRAY['city_only'::text, 'city_centroid'::text, 'source_point'::text])));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_longitude_check" CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_normalization_version_check" CHECK (((length(btrim(normalization_version)) >= 1) AND (length(btrim(normalization_version)) <= 80)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_pk" PRIMARY KEY (opportunity_id, location_key);
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_place_id_check" CHECK (((length(btrim(place_id)) >= 1) AND (length(btrim(place_id)) <= 160)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_precision" CHECK (((location_precision = 'city_only'::text) = (latitude IS NULL)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_region_check" CHECK (((length(btrim(region)) >= 1) AND (length(btrim(region)) <= 160)));
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_uncertainty_km_check" CHECK (((uncertainty_km >= (0)::numeric) AND (uncertainty_km < 'Infinity'::numeric)));
ALTER TABLE public."opportunity_user_states" ADD CONSTRAINT "opportunity_user_states_pk" PRIMARY KEY (user_id, opportunity_id);
ALTER TABLE public."opportunity_user_states" ADD CONSTRAINT "opportunity_user_states_state_check" CHECK ((state = ANY (ARRAY['saved'::text, 'dismissed'::text, 'acted_on'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_plans" ADD CONSTRAINT "user_plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_plans" ADD CONSTRAINT "user_plans_user_id_key" UNIQUE (user_id);
ALTER TABLE public."waitlist" ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY (id);
ALTER TABLE public."career_companion_cases" ADD CONSTRAINT "career_companion_cases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."career_companion_outcomes" ADD CONSTRAINT "career_companion_outcomes_case_id_fkey" FOREIGN KEY (case_id) REFERENCES career_companion_cases(id) ON DELETE CASCADE;
ALTER TABLE public."career_companion_outcomes" ADD CONSTRAINT "career_companion_outcomes_case_user_fk" FOREIGN KEY (case_id, user_id) REFERENCES career_companion_cases(id, user_id) ON DELETE CASCADE;
ALTER TABLE public."career_companion_outcomes" ADD CONSTRAINT "career_companion_outcomes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."career_profiles" ADD CONSTRAINT "career_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."career_progress_snapshots" ADD CONSTRAINT "career_progress_snapshots_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."opportunity_location_preferences" ADD CONSTRAINT "opportunity_location_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."opportunity_locations" ADD CONSTRAINT "opportunity_locations_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE;
ALTER TABLE public."opportunity_user_states" ADD CONSTRAINT "opportunity_user_states_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE RESTRICT;
ALTER TABLE public."opportunity_user_states" ADD CONSTRAINT "opportunity_user_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Constraint-backed indexes are created by constraints; do not duplicate them.
CREATE INDEX career_companion_cases_user_updated_idx ON public.career_companion_cases USING btree (user_id, updated_at DESC);
CREATE INDEX career_companion_outcomes_user_idx ON public.career_companion_outcomes USING btree (user_id, created_at DESC);
CREATE INDEX career_profiles_onboarding_idx ON public.career_profiles USING btree (onboarding_completed, updated_at DESC);
CREATE INDEX career_profiles_updated_at_idx ON public.career_profiles USING btree (updated_at DESC);
CREATE INDEX career_progress_user_created_idx ON public.career_progress_snapshots USING btree (user_id, created_at DESC);
CREATE INDEX opportunities_expiry_idx ON public.opportunities USING btree (expires_at) WHERE (published AND active);
CREATE INDEX opportunities_visible_jobs_idx ON public.opportunities USING btree (last_verified_at DESC, id) WHERE ((type = 'job'::text) AND published AND active AND (verification_status = 'verified'::text) AND (source_type <> 'fixture'::text));
CREATE INDEX opportunity_user_states_opportunity_idx ON public.opportunity_user_states USING btree (opportunity_id);
CREATE INDEX opportunity_user_states_user_state_idx ON public.opportunity_user_states USING btree (user_id, state, updated_at DESC);

-- Application functions only. CREATE (not replacement) fails on unexpected existing objects.
CREATE FUNCTION public.increment_user_plan_analysis(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO public.user_plans (user_id, plan, analysis_count, last_reset_at)
  VALUES (p_user_id, 'free', 1, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    analysis_count = CASE
      WHEN user_plans.plan = 'pro' THEN user_plans.analysis_count
      ELSE user_plans.analysis_count + 1
    END;
END;
$function$;
ALTER FUNCTION public.increment_user_plan_analysis(uuid) OWNER TO postgres;
CREATE FUNCTION public.opportunity_radar_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END $function$;
ALTER FUNCTION public.opportunity_radar_touch_updated_at() OWNER TO postgres;

-- Captured application triggers.
CREATE TRIGGER opportunities_touch_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION opportunity_radar_touch_updated_at();
CREATE TRIGGER opportunity_location_preferences_touch_updated_at BEFORE UPDATE ON public.opportunity_location_preferences FOR EACH ROW EXECUTE FUNCTION opportunity_radar_touch_updated_at();
CREATE TRIGGER opportunity_locations_touch_updated_at BEFORE UPDATE ON public.opportunity_locations FOR EACH ROW EXECUTE FUNCTION opportunity_radar_touch_updated_at();
CREATE TRIGGER opportunity_user_states_touch_updated_at BEFORE UPDATE ON public.opportunity_user_states FOR EACH ROW EXECUTE FUNCTION opportunity_radar_touch_updated_at();

-- Exact policy roles, commands, USING and WITH CHECK; no added policies.
CREATE POLICY "analyses_delete_own" ON "public"."analyses" AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((auth.uid() = user_id));
CREATE POLICY "analyses_insert_own" ON "public"."analyses" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "analyses_select_own" ON "public"."analyses" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((auth.uid() = user_id));
CREATE POLICY "analyses_update_own" ON "public"."analyses" AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "career_companion_cases_own" ON "public"."career_companion_cases" AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "career_companion_outcomes_own" ON "public"."career_companion_outcomes" AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "career_profiles_delete_own" ON "public"."career_profiles" AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((auth.uid() = user_id));
CREATE POLICY "career_profiles_insert_own" ON "public"."career_profiles" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "career_profiles_select_own" ON "public"."career_profiles" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((auth.uid() = user_id));
CREATE POLICY "career_profiles_update_own" ON "public"."career_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "career_progress_delete_own" ON "public"."career_progress_snapshots" AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((auth.uid() = user_id));
CREATE POLICY "career_progress_insert_own" ON "public"."career_progress_snapshots" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "career_progress_select_own" ON "public"."career_progress_snapshots" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((auth.uid() = user_id));
CREATE POLICY "opportunities_read_verified_jobs" ON "public"."opportunities" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((type = 'job'::text) AND published AND active AND (verification_status = 'verified'::text) AND (source_type <> 'fixture'::text) AND (last_verified_at <= now()) AND (expires_at > now()) AND ((deadline_at IS NULL) OR (deadline_at > now())) AND ((ends_at IS NULL) OR (ends_at > now()))));
CREATE POLICY "opportunity_user_states_read_own" ON "public"."opportunity_user_states" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own plan" ON "public"."user_plans" AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Users can read own plan" ON "public"."user_plans" AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Users can update own plan" ON "public"."user_plans" AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING (((auth.uid())::text = user_id));

-- Reset inherited direct grants on ONLY objects created above, then restore captured ACLs.
-- This is fidelity normalization, NOT security hardening. Owner/grantor is postgres.
DO $relation_acl$
DECLARE target record; recipient record;
BEGIN
  FOR target IN
    SELECT c.oid, n.nspname, c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (ARRAY[
      'analyses', 'career_companion_cases', 'career_companion_outcomes', 'career_profiles', 'career_progress_snapshots', 'opportunities', 'opportunity_location_preferences', 'opportunity_locations', 'opportunity_user_states', 'profiles', 'user_plans', 'user_plans_id_seq', 'waitlist'
    ])
  LOOP
    FOR recipient IN SELECT DISTINCT grantee FROM aclexplode(
      coalesce((SELECT relacl FROM pg_class WHERE oid = target.oid),
               acldefault(CASE WHEN target.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END, 'postgres'::regrole)))
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON %s %I.%I FROM %s',
        CASE WHEN target.relkind = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END,
        target.nspname, target.relname,
        CASE WHEN recipient.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(recipient.grantee)) END);
    END LOOP;
  END LOOP;
END;
$relation_acl$;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analyses" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analyses" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analyses" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analyses" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_cases" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_cases" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_cases" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_cases" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_outcomes" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_outcomes" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_outcomes" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_companion_outcomes" TO "service_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."career_profiles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_profiles" TO "postgres";
GRANT INSERT, SELECT, UPDATE ON TABLE "public"."career_profiles" TO "service_role";
GRANT DELETE, INSERT, SELECT ON TABLE "public"."career_progress_snapshots" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."career_progress_snapshots" TO "postgres";
GRANT INSERT, SELECT ON TABLE "public"."career_progress_snapshots" TO "service_role";
GRANT SELECT ON TABLE "public"."opportunities" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunities" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunities" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunity_location_preferences" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunity_location_preferences" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunity_locations" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunity_locations" TO "service_role";
GRANT SELECT ON TABLE "public"."opportunity_user_states" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunity_user_states" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opportunity_user_states" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_plans" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_plans" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_plans" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_plans" TO "service_role";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."user_plans_id_seq" TO "anon";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."user_plans_id_seq" TO "authenticated";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."user_plans_id_seq" TO "postgres";
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."user_plans_id_seq" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."waitlist" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."waitlist" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."waitlist" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."waitlist" TO "service_role";

DO $function_acl$
DECLARE target regprocedure; recipient record;
BEGIN
  FOREACH target IN ARRAY ARRAY['public.increment_user_plan_analysis(uuid)'::regprocedure, 'public.opportunity_radar_touch_updated_at()'::regprocedure]
  LOOP
    FOR recipient IN SELECT DISTINCT grantee FROM pg_proc p,
      LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = target
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %s', target,
        CASE WHEN recipient.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(recipient.grantee)) END);
    END LOOP;
  END LOOP;
END;
$function_acl$;
GRANT EXECUTE ON FUNCTION public.increment_user_plan_analysis(uuid) TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.opportunity_radar_touch_updated_at() TO PUBLIC, postgres, anon, authenticated, service_role;

-- Preserve ONLY postgres/public application-owner default ACLs.
-- Platform-owned and auth/storage defaults are compatibility prerequisites, not ours to change.
DO $default_acl$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT DISTINCT d.defaclobjtype, a.grantee FROM pg_default_acl d,
      LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
      AND d.defaclobjtype IN ('r', 'S', 'f')
  LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON %s FROM %s',
      CASE item.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' ELSE 'FUNCTIONS' END,
      CASE WHEN item.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(item.grantee)) END);
  END LOOP;
END;
$default_acl$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- No data copied; identity starts at 1. No sequence setval, bucket creation or history repair.
COMMIT;
