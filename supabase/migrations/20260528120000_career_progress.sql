-- Career Progress: persistent score timeline per analysis

CREATE TABLE IF NOT EXISTS public.career_progress_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  analysis_id uuid,
  role text NOT NULL DEFAULT '',
  career_score integer NOT NULL DEFAULT 0,
  ats_score integer NOT NULL DEFAULT 0,
  recruiter_confidence integer NOT NULL DEFAULT 0,
  product_readiness integer NOT NULL DEFAULT 0,
  interview_readiness integer NOT NULL DEFAULT 0,
  biggest_improvement jsonb NOT NULL DEFAULT '[]'::jsonb,
  biggest_weakness text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_progress_user_created_idx
  ON public.career_progress_snapshots (user_id, created_at DESC);

ALTER TABLE public.career_progress_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_progress_select_own ON public.career_progress_snapshots;
DROP POLICY IF EXISTS career_progress_insert_own ON public.career_progress_snapshots;
DROP POLICY IF EXISTS career_progress_delete_own ON public.career_progress_snapshots;

CREATE POLICY career_progress_select_own ON public.career_progress_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY career_progress_insert_own ON public.career_progress_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY career_progress_delete_own ON public.career_progress_snapshots
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
