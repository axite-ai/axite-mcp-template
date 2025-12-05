/**
 * Redis Client
 *
 * Provides a Redis connection for caching and rate limiting.
 */
import { Redis } from "ioredis";
import { getEnv } from "../config/env";
import { logger } from "../services/logger-service";

// Create Redis client
export const redis = new Redis(getEnv().REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on("error", (error) => {
  logger.error("[Redis] Connection error:", { error: error.message });
});

redis.on("connect", () => {
  logger.info("[Redis] Connected successfully");
});
