-- Career OS intelligence payloads (GPS, university, city, readiness)

ALTER TABLE public.career_profiles
  ADD COLUMN IF NOT EXISTS career_gps jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS university_intelligence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS city_intelligence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS career_readiness jsonb NOT NULL DEFAULT '{}'::jsonb;
