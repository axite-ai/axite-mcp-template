/**
 * Environment Configuration
 *
 * Loads and validates environment variables for the server package.
 */

import { config } from "dotenv";
import { z } from "zod";
import path from "path";

// Environment schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MCP_PORT: z.string().default("3001"),
  WEB_URL: z.string().default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  POSTGRES_SSL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().optional(),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Stripe (optional - required if ENABLE_SUBSCRIPTIONS=true)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_BASIC_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),

  // Feature flags
  ENABLE_SUBSCRIPTIONS: z.string().optional(),
  ENABLE_PASSKEYS: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

/**
 * Load environment variables from .env file at the monorepo root
 */
export function loadEnv(): Env {
  if (env) return env;

  // Load from monorepo root .env file
  const rootEnvPath = path.resolve(__dirname, "../../../../.env");
  config({ path: rootEnvPath });

  // Also try loading from server package .env (for overrides)
  const serverEnvPath = path.resolve(__dirname, "../../.env");
  config({ path: serverEnvPath, override: false });

  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Environment validation failed:");
      error.errors.forEach((e) => {
        console.error(`  - ${e.path.join(".")}: ${e.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Get validated environment variables
 */
export function getEnv(): Env {
  if (!env) {
    return loadEnv();
  }
  return env;
}
