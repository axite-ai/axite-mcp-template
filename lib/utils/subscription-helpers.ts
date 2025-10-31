/**
 * Subscription Helper Functions
 *
 * Utilities for checking subscription status, tiers, and limits using Better Auth Stripe plugin
 */

import { auth } from "../auth";
import { Pool } from "pg";

/**
 * Get user's subscription from Better Auth Stripe plugin
 *
 * Queries the database directly since we're already on the server side with a validated userId.
 * The auth.api methods are designed for external API calls with session cookies.
 */
export async function getUserSubscription(userId: string) {
  const pool = auth.options.database as Pool;
  console.log('[Subscription] Attempting to connect to database from pool...');
  const client = await pool.connect();
  console.log('[Subscription] Successfully connected to database client.');
  try {
    // Query for active subscriptions for this user
    const result = await client.query(
      `SELECT * FROM subscription
      WHERE "referenceId" = $1
      AND status IN ('active', 'trialing')
      ORDER BY "periodStart" DESC
      LIMIT 1`,
      [userId]
    );

    return result?.rows?.[0] || null;
  } catch (error) {
    console.error(`[Subscription] Error fetching subscription for userId: ${userId}`, error);
    return null;
  } finally {
    client.release();
    console.log('[Subscription] Database client released.');
  }
}

/**
 * Check if user has an active subscription
 * Returns true if subscription status is 'active' or 'trialing'
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return subscription?.status === 'active' || subscription?.status === 'trialing';
}

/**
 * Get user's subscription tier (plan name)
 * Returns 'basic', 'pro', 'enterprise', or null if no active subscription
 */
export async function getSubscriptionTier(userId: string): Promise<string | null> {
  const subscription = await getUserSubscription(userId);
  return subscription?.plan || null;
}

/**
 * Get subscription limits based on tier
 */
export async function getSubscriptionLimits(userId: string) {
  const tier = await getSubscriptionTier(userId);

  const LIMITS = {
    basic: { maxAccounts: 3 },
    pro: { maxAccounts: 10 },
    enterprise: { maxAccounts: Infinity }
  };

  return tier ? LIMITS[tier as keyof typeof LIMITS] : null;
}

/**
 * Check if user can connect more accounts based on their subscription limits
 */
export async function canConnectMoreAccounts(userId: string, currentAccountCount: number): Promise<boolean> {
  const limits = await getSubscriptionLimits(userId);

  if (!limits) {
    return false; // No subscription = can't connect accounts
  }

  return currentAccountCount < limits.maxAccounts;
}

