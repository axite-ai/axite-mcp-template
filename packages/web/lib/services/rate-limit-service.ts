/**
 * Rate Limit Service
 *
 * Provides Redis-backed rate limiting with sliding window algorithm.
 * Falls back to in-memory rate limiting if Redis is unavailable.
 */

import { Redis } from 'ioredis';
import { logger } from './logger-service';

// Create Redis client (will be null if Redis is not configured)
let redisClient: Redis | null = null;

try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('error', (error: Error) => {
      logger.error('[Redis] Connection error', { error: error.message });
    });

    redisClient.on('connect', () => {
      logger.info('[Redis] Connected successfully');
    });

    // Connect asynchronously
    redisClient.connect().catch((error: Error) => {
      logger.warn('[Redis] Failed to connect, falling back to in-memory rate limiting', {
        error: error.message,
      });
      redisClient = null;
    });
  } else {
    logger.info('[Redis] REDIS_URL not configured, using in-memory rate limiting');
  }
} catch (error) {
  logger.warn('[Redis] Initialization failed, using in-memory rate limiting', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  redisClient = null;
}

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate Limit Service using Redis or in-memory storage
 */
export class RateLimitService {
  /**
   * Check if a request should be rate limited
   *
   * @param identifier - Unique identifier (IP address, user ID, etc.)
   * @param endpoint - Endpoint being accessed (for separate rate limits)
   * @param config - Rate limit configuration
   * @returns Rate limit result
   */
  public static async checkRateLimit(
    identifier: string,
    endpoint: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${endpoint}:${identifier}`;

    if (redisClient && redisClient.status === 'ready') {
      return this.checkRateLimitRedis(key, config);
    } else {
      return this.checkRateLimitMemory(key, config);
    }
  }

  /**
   * Redis-based rate limiting using sliding window
   */
  private static async checkRateLimitRedis(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    if (!redisClient) {
      throw new Error('Redis client not initialized');
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Use Redis sorted set for sliding window
      const multi = redisClient.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry on the key
      multi.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        throw new Error('Redis multi exec failed');
      }

      // Get count before adding current request
      const count = results[1][1] as number;

      const allowed = count < config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - count - 1);
      const resetAt = now + config.windowMs;

      return { allowed, remaining, resetAt };
    } catch (error) {
      logger.error('[RateLimit] Redis error, falling back to memory', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.checkRateLimitMemory(key, config);
    }
  }

  /**
   * In-memory rate limiting with fixed window
   */
  private static checkRateLimitMemory(
    key: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const now = Date.now();
    const entry = memoryStore.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanupMemoryStore();
    }

    if (!entry || now > entry.resetAt) {
      // New window
      const resetAt = now + config.windowMs;
      memoryStore.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    // Within existing window
    const allowed = entry.count < config.maxRequests;

    if (allowed) {
      entry.count++;
      memoryStore.set(key, entry);
    }

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * Clean up expired entries from memory store
   */
  private static cleanupMemoryStore(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of memoryStore.entries()) {
      if (now > entry.resetAt) {
        memoryStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[RateLimit] Cleaned up ${cleaned} expired entries from memory store`);
    }
  }

  /**
   * Reset rate limit for an identifier (admin function)
   */
  public static async resetRateLimit(identifier: string, endpoint: string): Promise<void> {
    const key = `ratelimit:${endpoint}:${identifier}`;

    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.del(key);
      } catch (error) {
        logger.error('[RateLimit] Failed to reset rate limit in Redis', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    memoryStore.delete(key);
  }

  /**
   * Get rate limit status without incrementing
   */
  public static async getRateLimitStatus(
    identifier: string,
    endpoint: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${endpoint}:${identifier}`;

    if (redisClient && redisClient.status === 'ready') {
      try {
        const now = Date.now();
        const windowStart = now - config.windowMs;

        // Count requests in current window without adding
        const count = await redisClient.zcount(key, windowStart, now);

        return {
          allowed: count < config.maxRequests,
          remaining: Math.max(0, config.maxRequests - count),
          resetAt: now + config.windowMs,
        };
      } catch (error) {
        logger.error('[RateLimit] Failed to get status from Redis', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Memory fallback
    const entry = memoryStore.get(key);
    const now = Date.now();

    if (!entry || now > entry.resetAt) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
      };
    }

    return {
      allowed: entry.count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * Close Redis connection (for graceful shutdown)
   */
  public static async close(): Promise<void> {
    if (redisClient) {
      await redisClient.quit();
      logger.info('[Redis] Connection closed');
    }
  }
}

// Cleanup on process exit
process.on('SIGTERM', () => {
  RateLimitService.close();
});

process.on('SIGINT', () => {
  RateLimitService.close();
});

export { redisClient };
