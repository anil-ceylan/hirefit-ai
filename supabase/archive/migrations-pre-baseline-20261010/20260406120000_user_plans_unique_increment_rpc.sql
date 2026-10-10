-- Run in Supabase SQL Editor if you do not use CLI migrations.
-- 1) Remove duplicate rows per user_id (keeps row with largest id).
DELETE FROM public.user_plans a
WHERE EXISTS (
  SELECT 1 FROM public.user_plans b
  WHERE b.user_id = a.user_id AND b.id > a.id
);

-- 2) UNIQUE on user_id (idempotent if constraint already exists).
DO $$
BEGIN
  ALTER TABLE public.user_plans
    ADD CONSTRAINT user_plans_user_id_key UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Atomically ensure row exists and increment free-tier count (pro unchanged).
CREATE OR REPLACE FUNCTION public.increment_user_plan_analysis(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.increment_user_plan_analysis(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_plan_analysis(uuid) TO authenticated;
