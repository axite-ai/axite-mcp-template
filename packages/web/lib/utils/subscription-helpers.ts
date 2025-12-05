/**
 * Subscription Helper Functions
 *
 * Utilities for checking subscription status, tiers, and limits using Better Auth Stripe plugin
 */

import { db } from "@/lib/db";
import { subscription } from "@/lib/db/schema";
import { eq, and, inArray, desc, count as drizzleCount } from "drizzle-orm";

/**
 * Get user's subscription from Better Auth Stripe plugin
 *
 * Queries the database directly since we're already on the server side with a validated userId.
 * The auth.api methods are designed for external API calls with session cookies.
 */
export async function getUserSubscription(userId: string) {
  console.log('[Subscription] Querying database for user subscription...');

  try {
    // First, check ALL subscriptions for this user (any status)
    const allSubs = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, userId));

    console.log('[Subscription] All subscriptions for user (any status):', {
      userId,
      count: allSubs.length,
      subscriptions: allSubs,
      statuses: allSubs.map(s => s.status)
    });

    // Also check if there are ANY subscriptions in the table
    const [totalSubsCount] = await db
      .select({ total: drizzleCount() })
      .from(subscription);

    console.log('[Subscription] Total subscriptions in database:', totalSubsCount);

    // Query for active subscriptions for this user
    const result = await db
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, userId),
          inArray(subscription.status, ['active', 'trialing'])
        )
      )
      .orderBy(desc(subscription.periodStart))
      .limit(1);

    console.log('[Subscription] Active subscription query result:', {
      userId,
      count: result.length,
      hasSubscription: !!result[0],
      subscription: result[0]
    });

    return result[0] || null;
  } catch (error) {
    console.error(`[Subscription] Error fetching subscription for userId: ${userId}`, error);
    return null;
  }
}

/**
 * Check if user has an active subscription.
 * Returns the subscription object if status is 'active' or 'trialing', otherwise null.
 */
export async function hasActiveSubscription(userId: string) {
  const subscription = await getUserSubscription(userId);
  if (subscription?.status === 'active' || subscription?.status === 'trialing') {
    return subscription;
  }
  return null;
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

