/**
 * User Service
 *
 * Manages user-to-Plaid item mappings in the database.
 * Links Better Auth users to their connected bank accounts (Plaid items).
 * All Plaid access tokens are encrypted at rest using AES-256-GCM.
 */

import { Pool } from 'pg';
import { EncryptionService } from './encryption-service';

// Reuse the same pool configuration from Better Auth
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

export interface PlaidItem {
  id: string;
  userId: string;
  itemId: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string | null;
  createdAt: Date;
  lastSyncedAt: Date | null;
  status: 'active' | 'error' | 'revoked';
  errorCode: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Service for managing user Plaid items
 */
export class UserService {
  /**
   * Save a Plaid item for a user
   *
   * @param userId - Better Auth user ID
   * @param itemId - Plaid item ID
   * @param accessToken - Plaid access token (will be encrypted before storage)
   * @param institutionId - Optional institution ID
   * @param institutionName - Optional institution name
   */
  public static async savePlaidItem(
    userId: string,
    itemId: string,
    accessToken: string,
    institutionId?: string,
    institutionName?: string
  ): Promise<PlaidItem> {
    const client = await pool.connect();

    try {
      // Encrypt the access token before storing
      const encryptedToken = EncryptionService.encrypt(accessToken);

      const result = await client.query(
        `INSERT INTO plaid_items (user_id, item_id, access_token_encrypted, institution_id, institution_name, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (user_id, item_id)
         DO UPDATE SET
           access_token_encrypted = EXCLUDED.access_token_encrypted,
           institution_id = EXCLUDED.institution_id,
           institution_name = EXCLUDED.institution_name,
           status = 'active',
           last_synced_at = NOW()
         RETURNING *`,
        [userId, itemId, encryptedToken, institutionId || null, institutionName || null]
      );

      // Decrypt the token in the returned object
      const item = result.rows[0];
      item.accessToken = EncryptionService.decrypt(item.access_token_encrypted);
      delete item.access_token_encrypted;

      return item;
    } finally {
      client.release();
    }
  }

  /**
   * Get all Plaid items for a user
   *
   * @param userId - Better Auth user ID
   * @param activeOnly - Only return active items (default: true)
   */
  public static async getUserPlaidItems(
    userId: string,
    activeOnly: boolean = true
  ): Promise<PlaidItem[]> {
    const client = await pool.connect();

    try {
      const query = activeOnly
        ? `SELECT * FROM plaid_items WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`
        : `SELECT * FROM plaid_items WHERE user_id = $1 ORDER BY created_at DESC`;

      const result = await client.query(query, [userId]);

      // Decrypt access tokens
      return result.rows.map(item => {
        if (item.access_token_encrypted) {
          item.accessToken = EncryptionService.decrypt(item.access_token_encrypted);
          delete item.access_token_encrypted;
        } else if (item.access_token) {
          // Fallback for legacy unencrypted tokens (during migration)
          item.accessToken = item.access_token;
        }
        delete item.access_token;
        return item;
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific Plaid item by item ID
   *
   * @param userId - Better Auth user ID (for security)
   * @param itemId - Plaid item ID
   */
  public static async getPlaidItem(
    userId: string,
    itemId: string
  ): Promise<PlaidItem | null> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM plaid_items WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId]
      );

      const item = result.rows[0];
      if (!item) return null;

      // Decrypt access token
      if (item.access_token_encrypted) {
        item.accessToken = EncryptionService.decrypt(item.access_token_encrypted);
        delete item.access_token_encrypted;
      } else if (item.access_token) {
        // Fallback for legacy unencrypted tokens
        item.accessToken = item.access_token;
      }
      delete item.access_token;

      return item;
    } finally {
      client.release();
    }
  }

  /**
   * Get all access tokens for a user's active items
   *
   * Useful for aggregating data across all connected accounts
   */
  public static async getUserAccessTokens(userId: string): Promise<string[]> {
    const items = await this.getUserPlaidItems(userId, true);
    return items.map(item => item.accessToken);
  }

  /**
   * Mark a Plaid item as having an error
   *
   * @param userId - Better Auth user ID
   * @param itemId - Plaid item ID
   * @param errorCode - Plaid error code
   */
  public static async markItemError(
    userId: string,
    itemId: string,
    errorCode: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `UPDATE plaid_items
         SET status = 'error', error_code = $3, last_synced_at = NOW()
         WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId, errorCode]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Mark a Plaid item as revoked (user disconnected)
   *
   * @param userId - Better Auth user ID
   * @param itemId - Plaid item ID
   */
  public static async revokeItem(userId: string, itemId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `UPDATE plaid_items
         SET status = 'revoked', last_synced_at = NOW()
         WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update last synced timestamp for an item
   *
   * Call this after successfully fetching data from Plaid
   */
  public static async updateLastSynced(
    userId: string,
    itemId: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `UPDATE plaid_items
         SET last_synced_at = NOW()
         WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete a Plaid item completely
   *
   * Use sparingly - prefer revokeItem() for soft deletion
   */
  public static async deletePlaidItem(
    userId: string,
    itemId: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `DELETE FROM plaid_items WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId]
      );
    } finally {
      client.release();
    }
  }
}
