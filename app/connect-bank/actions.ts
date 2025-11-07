'use server';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { hasActiveSubscription } from '@/lib/utils/subscription-helpers';
import { createLinkToken, exchangePublicToken } from '@/lib/services/plaid-service';
import { UserService } from '@/lib/services/user-service';
import type { Pool } from 'pg';

type LinkTokenResult =
  | { success: true; linkToken: string; expiration: string }
  | { success: false; error: string };

type ExchangeTokenResult =
  | { success: true; itemId: string; institutionName: string | null | undefined }
  | { success: false; error: string };

type PlaidMetadata = {
  institution?: {
    institution_id?: string | null;
    name?: string | null;
  } | null;
};

export const createPlaidLinkToken = async (): Promise<LinkTokenResult> => {
  try {
    // Check 1: Authentication
    const headersList = await headers();

    // Extract session token from cookie
    const cookieHeader = headersList.get('cookie') || '';
    const sessionTokenMatch = cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/);
    const sessionToken = sessionTokenMatch?.[1];

    console.log('[Server Action] Cookie details:', {
      hasCookie: !!cookieHeader,
      hasSessionToken: !!sessionToken,
      sessionTokenPreview: sessionToken?.substring(0, 30),
      fullCookie: cookieHeader.substring(0, 200),
    });

    const session = await auth.api.getSession({
      headers: headersList,
      query: {
        disableCookieCache: true, // Force fresh session check
      },
    });

    console.log('[Server Action] Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      sessionData: session,
    });


    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required. Please sign in first.',
      };
    }

    // Check 2: Active Subscription
    const hasSubscription = await hasActiveSubscription(session.user.id);
    if (!hasSubscription) {
      return {
        success: false,
        error: 'Active subscription required. Please subscribe first.',
      };
    }

    // Check 3: Account limits (based on subscription plan)
    const existingItems = await UserService.getUserPlaidItems(session.user.id, true);

    // Get user's subscription to check limits
    const pool = auth.options.database as Pool;
    const client = await pool.connect();

    try {
      const subResult = await client.query(
        `SELECT s.*, sp.limits
         FROM subscription s
         LEFT JOIN LATERAL (
           SELECT limits FROM unnest(ARRAY[
             '{"name": "basic", "limits": {"maxAccounts": 3}}'::jsonb,
             '{"name": "pro", "limits": {"maxAccounts": 10}}'::jsonb,
             '{"name": "enterprise", "limits": {"maxAccounts": 999999}}'::jsonb
           ]) AS plan
           WHERE plan->>'name' = s.plan
         ) sp ON true
         WHERE s.user_id = $1
         AND s.status IN ('active', 'trialing')
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [session.user.id]
      );

      const subscription = subResult.rows[0];
      const maxAccounts = subscription?.limits?.maxAccounts ?? 3;

      if (existingItems.length >= maxAccounts) {
        return {
          success: false,
          error: `Account limit reached. Your plan allows ${maxAccounts} bank account(s). Please upgrade or remove an existing connection.`,
        };
      }

      // All checks passed - create link token
      const linkTokenData = await createLinkToken(session.user.id);

      return {
        success: true,
        linkToken: linkTokenData.link_token,
        expiration: linkTokenData.expiration,
      };
    } finally {
      client.release();
    }
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
  metadata: PlaidMetadata
): Promise<ExchangeTokenResult> => {
  try {
    // Check 1: Authentication
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required. Please sign in first.',
      };
    }

    // Check 2: Active Subscription
    const hasSubscription = await hasActiveSubscription(session.user.id);
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

    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // Extract institution info from metadata
    const institutionId = metadata?.institution?.institution_id || undefined;
    const institutionName = metadata?.institution?.name || undefined;

    // Save the Plaid item to database (access token will be encrypted)
    await UserService.savePlaidItem(
      session.user.id,
      itemId,
      accessToken,
      institutionId,
      institutionName
    );

    console.log('[Server Action] Successfully connected Plaid item', {
      userId: session.user.id,
      itemId,
      institutionName,
    });

    // Send email notification
    try {
      const { EmailService } = await import("@/lib/services/email-service");

      // Get user details and count of connected accounts
      const pool = auth.options.database as Pool;
      const client = await pool.connect();

      try {
        const userResult = await client.query(
          'SELECT email, name FROM "user" WHERE id = $1',
          [session.user.id]
        );

        const countResult = await client.query(
          'SELECT COUNT(*) FROM plaid_items WHERE user_id = $1 AND status = $2',
          [session.user.id, 'active']
        );

        const user = userResult.rows[0];
        const accountCount = parseInt(countResult.rows[0]?.count || '0', 10);
        const isFirstAccount = accountCount === 1;

        if (user?.email && institutionName) {
          const userName = user.name || "there";

          await EmailService.sendBankConnectionConfirmation(
            user.email,
            userName,
            institutionName,
            isFirstAccount
          );

          console.log('[Server Action] Bank connection email sent to', user.email);
        }
      } finally {
        client.release();
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
