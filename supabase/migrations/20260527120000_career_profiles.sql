-- Career Memory: persistent user career profile across analyses

CREATE TABLE IF NOT EXISTS public.career_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  career_identity text NOT NULL DEFAULT '',
  career_level text NOT NULL DEFAULT '',
  strong_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  weak_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  industries jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_profiles_updated_at_idx ON public.career_profiles (updated_at DESC);

ALTER TABLE public.career_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_profiles_select_own ON public.career_profiles;
DROP POLICY IF EXISTS career_profiles_insert_own ON public.career_profiles;
DROP POLICY IF EXISTS career_profiles_update_own ON public.career_profiles;
DROP POLICY IF EXISTS career_profiles_delete_own ON public.career_profiles;

CREATE POLICY career_profiles_select_own ON public.career_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY career_profiles_insert_own ON public.career_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY career_profiles_update_own ON public.career_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY career_profiles_delete_own ON public.career_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
