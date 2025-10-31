/**
 * Better Auth Configuration for Vercel Deployment
 *
 * Provides OAuth 2.1 authentication for ChatGPT via the MCP plugin.
 * Handles user sessions, OAuth flows, and integrates with PostgreSQL.
 */

import { betterAuth } from "better-auth";
import { mcp } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { Pool } from "pg";
import { Redis } from "ioredis";
import Stripe from "stripe";
import type { Subscription, StripePlan } from "@better-auth/stripe";

// Create PostgreSQL connection pool
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

// Add error handling for the pool
pool.on('error', (error) => {
  console.error('[Postgres] Unexpected error on idle client', error);
});

// Create Redis client for secondary storage (rate limiting, caching)
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is required for rate limiting. Please set it in your .env file.');
}

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (error) => {
  console.error('[Redis] Connection error:', error);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully for rate limiting');
});

// Create Stripe client for subscription management
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: "2025-09-30.clover",
});

// Get base URL from environment
const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  'https://dev.askmymoney.ai';

// Initialize Better Auth with MCP and Stripe plugins
export const auth = betterAuth({
  // Database configuration
  database: pool,

  // Secondary storage for caching and rate limiting (Redis)
  secondaryStorage: {
    get: async (key) => {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    },
    set: async (key, value, ttl) => {
      const serialized = JSON.stringify(value);
      if (ttl && ttl > 0) {
        await redis.setex(key, Math.ceil(ttl / 1000), serialized);
      } else {
        const defaultTTL = 60 * 60 * 24 * 7; // 7 days
        await redis.setex(key, defaultTTL, serialized);
      }
    },
    delete: async (key) => {
      await redis.del(key);
    },
  },

  // Base URL for OAuth redirects
  baseURL,

  // Secret for signing tokens (MUST be set in production)
  secret:
    process.env.BETTER_AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    "development-secret-change-in-production",

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
  },

  // User schema
  user: {
    additionalFields: {
      plaidItemIds: {
        type: "string",
        required: false,
      },
    },
  },

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  telemetry: {
    debug: true
  },
  logger: {
    level: 'debug',
  },


  // Plugins
  plugins: [
    mcp({
      loginPage: "/login",
      resource: baseURL,

      // OAuth configuration
      oidcConfig: {
        allowDynamicClientRegistration: true,
        loginPage: "/login",
        codeExpiresIn: 300,
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 60 * 60 * 24 * 90,
        defaultScope: "openid profile email",
        scopes: [
          "openid",
          "profile",
          "email",
          "claudeai",
          "offline_access",
          "read:accounts",
          "read:transactions",
        ],
        trustedClients: [
          {
            clientId: "claude.ai",
            name: "Claude",
            type: "public",
            metadata: {},
            disabled: false,
            redirectURLs: [
              "https://claude.ai/api/mcp/auth_callback",
              "https://claude.com/api/mcp/auth_callback",
            ],
            skipConsent: true,
          },
          {
            clientId: "chatgpt.com",
            name: "ChatGPT",
            type: "public",
            metadata: {},
            disabled: false,
            redirectURLs: [
              "https://chatgpt.com/connector_platform_oauth_redirect",
              "https://chat.openai.com/connector_platform_oauth_redirect",
            ],
            skipConsent: true,
          },
        ],
      },
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "basic",
            priceId: process.env.STRIPE_BASIC_PRICE_ID || "",
            limits: {
              maxAccounts: 3,
            },
          },
          {
            name: "pro",
            priceId: process.env.STRIPE_PRO_PRICE_ID || "",
            limits: {
              maxAccounts: 10,
            },
            freeTrial: {
              days: 14,
              onTrialStart: async (subscription: Subscription) => {
                console.log("[Stripe] Trial started", {
                  referenceId: subscription.referenceId,
                });
              },
              onTrialEnd: async (
                { subscription }: { subscription: Subscription },
                ctx?: any
              ) => {
                console.log("[Stripe] Trial ended", {
                  referenceId: subscription.referenceId,
                  userId: ctx?.user?.id,
                });
              },
              onTrialExpired: async (subscription: Subscription) => {
                console.warn("[Stripe] Trial expired without conversion", {
                  referenceId: subscription.referenceId,
                });
              },
            },
          },
          {
            name: "enterprise",
            priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
            limits: {
              maxAccounts: Infinity,
            },
          },
        ],
        requireEmailVerification: false,
        onSubscriptionComplete: async ({
          subscription,
          plan,
        }: {
          subscription: Subscription;
          plan: StripePlan;
        }) => {
          console.log("[Stripe] Subscription complete", {
            referenceId: subscription.referenceId,
            plan: plan.name,
          });
        },
        onSubscriptionUpdate: async ({
          subscription,
        }: {
          subscription: Subscription;
        }) => {
          console.log("[Stripe] Subscription updated", {
            subscriptionId: subscription.id,
          });
        },
        onSubscriptionCancel: async ({
          subscription,
        }: {
          subscription: Subscription;
        }) => {
          console.log("[Stripe] Subscription canceled", {
            subscriptionId: subscription.id,
          });
        },
        onSubscriptionDeleted: async ({
          subscription,
        }: {
          subscription: Subscription;
        }) => {
          console.warn("[Stripe] Subscription deleted", {
            subscriptionId: subscription.id,
          });
        },
      },
    }),
  ],

  // Rate limiting configuration (uses Redis)
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "secondary-storage",
    customRules: {
      "/api/auth/sign-in/*": {
        window: 60,
        max: 10,
      },
      "/api/auth/oauth/token": {
        window: 60,
        max: 20,
      },
      "/api/auth/oauth/authorize": {
        window: 60,
        max: 20,
      },
      "/api/auth/.well-known/*": false,
    },
  },
});

export type AuthInstance = typeof auth;
