/**
 * useSubscription.js — Fetches the authenticated user's subscription plan.
 *
 * Reads directly from Supabase (profiles table) using the client-side session,
 * avoiding backend roundtrips and RLS issues.
 *
 * Returns: { profile, plan, isPro, loading, refresh }
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient.js';

export function useSubscription(authUser) {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(false);

  const fetchProfile = useCallback(async (user) => {
    if (!user || !supabase) { setProfile(null); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, plan, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, plan_expires_at, created_at')
        .eq('id', user.id)
        .single();

      if (error) {
        // Profile row may not exist yet for brand-new users — treat as free
        console.warn('[useSubscription]', error.message);
        setProfile({ id: user.id, plan: 'free', subscription_status: 'inactive' });
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.warn('[useSubscription] fetch error:', err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile(authUser);
  }, [authUser, fetchProfile]);

  const plan  = profile?.plan || 'free';
  const isPro = plan === 'pro' &&
    ['active', 'trialing'].includes(profile?.subscription_status || '');

  return { profile, plan, isPro, loading, refresh: () => fetchProfile(authUser) };
}
