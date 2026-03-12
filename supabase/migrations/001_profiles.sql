-- ============================================================
-- Migration 001 — profiles table + auto-create trigger
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Profiles table (one row per auth user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan              text        NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  stripe_customer_id text,
  plan_expires_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. Index for Stripe lookups
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 3. RLS — users can read their own profile, backend (service_role) can write
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- service_role bypasses RLS automatically — no extra policy needed for backend writes

-- 4. Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Backfill existing users (users created before this migration)
INSERT INTO public.profiles (id, plan)
SELECT id, 'free'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Verify:
-- SELECT * FROM public.profiles;
-- ============================================================
