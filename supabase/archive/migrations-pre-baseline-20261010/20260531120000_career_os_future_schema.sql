-- Future-ready Career OS catalog tables (no UI dependency yet)

CREATE TABLE IF NOT EXISTS public.university_intelligence_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_slug text NOT NULL,
  university_name text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_version text NOT NULL DEFAULT 'v1',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_slug, country_code)
);

CREATE INDEX IF NOT EXISTS university_intelligence_catalog_name_idx
  ON public.university_intelligence_catalog (university_name);

CREATE TABLE IF NOT EXISTS public.city_intelligence_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug text NOT NULL,
  city_name text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_version text NOT NULL DEFAULT 'v1',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_slug, country_code)
);

CREATE INDEX IF NOT EXISTS city_intelligence_catalog_name_idx
  ON public.city_intelligence_catalog (city_name, country_code);

CREATE TABLE IF NOT EXISTS public.career_event_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'networking',
  title text NOT NULL DEFAULT '',
  location jsonb NOT NULL DEFAULT '{}'::jsonb,
  industry_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  role_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  relevance_score smallint NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_event_recommendations_user_idx
  ON public.career_event_recommendations (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_career_roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  roadmap jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_phase text NOT NULL DEFAULT 'foundation',
  target_role text NOT NULL DEFAULT '',
  target_industry text NOT NULL DEFAULT '',
  estimated_months smallint,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_career_roadmaps_user_active_idx
  ON public.student_career_roadmaps (user_id);

ALTER TABLE public.career_profiles
  ADD COLUMN IF NOT EXISTS primary_industry text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_countries jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.university_intelligence_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_intelligence_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_event_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_career_roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_catalog_read_authenticated"
  ON public.university_intelligence_catalog FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "city_catalog_read_authenticated"
  ON public.city_intelligence_catalog FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "career_events_own_user"
  ON public.career_event_recommendations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student_roadmaps_own_user"
  ON public.student_career_roadmaps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
