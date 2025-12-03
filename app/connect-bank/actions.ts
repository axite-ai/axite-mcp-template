'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user, subscription, passkey } from '@/lib/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { headers, cookies } from 'next/headers';
import { hasActiveSubscription } from '@/lib/utils/subscription-helpers';
import { createLinkToken, exchangePublicToken, plaidClient } from '@/lib/services/plaid-service';
import { UserService, type PlaidItem } from '@/lib/services/user-service';
import { ItemDeletionService } from '@/lib/services/item-deletion-service';
import { getMaxAccountsForPlan, formatAccountLimit } from '@/lib/utils/plan-limits';

type LinkTokenResult =
  | { success: true; linkToken: string; expiration: string }
  | { success: false; error: string };

type ExchangeTokenResult =
  | { success: true; itemId: string; institutionName: string | null | undefined }
  | { success: false; error: string };

type PlanLimitResult =
  | { success: true; limitReached: boolean; itemCount: number; maxAccounts: number }
  | { success: false; error: string };

type PlaidMetadata = {
  institution?: {
    institution_id?: string | null;
    name?: string | null;
  } | null;
  accounts?: Array<{
    id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
  }>;
};

export const createPlaidLinkToken = async (
  mcpToken?: string,
  itemId?: string
): Promise<LinkTokenResult> => {
  try {
    // Check 1: Authentication
    const headersList = await headers();

    // If token provided (from popup URL), create headers with it
    const authHeaders = new Headers(headersList);
    if (mcpToken) {
      console.log('[Server Action] Using MCP token from URL parameter');
      authHeaders.set('Authorization', `Bearer ${mcpToken}`);
    }

    console.log('[Server Action] Authorization header:', authHeaders.get('authorization') ? 'present' : 'missing');

    // Check for MCP session (required - users authenticate via ChatGPT OAuth)
    const mcpSession = await auth.api.getMcpSession({ headers: authHeaders });
    console.log('[Server Action] MCP Session result:', {
      hasSession: !!mcpSession,
      userId: mcpSession?.userId,
    });

    if (!mcpSession?.userId) {
      return {
        success: false,
        error: 'Authentication required. Please sign in first through ChatGPT.',
      };
    }

    const userId = mcpSession.userId;

    // Check 2: Security (Passkey) Enabled (CRITICAL SECURITY CHECK)
    const passkeys = await db.select().from(passkey).where(eq(passkey.userId, userId)).limit(1);
    const hasPasskey = passkeys.length > 0;

    if (!hasPasskey) {
      console.log('[Server Action] Passkey not enabled for user:', userId);
      return {
        success: false,
        error: 'Security setup required. Please set up a passkey in your account settings.',
      };
    }

    // Check 3: Active Subscription
    const hasSubscription = await hasActiveSubscription(userId);
    if (!hasSubscription) {
      return {
        success: false,
        error: 'Active subscription required. Please subscribe first.',
      };
    }

    // If itemId provided, we're in update mode (re-authentication)
    if (itemId) {
      console.log('[Server Action] Creating link token for update mode, itemId:', itemId);

      // Get the item's access token
      const items = await UserService.getUserPlaidItems(userId);
      const item = items.find((i) => i.id === itemId);

      if (!item) {
        return {
          success: false,
          error: 'Item not found or access denied.',
        };
      }

      // Create link token for update mode
      const linkTokenData = await createLinkToken(userId, {
        accessToken: item.accessToken,
      });

      return {
        success: true,
        linkToken: linkTokenData.link_token,
        expiration: linkTokenData.expiration,
      };
    }

    // Check 3: Account limits (based on subscription plan)
    // CRITICAL: Use countUserItems to include pending/error items
    // This prevents users from bypassing limits by starting multiple Link flows
    // before ITEM_READY webhooks fire
    const itemCount = await UserService.countUserItems(userId);

    // Get user's subscription to check limits
    const userSubscriptions = await db
      .select({ plan: subscription.plan })
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, userId),
          inArray(subscription.status, ['active', 'trialing'])
        )
      )
      .orderBy(desc(subscription.periodStart))
      .limit(1);

    const userSubscription = userSubscriptions[0];
    const plan = userSubscription?.plan || null;

    // Use consolidated plan limits
    const maxAccounts = getMaxAccountsForPlan(plan);

    // If no subscription, reject immediately
    if (!plan || maxAccounts === null) {
      return {
        success: false,
        error: "Active subscription required to connect financial accounts",
      };
    }

    if (itemCount >= maxAccounts) {
      // Check if user can delete an item to make room
      const deletionInfo = await ItemDeletionService.getDeletionInfo(userId);

      if (!deletionInfo.canDelete) {
        return {
          success: false,
          error: `Account limit reached. You can delete another financial account in ${deletionInfo.daysUntilNext} days, or upgrade your plan now.`,
        };
      }

      return {
        success: false,
        error: `Account limit reached. Your plan allows ${maxAccounts} financial account(s). Please upgrade or remove an existing connection.`,
      };
    }

    // All checks passed - create link token
    const linkTokenData = await createLinkToken(userId);

    return {
      success: true,
      linkToken: linkTokenData.link_token,
      expiration: linkTokenData.expiration,
    };
  } catch (error) {
    console.error('[Server Action] createPlaidLinkToken error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize bank connection',
    };
  }
};

export const exchangePlaidPublicToken = async (
  publicToken: string,
  metadata: PlaidMetadata,
  mcpToken?: string
): Promise<ExchangeTokenResult> => {
  try {
    // Check 1: Authentication
    const headersList = await headers();

    // If token provided (from popup URL), create headers with it
    const authHeaders = new Headers(headersList);
    if (mcpToken) {
      console.log('[Server Action] Using MCP token from URL parameter');
      authHeaders.set('Authorization', `Bearer ${mcpToken}`);
    }

    // Check for MCP session (required - users authenticate via ChatGPT OAuth)
    const mcpSession = await auth.api.getMcpSession({ headers: authHeaders });
    console.log('[Server Action] MCP Session result:', {
      hasSession: !!mcpSession,
      userId: mcpSession?.userId,
    });

    if (!mcpSession?.userId) {
      return {
        success: false,
        error: 'Authentication required. Please sign in first through ChatGPT.',
      };
    }

    const userId = mcpSession.userId;

    // Check 2: Active Subscription
    const hasSubscription = await hasActiveSubscription(userId);
    if (!hasSubscription) {
      return {
        success: false,
        error: 'Active subscription required. Please subscribe first.',
      };
    }

    if (!publicToken) {
      return {
        success: false,
        error: 'Missing public token',
      };
    }

    // Extract institution info from metadata
    const institutionId = metadata?.institution?.institution_id;
    const institutionName = metadata?.institution?.name;

    // NOTE: We show connected items in the UI, so users can see duplicates
    // No need for programmatic duplicate detection - trust the user

    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // Save the Plaid item to database with status 'pending'
    // Webhook ITEM_READY will update status to 'active'
    await UserService.savePlaidItem(
      userId,
      itemId,
      accessToken,
      institutionId || undefined,
      institutionName || undefined
    );

    // CRITICAL: Call /transactions/sync immediately (even if no data yet)
    // This ensures Plaid knows to send future SYNC_UPDATES_AVAILABLE webhooks
    try {
      await plaidClient.transactionsSync({
        access_token: accessToken,
        // cursor: undefined on first call
      });
      console.log('[Server Action] Initial transaction sync triggered for item', itemId);
    } catch (error) {
      console.error('[Server Action] Failed to trigger initial sync for item', itemId, error);
      // Don't fail the exchange - webhook ITEM_READY will retry
    }

    console.log('[Server Action] Successfully connected Plaid item', {
      userId,
      itemId,
      institutionName,
    });

    // Send email notification
    try {
      const { EmailService } = await import("@/lib/services/email-service");
      const { plaidItems } = await import("@/lib/db/schema");
      const { count } = await import("drizzle-orm");

      // Get user details and count of connected accounts
      const [userDetails] = await db
        .select({ email: user.email, name: user.name })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const [itemCount] = await db
        .select({ count: count() })
        .from(plaidItems)
        .where(
          and(
            eq(plaidItems.userId, userId),
            eq(plaidItems.status, 'active')
          )
        );

      const accountCount = Number(itemCount?.count || 0);
      const isFirstAccount = accountCount === 1;

      if (userDetails?.email && institutionName) {
        const userName = userDetails.name || "there";

        await EmailService.sendBankConnectionConfirmation(
          userDetails.email,
          userName,
          institutionName,
          isFirstAccount
        );

        console.log('[Server Action] Bank connection email sent to', userDetails.email);
      }
    } catch (error) {
      console.error('[Server Action] Failed to send bank connection email:', error);
      // Don't throw - email failure shouldn't block connection
    }

    return {
      success: true,
      itemId,
      institutionName,
    };
  } catch (error) {
    console.error('[Server Action] exchangePlaidPublicToken error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect bank account',
    };
  }
};

/**
 * Check if user has reached their plan limit
 * Used for polling during Multi-Item Link sessions
 */
export const checkPlanLimit = async (mcpToken?: string): Promise<PlanLimitResult> => {
  try {
    // Check authentication
    const headersList = await headers();

    // If token provided (from popup URL), create headers with it
    const authHeaders = new Headers(headersList);
    if (mcpToken) {
      authHeaders.set('Authorization', `Bearer ${mcpToken}`);
    }

    // Check for MCP session
    const mcpSession = await auth.api.getMcpSession({ headers: authHeaders });

    if (!mcpSession?.userId) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    const userId = mcpSession.userId;

    // Get current item count
    const itemCount = await UserService.countUserItems(userId);

    // Get user's plan
    const userSubscriptions = await db
      .select({ plan: subscription.plan })
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, userId),
          inArray(subscription.status, ['active', 'trialing'])
        )
      )
      .orderBy(desc(subscription.periodStart))
      .limit(1);

    const userSubscription = userSubscriptions[0];
    const plan = userSubscription?.plan || null;
    const maxAccounts = getMaxAccountsForPlan(plan);

    // If no subscription, return error
    if (!plan || maxAccounts === null) {
      return {
        success: false,
        error: "Active subscription required",
      };
    }

    return {
      success: true,
      limitReached: itemCount >= maxAccounts,
      itemCount,
      maxAccounts,
    };
  } catch (error) {
    console.error('[Server Action] checkPlanLimit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check plan limit',
    };
  }
};

/**
 * Get list of connected items for account management UI
 * Returns items with proper structure for frontend display
 */
export const getConnectedItems = async (mcpToken?: string) => {
  try {
    const headersList = await headers();
    const authHeaders = new Headers(headersList);
    if (mcpToken) {
      authHeaders.set('Authorization', `Bearer ${mcpToken}`);
    }

    const mcpSession = await auth.api.getMcpSession({ headers: authHeaders });
    if (!mcpSession?.userId) {
      return {
        success: false as const,
        error: 'Authentication required',
      };
    }

    const userId = mcpSession.userId;

    // Get all items from database (activeOnly = false to show pending/error items)
    const items = await UserService.getUserPlaidItems(userId, false);

    // Get deletion rate limit info
    const deletionInfo = await ItemDeletionService.getDeletionInfo(userId);

    // Get plan info for limits
    const userSubscriptions = await db
      .select({ plan: subscription.plan })
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, userId),
          inArray(subscription.status, ['active', 'trialing'])
        )
      )
      .orderBy(desc(subscription.periodStart))
      .limit(1);

    const plan = userSubscriptions[0]?.plan || null;
    const maxAccounts = getMaxAccountsForPlan(plan);

    // If no subscription, return error
    if (!plan || maxAccounts === null) {
      return {
        success: false as const,
        error: "Active subscription required to view connected items",
      };
    }

    return {
      success: true as const,
      items: items.map((item: PlaidItem) => ({
        id: item.id,
        itemId: item.itemId,
        institutionId: item.institutionId,
        institutionName: item.institutionName,
        status: item.status,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt?.toISOString(),
      })),
      deletionInfo,
      planInfo: {
        plan,
        current: items.length,
        max: maxAccounts,
        maxFormatted: formatAccountLimit(maxAccounts),
      },
    };
  } catch (error) {
    console.error('[Server Action] getConnectedItems error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to get connected items',
    };
  }
};

/**
 * Remove/delete a Plaid item with proper cleanup
 * Uses ItemDeletionService which handles rate limits and Plaid API calls
 */
export const removeItem = async (itemId: string, mcpToken?: string) => {
  try {
    const headersList = await headers();
    const authHeaders = new Headers(headersList);
    if (mcpToken) {
      authHeaders.set('Authorization', `Bearer ${mcpToken}`);
    }

    const mcpSession = await auth.api.getMcpSession({ headers: authHeaders });
    if (!mcpSession?.userId) {
      return {
        success: false as const,
        error: 'Authentication required',
      };
    }

    const userId = mcpSession.userId;

    // Delete with rate limit check (calls /item/remove and soft deletes in DB)
    await ItemDeletionService.deleteItemWithRateLimit(userId, itemId);

    return {
      success: true as const,
    };
  } catch (error) {
    console.error('[Server Action] removeItem error:', error);

    // Handle rate limit errors with helpful info
    if (error instanceof Error && error.message.includes('rate limit')) {
      try {
        const headersList = await headers();
        const authHeaders = new Headers(headersList);
        if (mcpToken) {
          authHeaders.set('Authorization', `Bearer ${mcpToken}`);
        }
        const mcpSession = await auth.api.getMcpSession({ headers: authHeaders });

        if (mcpSession?.userId) {
          const info = await ItemDeletionService.getDeletionInfo(mcpSession.userId);
          return {
            success: false as const,
            error: error.message,
            daysUntilNext: info.daysUntilNext,
          };
        }
      } catch {
        // Fall through to generic error
      }
    }

    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to remove item',
    };
  }
};
