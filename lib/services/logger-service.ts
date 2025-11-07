/**
 * Logger Service
 *
 * Structured logging using Winston with environment-aware configuration.
 * Provides security audit logging and performance monitoring.
 */

import winston from 'winston';
import { Pool } from 'pg';

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Create a custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] : ${message} `;
  if (Object.keys(metadata).length > 0) {
    msg += JSON.stringify(metadata, null, 2);
  }
  return msg;
});

// Create Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: {
    service: 'askmymoney-mcp',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport with colors for development
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
    }),

    // File transport for errors
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10485760, // 10MB
            maxFiles: 10,
          }),
        ]
      : []),
  ],
});

// Database pool for audit logging
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
 * Audit log types for security tracking
 */
export enum AuditEventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  TOKEN_CREATED = 'token_created',
  TOKEN_REFRESHED = 'token_refreshed',
  TOKEN_REVOKED = 'token_revoked',
  ITEM_CONNECTED = 'item_connected',
  ITEM_DISCONNECTED = 'item_disconnected',
  ITEM_ERROR = 'item_error',
  ACCOUNT_ACCESSED = 'account_accessed',
  TRANSACTION_ACCESSED = 'transaction_accessed',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  WEBHOOK_RECEIVED = 'webhook_received',
  ENCRYPTION_ERROR = 'encryption_error',
  API_ERROR = 'api_error',
}

export interface AuditLogEntry {
  userId?: string;
  eventType: AuditEventType;
  eventData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLogRecord extends AuditLogEntry {
  id: string;
  created_at: Date;
}

/**
 * Logger Service for structured logging and audit trails
 */
export class LoggerService {
  /**
   * Log a security audit event to the database
   */
  public static async audit(entry: AuditLogEntry): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        `INSERT INTO audit_logs (user_id, event_type, event_data, ip_address, user_agent, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.userId || null,
          entry.eventType,
          JSON.stringify(entry.eventData || {}),
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.success,
          entry.errorMessage || null,
        ]
      );

      // Also log to Winston
      const logData = {
        userId: entry.userId,
        eventType: entry.eventType,
        success: entry.success,
        ...entry.eventData,
      };

      if (entry.success) {
        logger.info(`[AUDIT] ${entry.eventType}`, logData);
      } else {
        logger.warn(`[AUDIT] ${entry.eventType} FAILED`, {
          ...logData,
          error: entry.errorMessage,
        });
      }
    } catch (error) {
      // If audit logging fails, still log to Winston
      logger.error('[AUDIT] Failed to write audit log to database', {
        error: error instanceof Error ? error.message : 'Unknown error',
        entry,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Log a user authentication event
   */
  public static async logAuth(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.audit({
      userId,
      eventType: AuditEventType.USER_LOGIN,
      success,
      ipAddress,
      userAgent,
      errorMessage,
    });
  }

  /**
   * Log a Plaid item connection
   */
  public static async logItemConnected(
    userId: string,
    itemId: string,
    institutionName?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.audit({
      userId,
      eventType: AuditEventType.ITEM_CONNECTED,
      eventData: { itemId, institutionName },
      success: true,
      ipAddress,
    });
  }

  /**
   * Log a Plaid API error
   */
  public static async logPlaidError(
    userId: string | undefined,
    errorCode: string,
    errorMessage: string,
    itemId?: string
  ): Promise<void> {
    await this.audit({
      userId,
      eventType: AuditEventType.API_ERROR,
      eventData: { errorCode, itemId },
      success: false,
      errorMessage,
    });
  }

  /**
   * Log rate limit exceeded
   */
  public static async logRateLimitExceeded(
    identifier: string,
    endpoint: string,
    ipAddress?: string
  ): Promise<void> {
    await this.audit({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      eventData: { identifier, endpoint },
      success: false,
      ipAddress,
      errorMessage: 'Rate limit exceeded',
    });
  }

  /**
   * Log webhook received
   */
  public static async logWebhook(
    webhookType: string,
    webhookCode: string,
    itemId?: string,
    userId?: string
  ): Promise<void> {
    await this.audit({
      userId,
      eventType: AuditEventType.WEBHOOK_RECEIVED,
      eventData: { webhookType, webhookCode, itemId },
      success: true,
    });
  }

  /**
   * Get recent audit logs for a user
   */
  public static async getUserAuditLogs(
    userId: string,
    limit: number = 50
  ): Promise<AuditLogRecord[]> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get failed authentication attempts (for security monitoring)
   */
  public static async getFailedAuthAttempts(
    since: Date = new Date(Date.now() - 3600000), // last hour
    limit: number = 100
  ): Promise<AuditLogRecord[]> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM audit_logs
         WHERE event_type = $1 AND success = false AND created_at > $2
         ORDER BY created_at DESC LIMIT $3`,
        [AuditEventType.USER_LOGIN, since, limit]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}

// Export logger instance for direct use
export { logger as default };
