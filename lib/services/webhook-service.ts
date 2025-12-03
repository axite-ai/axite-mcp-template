/**
 * Webhook Service
 *
 * Handles Plaid webhooks for token expiration, item errors, and other events.
 * Provides webhook verification and event processing.
 */

import crypto from 'crypto';
import { jwtVerify, decodeJwt, importJWK } from 'jose';
import { db } from '@/lib/db';
import { plaidWebhooks, plaidItems } from '@/lib/db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { logger, LoggerService, AuditEventType } from './logger-service';
import { UserService } from './user-service';
import { syncTransactionsForItem, plaidClient } from './plaid-service';
import { isProductionDeployment } from '@/lib/utils/env-validation';

/**
 * Plaid webhook payload structure
 */
export interface PlaidWebhook {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_code: string;
    error_message: string;
    error_type: string;
    display_message?: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
  [key: string]: unknown;
}

export interface WebhookRecord {
  id: string;
  itemId: string | null;
  userId: string | null;
  webhookType: string;
  webhookCode: string;
  errorCode: string | null;
  payload: unknown;
  processed: boolean;
  receivedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
}

/**
 * Webhook Service for handling Plaid events
 */
export class WebhookService {
  /**
   * Verify webhook signature from Plaid using JWT verification
   *
   * Plaid signs webhooks with a JWT in the `Plaid-Verification` header.
   * This method:
   * 1. Decodes the JWT to extract the key ID (kid)
   * 2. Fetches the public JWK from Plaid's API
   * 3. Verifies the JWT signature
   * 4. Validates the request body hash matches the JWT claim
   *
   * @param body - Raw request body string
   * @param signedJwt - JWT from Plaid-Verification header
   * @returns Promise<boolean> - true if signature is valid
   */
  public static async verifyWebhookSignature(
    body: string,
    signedJwt: string | null
  ): Promise<boolean> {
    const env = isProductionDeployment() ? 'production' : 'development';

    // No signature provided
    if (!signedJwt) {
      if (env === 'production') {
        logger.error('[Webhook] No Plaid-Verification header provided in production');
        return false;
      } else {
        // In sandbox/development, webhooks may not always be signed
        logger.warn('[Webhook] No Plaid-Verification header (sandbox mode - allowing unsigned webhooks)');
        return true;
      }
    }

    try {
      // Step 1: Decode JWT header to extract key ID (kid)
      const decodedJwt = decodeJwt(signedJwt);
      const header = JSON.parse(
        Buffer.from(signedJwt.split('.')[0], 'base64').toString()
      );

      const kid = header.kid;
      const alg = header.alg;

      if (!kid) {
        logger.error('[Webhook] JWT missing kid (key ID) in header');
        return false;
      }

      if (alg !== 'ES256') {
        logger.error('[Webhook] JWT algorithm is not ES256', { alg });
        return false;
      }

      logger.debug('[Webhook] Decoded JWT header', { kid, alg });

      // Step 2: Fetch public JWK from Plaid
      const keyResponse = await plaidClient.webhookVerificationKeyGet({
        key_id: kid,
      });

      const jwk = keyResponse.data.key;
      logger.debug('[Webhook] Fetched public JWK from Plaid', {
        kid,
        keyAlg: jwk.alg,
      });

      // Step 3: Import JWK and verify JWT signature
      const publicKey = await importJWK(jwk, alg);
      const { payload } = await jwtVerify(signedJwt, publicKey, {
        algorithms: ['ES256'],
        maxTokenAge: '5 minutes', // Plaid recommends 5 minute max age
      });

      logger.debug('[Webhook] JWT signature verified', {
        iat: payload.iat,
        requestBodySha256: payload.request_body_sha256,
      });

      // Step 4: Verify request body hash matches JWT claim
      const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
      const claimedHash = payload.request_body_sha256 as string;

      if (bodyHash !== claimedHash) {
        logger.error('[Webhook] Request body hash mismatch', {
          computed: bodyHash,
          claimed: claimedHash,
        });
        return false;
      }

      logger.info('[Webhook] Signature verification successful', { kid });
      return true;
    } catch (error) {
      // JWT verification errors
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          logger.error('[Webhook] JWT expired (max age: 5 minutes)');
        } else if (error.message.includes('signature')) {
          logger.error('[Webhook] JWT signature verification failed', {
            error: error.message,
          });
        } else {
          logger.error('[Webhook] JWT verification error', {
            error: error.message,
          });
        }
      } else {
        logger.error('[Webhook] Unknown verification error', { error });
      }

      // In production, reject invalid signatures
      if (env === 'production') {
        return false;
      }

      // In development/sandbox, log but allow (webhooks may not be signed)
      logger.warn('[Webhook] Verification failed but allowing in development mode');
      return true;
    }
  }

  /**
   * Store webhook in database for audit and processing
   *
   * NOTE: We do NOT dedupe webhooks by type/code because Plaid legitimately
   * sends the same webhook type multiple times (e.g., SYNC_UPDATES_AVAILABLE
   * fires every time transactions update). Deduping by type/code would break
   * transaction syncing after the first event each day.
   *
   * Plaid handles retry logic on their end. If we receive a webhook, we should
   * process it. Database constraints (not application logic) prevent true duplicates.
   */
  public static async storeWebhook(webhook: PlaidWebhook, userId?: string): Promise<string> {
    // Simply store the webhook - no deduplication
    // If Plaid retries the exact same webhook, it's because we didn't respond with 200 OK
    // and they want us to process it again
    const [result] = await db
      .insert(plaidWebhooks)
      .values({
        webhookType: webhook.webhook_type,
        webhookCode: webhook.webhook_code,
        itemId: webhook.item_id,
        errorCode: webhook.error?.error_code || null,
        payload: webhook as any,
        userId: userId || null,
      })
      .returning({ id: plaidWebhooks.id });

    const webhookId = result.id;

    // Log to audit trail
    await LoggerService.logWebhook(
      webhook.webhook_type,
      webhook.webhook_code,
      webhook.item_id,
      userId
    );

    return webhookId;
  }

  /**
   * Mark webhook as processed
   */
  public static async markWebhookProcessed(webhookId: string): Promise<void> {
    await db
      .update(plaidWebhooks)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(plaidWebhooks.id, webhookId));
  }

  /**
   * Process a Plaid webhook event
   */
  public static async processWebhook(webhook: PlaidWebhook): Promise<void> {
    logger.info('[Webhook] Processing webhook', {
      type: webhook.webhook_type,
      code: webhook.webhook_code,
      itemId: webhook.item_id,
    });

    // Find the user who owns this item
    const userId = await this.findUserByItemId(webhook.item_id);

    // Store webhook for audit trail
    const webhookId = await this.storeWebhook(webhook, userId);

    if (!webhookId) {
      logger.error('[Webhook] Failed to store webhook');
      return;
    }

    try {
      // Route to appropriate handler based on webhook type
      switch (webhook.webhook_type) {
        case 'ITEM':
          await this.handleItemWebhook(webhook, userId);
          break;

        case 'TRANSACTIONS':
          await this.handleTransactionsWebhook(webhook, userId);
          break;

        case 'AUTH':
          await this.handleAuthWebhook(webhook, userId);
          break;

        case 'ASSETS':
        case 'INCOME':
        case 'LIABILITIES':
          logger.info(`[Webhook] ${webhook.webhook_type} webhook received, no action needed`);
          break;

        default:
          logger.warn('[Webhook] Unknown webhook type', {
            type: webhook.webhook_type,
            code: webhook.webhook_code,
          });
      }

      // Mark as processed
      await this.markWebhookProcessed(webhookId);
    } catch (error) {
      logger.error('[Webhook] Processing failed', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update webhook with error info
      await db
        .update(plaidWebhooks)
        .set({
          processingError: { error: error instanceof Error ? error.message : 'Unknown error' },
          retryCount: sql`${plaidWebhooks.retryCount} + 1`,
        })
        .where(eq(plaidWebhooks.id, webhookId));

      throw error;
    }
  }

  /**
   * Handle ITEM webhooks (errors, login required, etc.)
   *
   * Note: Plaid does NOT send an ITEM_READY webhook. Items are ready immediately
   * after public token exchange. See: https://plaid.com/docs/api/items/#webhooks
   */
  private static async handleItemWebhook(webhook: PlaidWebhook, userId?: string): Promise<void> {
    switch (webhook.webhook_code) {
      case 'ERROR':
        // Item has an error (often means login required)
        if (userId && webhook.error) {
          await db
            .update(plaidItems)
            .set({
              status: 'error',
              errorCode: webhook.error.error_code,
              errorMessage: webhook.error.error_message,
              lastWebhookAt: new Date(),
            })
            .where(eq(plaidItems.itemId, webhook.item_id));

          logger.warn('[Webhook] Item error detected', {
            userId,
            itemId: webhook.item_id,
            errorCode: webhook.error.error_code,
            errorMessage: webhook.error.error_message,
          });

          // Log security audit
          await LoggerService.audit({
            userId,
            eventType: AuditEventType.ITEM_ERROR,
            eventData: {
              itemId: webhook.item_id,
              errorCode: webhook.error.error_code,
              errorType: webhook.error.error_type,
            },
            success: false,
            errorMessage: webhook.error.error_message,
          });
        }
        break;

      case 'PENDING_EXPIRATION':
        // Access token will expire soon (7 days warning)
        logger.warn('[Webhook] Item access token expiring soon', {
          userId,
          itemId: webhook.item_id,
          consentExpirationTime: webhook.consent_expiration_time,
        });
        // TODO: Notify user to relink
        break;

      case 'USER_PERMISSION_REVOKED':
        // User revoked access at their bank - IMMEDIATE revocation
        if (userId) {
          await db
            .update(plaidItems)
            .set({
              status: 'revoked',
              lastWebhookAt: new Date(),
            })
            .where(eq(plaidItems.itemId, webhook.item_id));

          logger.info('[Webhook] User revoked item permissions', {
            userId,
            itemId: webhook.item_id,
          });

          await LoggerService.audit({
            userId,
            eventType: AuditEventType.ITEM_DISCONNECTED,
            eventData: { itemId: webhook.item_id, reason: 'user_revoked' },
            success: true,
          });
        }
        break;

      case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
        // Plaid acknowledged item removal (sent after /item/remove API call)
        if (userId) {
          await db
            .update(plaidItems)
            .set({
              status: 'deleted',
              deletedAt: new Date(),
              lastWebhookAt: new Date(),
            })
            .where(eq(plaidItems.itemId, webhook.item_id));

          logger.info('[Webhook] Item deletion confirmed', {
            userId,
            itemId: webhook.item_id,
          });

          await LoggerService.audit({
            userId,
            eventType: AuditEventType.ITEM_DISCONNECTED,
            eventData: { itemId: webhook.item_id, reason: 'deleted' },
            success: true,
          });
        } else {
          logger.info('[Webhook] Webhook URL update acknowledged (non-item event)');
        }
        break;

      default:
        logger.info(`[Webhook] ITEM.${webhook.webhook_code} received`);
    }
  }

  /**
   * Handle TRANSACTIONS webhooks (new transactions available)
   */
  private static async handleTransactionsWebhook(
    webhook: PlaidWebhook,
    userId?: string
  ): Promise<void> {
    switch (webhook.webhook_code) {
      case 'SYNC_UPDATES_AVAILABLE':
        logger.info('[Webhook] SYNC_UPDATES_AVAILABLE received', {
          userId,
          itemId: webhook.item_id,
        });
        try {
          await syncTransactionsForItem(webhook.item_id);
          logger.info(`[Webhook] Successfully synced transactions for item ${webhook.item_id}`);
        } catch (error) {
          logger.error(`[Webhook] Error syncing transactions for item ${webhook.item_id}`, { error });
        }
        break;

      case 'INITIAL_UPDATE':
        // Initial transaction pull completed
        logger.info('[Webhook] Initial transaction pull completed', {
          userId,
          itemId: webhook.item_id,
        });
        break;

      case 'HISTORICAL_UPDATE':
        // Historical transaction pull completed
        logger.info('[Webhook] Historical transaction pull completed', {
          userId,
          itemId: webhook.item_id,
        });
        break;

      case 'TRANSACTIONS_REMOVED':
        // Transactions were removed (usually corrections)
        logger.info('[Webhook] Transactions removed', {
          userId,
          itemId: webhook.item_id,
          removedTransactions: webhook.removed_transactions,
        });
        break;

      default:
        logger.info(`[Webhook] TRANSACTIONS.${webhook.webhook_code} received`);
    }
  }

  /**
   * Handle AUTH webhooks (verification status changes)
   */
  private static async handleAuthWebhook(webhook: PlaidWebhook, userId?: string): Promise<void> {
    switch (webhook.webhook_code) {
      case 'AUTOMATICALLY_VERIFIED':
        logger.info('[Webhook] Account automatically verified', {
          userId,
          itemId: webhook.item_id,
        });
        break;

      case 'VERIFICATION_EXPIRED':
        logger.warn('[Webhook] Account verification expired', {
          userId,
          itemId: webhook.item_id,
        });
        break;

      default:
        logger.info(`[Webhook] AUTH.${webhook.webhook_code} received`);
    }
  }

  /**
   * Find user by Plaid item ID
   */
  private static async findUserByItemId(itemId: string): Promise<string | undefined> {
    try {
      const result = await db
        .select({ userId: plaidItems.userId })
        .from(plaidItems)
        .where(eq(plaidItems.itemId, itemId))
        .limit(1);

      return result[0]?.userId;
    } catch (error) {
      logger.error('[Webhook] Failed to find user by item ID', {
        itemId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Get unprocessed webhooks (for batch processing)
   */
  public static async getUnprocessedWebhooks(limit: number = 100): Promise<WebhookRecord[]> {
    const result = await db
      .select()
      .from(plaidWebhooks)
      .where(eq(plaidWebhooks.processed, false))
      .orderBy(plaidWebhooks.receivedAt)
      .limit(limit);

    return result as WebhookRecord[];
  }

  /**
   * Get webhook history for an item
   */
  public static async getItemWebhookHistory(itemId: string, limit: number = 50): Promise<WebhookRecord[]> {
    const result = await db
      .select()
      .from(plaidWebhooks)
      .where(eq(plaidWebhooks.itemId, itemId))
      .orderBy(desc(plaidWebhooks.receivedAt))
      .limit(limit);

    return result as WebhookRecord[];
  }
}
