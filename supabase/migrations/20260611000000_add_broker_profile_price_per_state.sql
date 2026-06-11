-- Add the broker onboarding default price used for per-state bids.
-- Existing broker profile fields are already managed by the broker portal migrations.

ALTER TABLE public.broker_profiles
  ADD COLUMN IF NOT EXISTS price_per_state integer;

UPDATE public.broker_profiles
SET price_per_state = 2250
WHERE price_per_state IS NULL;

ALTER TABLE public.broker_profiles
  ALTER COLUMN price_per_state SET DEFAULT 2250,
  ALTER COLUMN price_per_state SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'broker_profiles_price_per_state_check'
  ) THEN
    ALTER TABLE public.broker_profiles
      ADD CONSTRAINT broker_profiles_price_per_state_check
      CHECK (price_per_state >= 2250);
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
