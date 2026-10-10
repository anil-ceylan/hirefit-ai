-- Career Profile Onboarding fields (extends career_profiles)

ALTER TABLE public.career_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS basic_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS career_goals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS career_dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS best_fit_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_next_move text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS growth_plan_30d text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS career_profiles_onboarding_idx
  ON public.career_profiles (onboarding_completed, updated_at DESC);
