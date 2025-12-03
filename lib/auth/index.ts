/**
 * Better Auth Configuration for Vercel Deployment
 *
 * Provides OAuth 2.1 authentication for ChatGPT via the MCP plugin.
 * Handles user sessions, OAuth flows, and integrates with PostgreSQL.
 */

import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { mcp, apiKey, jwt } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { stripe } from "@better-auth/stripe";
import { db, pool, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import Stripe from "stripe";
import type { Subscription, StripePlan } from "@better-auth/stripe";
import { baseURL as importedBaseURL } from "@/baseUrl";
import { validateEnvironmentOrExit } from "@/lib/utils/env-validation";
import { logger } from "@/lib/services/logger-service";

// Validate environment variables on startup
validateEnvironmentOrExit();

// Create Redis client for secondary storage (rate limiting, caching)
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is required for rate limiting. Please set it in your .env file.');
}

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (error) => {
  logger.error('[Redis] Connection error:', { error: error.message });
});

redis.on('connect', () => {
  logger.info('[Redis] Connected successfully for rate limiting');
});

// Add error handling for the pool (re-exported from db)
pool.on('error', (error) => {
  logger.error('[Postgres] Unexpected error on idle client', { error: error.message });
});

// Create Stripe client for subscription management
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: "2025-10-29.clover",
});

// Helper utilities for composing URLs without duplicate slashes
const stripTrailingSlash = (value: string) =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const ensureLeadingSlash = (value: string) =>
  value.startsWith("/") ? value : `/${value}`;

// Determine the application origin (used for user-facing URLs)
// Dynamically detect deployment platform: Railway, Vercel, or local development
// For production OAuth, ensure BETTER_AUTH_URL is set in environment variables
const appOrigin = process.env.BETTER_AUTH_URL || importedBaseURL.replace(/\/api\/auth$/, '');

const authBasePath = ensureLeadingSlash(
  process.env.BETTER_AUTH_BASE_PATH || "/api/auth"
);

// Get base URL for Better Auth endpoints (should include `/api/auth`)
let baseURL =
  process.env.BETTER_AUTH_URL ||
  `${stripTrailingSlash(appOrigin)}${authBasePath}`;

// Ensure baseURL includes the authBasePath (e.g. /api/auth)
// This fixes 404s when BETTER_AUTH_URL is set to the root domain (e.g. https://dev.askmymoney.ai)
// but Better Auth expects the full path to the auth endpoints for routing.
if (!baseURL.endsWith(authBasePath)) {
  baseURL = `${stripTrailingSlash(baseURL)}${authBasePath}`;
}

logger.debug("[Auth Config] Resolved URLs:", {
  appOrigin,
  authBasePath,
  baseURL, // This should now correctly include /api/auth
  originalBetterAuthUrl: process.env.BETTER_AUTH_URL,
  vercelUrl: process.env.VERCEL_URL,
  nodeEnv: process.env.NODE_ENV,
  hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET
});

// Resource URL advertised to OAuth clients (should remain the origin)
const resourceURL = process.env.MCP_RESOURCE_URL || appOrigin;

// Initialize Better Auth with MCP and Stripe plugins
export const auth = betterAuth({
  // Database configuration - using Drizzle adapter
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

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
  // Validation enforced by lib/utils/env-validation.ts
  secret: process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET || "",

  // Disable conflicting endpoints for OAuth compliance (MCP plugin provides /api/auth/mcp/token)
  disabledPaths: ["/token"],

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Advanced cookie configuration for cross-site redirects
  advanced: {
    useSecureCookies: true, // Always use secure cookies for HTTPS (dev.askmymoney.ai uses HTTPS)
    cookies: {
      session_token: {
        attributes: {
          sameSite: 'lax', // Allow cookies on same-site navigations (like Stripe redirect)
        },
      },
    },
  },

  // User schema
  user: {
    additionalFields: {
      // No additional fields - Plaid items are stored in plaid_items table
    },
  },

  // Application name (used as issuer for TOTP)
  appName: "AskMyMoney",

  // Social OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: true,
    },
  },

  telemetry: {
    debug: process.env.NODE_ENV !== "production",
  },
  logger: {
    level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  },


  // Plugins
  plugins: [
    passkey(),
    apiKey({
      // Enable API key authentication for server-side operations
      // This allows MCP tools to call auth.api methods without user sessions
      defaultPrefix: "amm_",
      requireName: true,
      // Enable sessions from API keys so the key can represent a user session
      // This is needed for endpoints like upgradeSubscription that require authentication
      enableSessionForAPIKeys: true,
    }),
    jwt({
      // JWT plugin provides JWKS endpoint for token verification
      // Required for OAuth 2.1 compliance with ChatGPT
      disableSettingJwtHeader: true, // OAuth compliance - don't set JWT in response headers
      jwt: {
        issuer: baseURL,
        audience: resourceURL,
        expirationTime: "1h",
      },
      jwks: {
        keyPairConfig: {
          alg: "RS256", // Use RS256 for better compatibility with OAuth clients
        },
      },
    }),
    mcp({
      loginPage: "/login",
      resource: resourceURL,
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
          "balances:read",
          "transactions:read",
          "insights:read",
          "health:read",
          "investments:read",
          "liabilities:read",
          "subscription:manage",
          "accounts:read",
          "accounts:write",
        ],
        trustedClients: [
          {
            clientId: "claude.ai",
            name: "Claude",
            type: "public",
            metadata: {},
            disabled: false,
            redirectUrls: [
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
            redirectUrls: [
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
      onEvent: async (event) => {
        logger.info("[Stripe Webhook] Received event:", {
          type: event.type,
          id: event.id,
          created: new Date(event.created * 1000).toISOString(),
        });

        // Debug: Log metadata for subscription-related events
        if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
          const subscription = event.data.object as any;
          logger.debug("[Stripe Webhook] Subscription event details:", {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            metadata: subscription.metadata,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          });
        }

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as any;
          logger.debug("[Stripe Webhook] Checkout session completed:", {
            sessionId: session.id,
            customerId: session.customer,
            subscriptionId: session.subscription,
            sessionMetadata: session.metadata,
            paymentStatus: session.payment_status,
            mode: session.mode,
          });

          // Fetch the subscription object to inspect its metadata
          if (session.subscription) {
            try {
              const subscription = await stripeClient.subscriptions.retrieve(session.subscription as string);
              logger.debug("[Stripe Webhook] Retrieved subscription object:", {
                id: subscription.id,
                customer: subscription.customer,
                subscriptionMetadata: subscription.metadata,
                status: subscription.status,
                items: subscription.items.data.map(item => ({
                  priceId: item.price.id,
                  productId: item.price.product,
                })),
              });
            } catch (error) {
              logger.error("[Stripe Webhook] Failed to retrieve subscription:", {
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
      },
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
                { subscription }: { subscription: Subscription }
              ) => {
                console.log("[Stripe] Trial ended", {
                  referenceId: subscription.referenceId,
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
          console.log("[Stripe] onSubscriptionComplete HOOK CALLED", {
            subscriptionId: subscription.id,
            referenceId: subscription.referenceId,
            plan: plan.name,
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            stripeCustomerId: subscription.stripeCustomerId,
            periodStart: subscription.periodStart,
            periodEnd: subscription.periodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          });

          // Verify subscription was written to database using Drizzle ORM
          try {
            const dbCheckResult = await db
              .select()
              .from(schema.subscription)
              .where(eq(schema.subscription.referenceId, subscription.referenceId));

            console.log("[Stripe] Database verification after onSubscriptionComplete:", {
              found: dbCheckResult.length,
              subscriptions: dbCheckResult,
            });

            if (subscription.stripeSubscriptionId) {
              const stripeIdCheckResult = await db
                .select()
                .from(schema.subscription)
                .where(eq(schema.subscription.stripeSubscriptionId, subscription.stripeSubscriptionId));

              console.log("[Stripe] Database lookup by stripeSubscriptionId:", {
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                found: stripeIdCheckResult.length,
                subscriptions: stripeIdCheckResult,
              });
            }
          } catch (error) {
            console.error("[Stripe] Failed to verify subscription in database:", error);
          }

          // Send subscription confirmation email
          try {
            const { EmailService } = await import("@/lib/services/email-service");

            // Get user details from database using Drizzle
            const userResult = await db
              .select({ email: schema.user.email, name: schema.user.name })
              .from(schema.user)
              .where(eq(schema.user.id, subscription.referenceId))
              .limit(1);

            const user = userResult[0];
            if (user?.email) {
              const userName = user.name || "there";
              const planName = plan.name.charAt(0).toUpperCase() + plan.name.slice(1);

              await EmailService.sendSubscriptionConfirmation(
                user.email,
                userName,
                planName
              );

              console.log("[Stripe] Subscription confirmation email sent to", user.email);
            }
          } catch (error) {
            console.error("[Stripe] Failed to send subscription confirmation email:", error);
            // Don't throw - email failure shouldn't block subscription
          }
        },
        onSubscriptionUpdate: async ({
          subscription,
        }: {
          subscription: Subscription;
        }) => {
          console.log("[Stripe] onSubscriptionUpdate HOOK CALLED", {
            subscriptionId: subscription.id,
            referenceId: subscription.referenceId,
            plan: subscription.plan,
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
          });
        },
        onSubscriptionCancel: async ({
          subscription,
        }: {
          subscription: Subscription;
        }) => {
          console.log("[Stripe] onSubscriptionCancel HOOK CALLED", {
            subscriptionId: subscription.id,
            referenceId: subscription.referenceId,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          });
        },
        onSubscriptionDeleted: async ({
          subscription,
        }: {
          subscription: Subscription;
        }) => {
          console.warn("[Stripe] onSubscriptionDeleted HOOK CALLED", {
            subscriptionId: subscription.id,
            referenceId: subscription.referenceId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
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
