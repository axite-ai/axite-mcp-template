import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { plaidLinkSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { WebhookService } from '@/lib/services/webhook-service';
import { exchangePublicToken, plaidClient } from '@/lib/services/plaid-service';
import { UserService } from '@/lib/services/user-service';
import { logger } from '@/lib/services/logger-service';

/**
 * Plaid Webhook Handler
 *
 * Handles webhooks from Plaid for:
 * - Multi-Item Link: SESSION_FINISHED, ITEM_ADD_RESULT
 * - Item events: ITEM.ERROR, ITEM.PENDING_EXPIRATION, etc.
 * - Transaction events: TRANSACTIONS.SYNC_UPDATES_AVAILABLE, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const webhook = JSON.parse(body);

    logger.info('[Plaid Webhook] Received:', {
      type: webhook.webhook_type,
      code: webhook.webhook_code,
    });

    // Verify webhook signature using JWT (REQUIRED in production for security)
    const signedJwt = request.headers.get('plaid-verification');
    const isValid = await WebhookService.verifyWebhookSignature(body, signedJwt);

    if (!isValid) {
      logger.error('[Plaid Webhook] Signature verification failed - rejecting webhook');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Handle Multi-Item Link webhooks
    if (webhook.webhook_type === 'LINK') {
      await handleLinkWebhook(webhook);
      return NextResponse.json({ received: true });
    }

    // Handle other webhook types (Item, Transactions, etc.)
    await WebhookService.processWebhook(webhook);

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('[Plaid Webhook] Error processing webhook:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle LINK webhook events for Multi-Item Link
 */
async function handleLinkWebhook(webhook: any) {
  const { webhook_code, link_session_id, link_token, public_token, public_tokens } = webhook;

  logger.info('[Link Webhook] Processing:', {
    code: webhook_code,
    linkSessionId: link_session_id,
    linkToken: link_token,
  });

  // Find the link session in our database
  const [session] = await db
    .select()
    .from(plaidLinkSessions)
    .where(eq(plaidLinkSessions.linkToken, link_token))
    .limit(1);

  if (!session) {
    // Session not found - log error but return success to prevent Plaid retries
    // This is expected behavior for expired/invalid sessions
    logger.error('[Link Webhook] Session not found for link_token:', {
      linkToken: link_token,
      webhookCode: webhook_code,
      linkSessionId: link_session_id,
    });
    return; // Implicit 200 OK in handleLinkWebhook
  }

  try {
    switch (webhook_code) {
      case 'ITEM_ADD_RESULT':
        // Single item was added during Multi-Item Link session
        await handleItemAddResult(session, public_token, webhook);
        break;

      case 'SESSION_FINISHED':
        // Entire Multi-Item Link session completed
        await handleSessionFinished(session, public_tokens, webhook);
        break;

      case 'HANDOFF':
        // User was redirected to Link from another application
        await db
          .update(plaidLinkSessions)
          .set({
            linkSessionId: link_session_id,
            status: 'active',
          })
          .where(eq(plaidLinkSessions.id, session.id));
        break;

      default:
        logger.debug('[Link Webhook] Unhandled code:', { webhookCode: webhook_code });
    }
  } catch (error) {
    logger.error('[Link Webhook] Error handling webhook:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      sessionId: session.id,
    });

    // Mark session as failed
    await db
      .update(plaidLinkSessions)
      .set({
        status: 'failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      })
      .where(eq(plaidLinkSessions.id, session.id));

    // Don't throw - return 200 OK to prevent Plaid from retrying
    // The session is marked as failed for monitoring
    logger.warn('[Link Webhook] Session marked as failed, webhook acknowledged', { sessionId: session.id });
  }
}

/**
 * Handle individual item add during Multi-Item Link session
 */
async function handleItemAddResult(
  session: any,
  publicToken: string,
  webhook: any
) {
  console.log('[Link Webhook] Processing ITEM_ADD_RESULT for session:', session.id);

  if (!publicToken) {
    console.error('[Link Webhook] No public token in ITEM_ADD_RESULT');
    return;
  }

  try {
    // CRITICAL: Check plan limits before exchanging token
    // This prevents users from bypassing limits by adding multiple items in one session
    const itemCount = await UserService.countUserItems(session.userId);
    const { getMaxAccountsForPlan } = await import('@/lib/utils/plan-limits');
    const { subscription } = await import('@/lib/db/schema');
    const { and, eq, inArray, desc } = await import('drizzle-orm');

    // Get user's plan
    const userSubscriptions = await db
      .select({ plan: subscription.plan })
      .from(subscription)
      .where(
        and(
          eq(subscription.referenceId, session.userId),
          inArray(subscription.status, ['active', 'trialing'])
        )
      )
      .orderBy(desc(subscription.periodStart))
      .limit(1);

    const plan = userSubscriptions[0]?.plan || null;
    const maxAccounts = getMaxAccountsForPlan(plan);

    // If no active subscription, skip processing
    if (!plan || maxAccounts === null) {
      console.warn('[Link Webhook] No active subscription, skipping item add', {
        userId: session.userId,
      });
      return;
    }

    if (itemCount >= maxAccounts) {
      console.warn('[Link Webhook] Plan limit reached, skipping item add', {
        userId: session.userId,
        itemCount,
        maxAccounts,
        plan,
      });
      return; // Skip this item - user at limit
    }

    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    // Extract institution info from webhook metadata if available
    let institutionId = webhook.institution?.institution_id;
    let institutionName = webhook.institution?.name;

    // If institution details missing, fetch from Plaid using /item/get
    // (webhook payloads don't always include institution info)
    if (!institutionId || !institutionName) {
      try {
        console.log('[Link Webhook] Institution details missing, fetching from /item/get');
        const itemResponse = await plaidClient.itemGet({ access_token: accessToken });
        institutionId = itemResponse.data.item.institution_id ?? undefined;
        institutionName = itemResponse.data.item.institution_name ?? undefined;
        console.log('[Link Webhook] Fetched institution details:', { institutionId, institutionName });
      } catch (error) {
        console.error('[Link Webhook] Error fetching institution details from /item/get:', error);
        // Continue without institution details - not critical for item creation
      }
    }

    // Save the Plaid item (status set to 'active' immediately)
    await UserService.savePlaidItem(
      session.userId,
      itemId,
      accessToken,
      institutionId,
      institutionName
    );

    // CRITICAL: Trigger initial transaction sync
    // This ensures Plaid sends future SYNC_UPDATES_AVAILABLE webhooks
    // Items are ready immediately after token exchange - no need to wait for ITEM_READY
    try {
      const { syncTransactionsForItem } = await import('@/lib/services/plaid-service');
      await syncTransactionsForItem(itemId);
      console.log(`[Link Webhook] Initial transaction sync triggered for item ${itemId}`);
    } catch (error) {
      console.error(`[Link Webhook] Failed to trigger initial sync for item ${itemId}`, error);
      // Don't fail the webhook - sync can be retried later
    }

    // Update session with incremented items count
    await db
      .update(plaidLinkSessions)
      .set({
        linkSessionId: webhook.link_session_id,
        status: 'active',
        itemsAdded: (session.itemsAdded || 0) + 1,
        metadata: {
          ...session.metadata,
          lastItemAdded: {
            itemId,
            institutionId,
            institutionName,
            addedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(plaidLinkSessions.id, session.id));

    console.log('[Link Webhook] Successfully added item:', itemId);
  } catch (error) {
    console.error('[Link Webhook] Error processing ITEM_ADD_RESULT:', error);
    throw error;
  }
}

/**
 * Handle session finished event (all items added, user exited Link)
 */
async function handleSessionFinished(
  session: any,
  publicTokens: string[] | undefined,
  webhook: any
) {
  console.log('[Link Webhook] Processing SESSION_FINISHED for session:', session.id);

  const status = webhook.status; // SUCCESS, EXIT, ERROR

  // If session was successful but we haven't processed items via ITEM_ADD_RESULT,
  // process them now
  if (status === 'SUCCESS' && publicTokens && publicTokens.length > 0) {
    console.log('[Link Webhook] Processing public tokens from SESSION_FINISHED');

    for (const publicToken of publicTokens) {
      try {
        // CRITICAL: Check plan limits before each token exchange
        const itemCount = await UserService.countUserItems(session.userId);
        const { getMaxAccountsForPlan } = await import('@/lib/utils/plan-limits');
        const { subscription } = await import('@/lib/db/schema');
        const { and, eq, inArray, desc } = await import('drizzle-orm');

        const userSubscriptions = await db
          .select({ plan: subscription.plan })
          .from(subscription)
          .where(
            and(
              eq(subscription.referenceId, session.userId),
              inArray(subscription.status, ['active', 'trialing'])
            )
          )
          .orderBy(desc(subscription.periodStart))
          .limit(1);

        const plan = userSubscriptions[0]?.plan || null;
        const maxAccounts = getMaxAccountsForPlan(plan);

        // If no active subscription, stop processing
        if (!plan || maxAccounts === null) {
          console.warn('[Link Webhook] No active subscription in SESSION_FINISHED, skipping remaining tokens', {
            userId: session.userId,
          });
          break;
        }

        if (itemCount >= maxAccounts) {
          console.warn('[Link Webhook] Plan limit reached in SESSION_FINISHED, skipping remaining tokens');
          break; // Stop processing tokens - user at limit
        }

        // Only process if we haven't already (check by counting items)
        // This is a safety check in case ITEM_ADD_RESULT webhooks were missed
        const { accessToken, itemId } = await exchangePublicToken(publicToken);

        // Check if item already exists
        const existingItems = await UserService.getUserPlaidItems(session.userId);
        const alreadyExists = existingItems.some(item => item.itemId === itemId);

        if (!alreadyExists) {
          await UserService.savePlaidItem(
            session.userId,
            itemId,
            accessToken,
            undefined,
            undefined
          );
          console.log('[Link Webhook] Added item from SESSION_FINISHED:', itemId);
        }
      } catch (error) {
        console.error('[Link Webhook] Error processing public token:', error);
        // Continue processing other tokens
      }
    }
  }

  // Update session as completed
  // Both SUCCESS and EXIT statuses indicate successful item addition
  // Only ERROR status should mark the session as failed
  await db
    .update(plaidLinkSessions)
    .set({
      linkSessionId: webhook.link_session_id,
      status: status === 'ERROR' ? 'failed' : 'completed',
      publicTokens: publicTokens || [],
      completedAt: new Date(),
      metadata: {
        ...session.metadata,
        sessionStatus: status,
        finishedAt: new Date().toISOString(),
      },
    })
    .where(eq(plaidLinkSessions.id, session.id));

  console.log('[Link Webhook] Session finished with status:', status);
}
