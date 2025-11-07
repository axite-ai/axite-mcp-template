/**
 * Webhook Service
 *
 * Handles Plaid webhooks for token expiration, item errors, and other events.
 * Provides webhook verification and event processing.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { logger, LoggerService, AuditEventType } from './logger-service';
import { UserService } from './user-service';

// Database pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'askmymoney',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

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
  item_id: string;
  webhook_type: string;
  webhook_code: string;
  payload: Record<string, unknown>;
  processed: boolean;
  received_at: Date;
  processed_at?: Date;
}

/**
 * Webhook Service for handling Plaid events
 */
export class WebhookService {
  /**
   * Verify webhook signature from Plaid
   *
   * @param body - Raw request body
   * @param signature - Plaid-Verification header
   * @returns true if signature is valid
   */
  public static verifyWebhookSignature(body: string, signature: string): boolean {
    // Plaid uses JWT for webhook verification
    // For production, implement full JWT verification
    // For now, we'll implement a simple HMAC verification if PLAID_WEBHOOK_SECRET is set

    const webhookSecret = process.env.PLAID_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.warn('[Webhook] PLAID_WEBHOOK_SECRET not set, skipping verification');
      return true; // Allow in development
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('[Webhook] Signature verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Store webhook in database for audit and processing
   */
  public static async storeWebhook(webhook: PlaidWebhook, userId?: string): Promise<string> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO plaid_webhooks (webhook_type, webhook_code, item_id, error_code, payload, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          webhook.webhook_type,
          webhook.webhook_code,
          webhook.item_id,
          webhook.error?.error_code || null,
          JSON.stringify(webhook),
          userId || null,
        ]
      );

      const webhookId = result.rows[0].id;

      // Log to audit trail
      await LoggerService.logWebhook(
        webhook.webhook_type,
        webhook.webhook_code,
        webhook.item_id,
        userId
      );

      return webhookId;
    } finally {
      client.release();
    }
  }

  /**
   * Mark webhook as processed
   */
  public static async markWebhookProcessed(webhookId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `UPDATE plaid_webhooks SET processed = true, processed_at = NOW() WHERE id = $1`,
        [webhookId]
      );
    } finally {
      client.release();
    }
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

    // Store webhook
    const webhookId = await this.storeWebhook(webhook, userId);

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
      throw error;
    }
  }

  /**
   * Handle ITEM webhooks (errors, login required, etc.)
   */
  private static async handleItemWebhook(webhook: PlaidWebhook, userId?: string): Promise<void> {
    switch (webhook.webhook_code) {
      case 'ERROR':
        // Item has an error (often means login required)
        if (userId && webhook.error) {
          await UserService.markItemError(
            userId,
            webhook.item_id,
            webhook.error.error_code
          );

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
        break;

      case 'USER_PERMISSION_REVOKED':
        // User revoked access at their bank
        if (userId) {
          await UserService.revokeItem(userId, webhook.item_id);

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
        // Plaid acknowledged webhook URL update
        logger.info('[Webhook] Webhook URL update acknowledged');
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
      case 'DEFAULT_UPDATE':
        // New transactions available
        logger.info('[Webhook] New transactions available', {
          userId,
          itemId: webhook.item_id,
          newTransactions: webhook.new_transactions,
        });

        // Update last synced timestamp
        if (userId) {
          await UserService.updateLastSynced(userId, webhook.item_id);
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
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT user_id FROM plaid_items WHERE item_id = $1 LIMIT 1`,
        [itemId]
      );

      return result.rows[0]?.user_id;
    } catch (error) {
      logger.error('[Webhook] Failed to find user by item ID', {
        itemId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    } finally {
      client.release();
    }
  }

  /**
   * Get unprocessed webhooks (for batch processing)
   */
  public static async getUnprocessedWebhooks(limit: number = 100): Promise<WebhookRecord[]> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM plaid_webhooks WHERE processed = false ORDER BY received_at ASC LIMIT $1`,
        [limit]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get webhook history for an item
   */
  public static async getItemWebhookHistory(itemId: string, limit: number = 50): Promise<WebhookRecord[]> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM plaid_webhooks WHERE item_id = $1 ORDER BY received_at DESC LIMIT $2`,
        [itemId, limit]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}
