CREATE TABLE IF NOT EXISTS public.career_companion_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_type text NOT NULL CHECK (scenario_type = 'promotion_raise'), title text NOT NULL DEFAULT '',
  what_happened text NOT NULL, desired_outcome text NOT NULL, role_context text NOT NULL, achievements text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('low','medium','high')), manager_context text NOT NULL DEFAULT '',
  guidance jsonb, guidance_model text, guidance_prompt_version text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','guided','outcome_recorded')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS career_companion_cases_user_updated_idx ON public.career_companion_cases(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.career_companion_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL UNIQUE REFERENCES public.career_companion_cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, manager_response text NOT NULL,
  measurable_effect text NOT NULL DEFAULT '', proof_reference text NOT NULL DEFAULT '', outcome_date date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.career_companion_cases
    ADD CONSTRAINT career_companion_cases_id_user_unique UNIQUE (id, user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.career_companion_outcomes
    ADD CONSTRAINT career_companion_outcomes_case_user_fk
    FOREIGN KEY (case_id, user_id)
    REFERENCES public.career_companion_cases(id, user_id)
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS career_companion_outcomes_user_idx ON public.career_companion_outcomes(user_id, created_at DESC);
ALTER TABLE public.career_companion_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_companion_outcomes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY career_companion_cases_own ON public.career_companion_cases FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY career_companion_outcomes_own ON public.career_companion_outcomes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Safe to run once on a fresh database and safe to re-run after a successful application:
-- guarded constraints/policies are retained; no existing data is dropped or rewritten.
