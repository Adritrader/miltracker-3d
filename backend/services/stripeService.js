/**
 * stripeService.js — Stripe checkout, billing portal, and webhook handling
 *
 * Plans (set price IDs in backend/.env):
 *   STRIPE_PRICE_MONTHLY   — e.g. price_xxx  (~$9.99/mo)
 *   STRIPE_PRICE_ANNUAL    — e.g. price_yyy  (~$95.88/yr)
 *   STRIPE_WEBHOOK_SECRET  — whsec_xxx from Stripe Dashboard
 */

import Stripe from 'stripe';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let stripe = null;
if (STRIPE_SECRET) {
  stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });
  console.log('[Stripe] Initialized');
} else {
  console.warn('[Stripe] STRIPE_SECRET_KEY not set — payments disabled');
}

export function isStripeEnabled() {
  return stripe !== null;
}

/**
 * Create or retrieve a Stripe Customer for a user.
 * Reuses existing stripe_customer_id if already stored in profile.
 */
export async function getOrCreateCustomer(userId, email, existingCustomerId) {
  if (!stripe) throw new Error('Stripe not configured');
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) return customer;
    } catch { /* customer not found, create new */ }
  }
  return stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });
}

/**
 * Create a Stripe Checkout Session for a subscription.
 * @param {string} userId
 * @param {string} email
 * @param {string} priceId   — STRIPE_PRICE_MONTHLY or STRIPE_PRICE_ANNUAL
 * @param {string|null} existingCustomerId
 * @param {string} successUrl
 * @param {string} cancelUrl
 */
export async function createCheckoutSession({ userId, email, priceId, existingCustomerId, successUrl, cancelUrl }) {
  if (!stripe) throw new Error('Stripe not configured');

  const customer = await getOrCreateCustomer(userId, email, existingCustomerId);

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
    metadata: { supabase_user_id: userId },
  });

  return { sessionId: session.id, url: session.url, customerId: customer.id };
}

/**
 * Create a Stripe Billing Portal session so users can manage their subscription.
 */
export async function createPortalSession({ customerId, returnUrl }) {
  if (!stripe) throw new Error('Stripe not configured');
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

/**
 * Verify and parse a Stripe webhook event from raw body + signature header.
 */
export function constructWebhookEvent(rawBody, sig) {
  if (!stripe || !WEBHOOK_SECRET) throw new Error('Stripe webhook not configured');
  return stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
}

/**
 * Determine plan tier and expiry from a Stripe subscription object.
 * Returns { plan, subscription_status, plan_expires_at, stripe_price_id }
 */
export function planFromSubscription(sub) {
  if (!sub) return { plan: 'free', subscription_status: 'inactive', plan_expires_at: null, stripe_price_id: null };

  const status = sub.status; // active | trialing | past_due | canceled | unpaid | incomplete
  const priceId = sub.items?.data?.[0]?.price?.id || null;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const isPaid = ['active', 'trialing'].includes(status);
  const plan = isPaid ? 'pro' : 'free';

  return { plan, subscription_status: status, plan_expires_at: periodEnd, stripe_price_id: priceId };
}
