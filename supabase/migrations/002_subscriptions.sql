-- ============================================================
-- Migration 002 — extend profiles with Stripe subscription fields
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add Stripe subscription tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id         text,
  ADD COLUMN IF NOT EXISTS subscription_status     text NOT NULL DEFAULT 'inactive';
  -- subscription_status values: 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled'

-- Index for webhook lookups by subscription ID
CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx
  ON public.profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================
-- Verify:
-- SELECT id, plan, subscription_status, plan_expires_at FROM public.profiles;
-- ============================================================
