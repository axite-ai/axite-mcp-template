/**
 * Plan Limits Utility
 *
 * Single source of truth for subscription plan limits.
 * Consolidates limits previously defined in multiple places:
 * - lib/auth/index.ts
 * - app/connect-bank/actions.ts
 * - lib/utils/subscription-helpers.ts
 */

export interface PlanLimits {
  maxAccounts: number;
  name: string;
  displayName: string;
}

/**
 * Subscription plan limits
 * IMPORTANT: This is the single source of truth for plan limits
 */
export const PLAN_LIMITS = {
  basic: {
    maxAccounts: 3,
    name: 'basic',
    displayName: 'Basic',
  },
  pro: {
    maxAccounts: 10,
    name: 'pro',
    displayName: 'Pro',
  },
  enterprise: {
    maxAccounts: Infinity,
    name: 'enterprise',
    displayName: 'Enterprise',
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

/**
 * Get maximum accounts allowed for a plan
 *
 * @param planName - The plan name (basic, pro, enterprise) or null
 * @returns Maximum number of accounts allowed, or null if no valid plan
 */
export function getMaxAccountsForPlan(planName: string | null): number | null {
  if (!planName) return null;
  const plan = PLAN_LIMITS[planName as PlanName];
  return plan?.maxAccounts ?? null;
}

/**
 * Get plan metadata
 *
 * @param planName - The plan name (basic, pro, enterprise) or null
 * @returns Plan limits and metadata, or null if no valid plan
 */
export function getPlanMetadata(planName: string | null): PlanLimits | null {
  if (!planName) return null;
  const plan = PLAN_LIMITS[planName as PlanName];
  return plan ?? null;
}

/**
 * Check if a plan allows a specific number of accounts
 *
 * @param planName - The plan name or null
 * @param accountCount - Current number of accounts
 * @returns true if under limit, false if no plan or at/over limit
 */
export function isWithinAccountLimit(
  planName: string | null,
  accountCount: number
): boolean {
  const maxAccounts = getMaxAccountsForPlan(planName);
  if (maxAccounts === null) return false;
  return accountCount < maxAccounts;
}

/**
 * Get recommended plan upgrade based on current account count
 *
 * @param currentCount - Current number of accounts
 * @returns Recommended plan name
 */
export function getRecommendedPlan(currentCount: number): PlanName {
  if (currentCount <= PLAN_LIMITS.basic.maxAccounts) {
    return 'basic';
  } else if (currentCount <= PLAN_LIMITS.pro.maxAccounts) {
    return 'pro';
  }
  return 'enterprise';
}

/**
 * Get all plan limits (for display in pricing tables, etc.)
 */
export function getAllPlanLimits(): Record<PlanName, PlanLimits> {
  return PLAN_LIMITS;
}

/**
 * Format account limit for display
 * Handles Infinity and null gracefully
 *
 * @param maxAccounts - Maximum accounts for plan or null
 * @returns Formatted string
 */
export function formatAccountLimit(maxAccounts: number | null): string {
  if (maxAccounts === null) return 'None';
  return maxAccounts === Infinity ? 'Unlimited' : String(maxAccounts);
}
