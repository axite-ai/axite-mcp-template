/**
 * MCP Authentication Helpers
 *
 * Extracts and validates session information from MCP requests.
 */

import { Request } from "express";
import { logger } from "../services/logger-service";
import { db } from "../db";
import { passkey, subscription } from "../db/schema";
import { eq } from "drizzle-orm";
import { FEATURES } from "../config/features";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@axite/shared";

export interface McpSession {
  userId: string;
  scopes?: string[];
}

/**
 * Extract session from request headers
 * In production, this validates the OAuth token
 */
export async function getSessionFromRequest(req: Request): Promise<McpSession | null> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.debug("[MCP Auth] No bearer token found");
      return null;
    }

    const token = authHeader.substring(7);

    // TODO: Validate token with Better Auth
    // For now, we'll decode the JWT payload to get the userId
    // In production, this should verify the token signature

    const payload = decodeJwtPayload(token);

    if (!payload?.sub) {
      logger.warn("[MCP Auth] Invalid token payload - no subject");
      return null;
    }

    return {
      userId: payload.sub,
      scopes: payload.scope?.split(" ") || [],
    };
  } catch (error) {
    logger.error("[MCP Auth] Failed to extract session", { error });
    return null;
  }
}

/**
 * Decode JWT payload without verification (verification should happen upstream)
 */
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (!FEATURES.SUBSCRIPTIONS) {
    return true; // If subscriptions disabled, everyone has "access"
  }

  try {
    const [sub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, userId))
      .limit(1);

    if (!sub) return false;

    // Check if subscription is active
    const activeStatuses = ["active", "trialing"];
    return activeStatuses.includes(sub.status || "");
  } catch (error) {
    logger.error("[MCP Auth] Failed to check subscription", { error, userId });
    return false;
  }
}

/**
 * Check if user has passkey enabled
 */
export async function hasPasskeyEnabled(userId: string): Promise<boolean> {
  try {
    const [pk] = await db
      .select()
      .from(passkey)
      .where(eq(passkey.userId, userId))
      .limit(1);

    return !!pk;
  } catch (error) {
    logger.error("[MCP Auth] Failed to check passkey", { error, userId });
    return false;
  }
}

// Auth requirement options
interface AuthRequirements {
  requireSubscription?: boolean;
  requireSecurity?: boolean;
  customCheck?: (userId: string) => Promise<{ valid: boolean; error?: any }>;
}

/**
 * Create login prompt response
 */
export function createLoginPromptResponse(featureName: string) {
  const baseUrl = process.env.WEB_URL || "http://localhost:3000";

  return createErrorResponse(`Please log in to access ${featureName}`, {
    "openai/outputTemplate": "ui://widget/login.html",
  });
}

/**
 * Create subscription required response
 */
export function createSubscriptionRequiredResponse(featureName: string, _userId: string) {
  const baseUrl = process.env.WEB_URL || "http://localhost:3000";

  return {
    content: [{ type: "text" as const, text: `Subscription required for ${featureName}` }],
    structuredContent: {
      featureName,
      error_message: `A subscription is required to access ${featureName}`,
      pricingUrl: `${baseUrl}/pricing`,
    },
    isError: true,
    _meta: {
      "openai/outputTemplate": "ui://widget/subscription-required.html",
    },
  };
}

/**
 * Create security required response
 */
export function createSecurityRequiredResponse(featureName: string, _userId: string) {
  const baseUrl = process.env.WEB_URL || "http://localhost:3000";

  return createErrorResponse(`Security verification required for ${featureName}`, {
    "openai/outputTemplate": "ui://widget/security-required.html",
  });
}

/**
 * Check authentication requirements and return error response if needed.
 * Returns null if all checks pass.
 */
export async function requireAuth(
  session: McpSession | null,
  featureName: string,
  options: AuthRequirements = {}
): Promise<any | null> {
  const {
    requireSubscription = FEATURES.SUBSCRIPTIONS,
    requireSecurity = false,
    customCheck,
  } = options;

  logger.debug(`[requireAuth] Checking auth for ${featureName}:`, {
    hasSession: !!session,
    userId: session?.userId,
    requireSubscription,
    requireSecurity,
  });

  // Check 1: Session exists
  if (!session) {
    logger.debug(`[requireAuth] No session, returning login prompt`);
    return createLoginPromptResponse(featureName);
  }

  // Check 2: Security (Passkey) enabled (if required)
  if (requireSecurity) {
    const hasPasskey = await hasPasskeyEnabled(session.userId);

    if (!hasPasskey) {
      logger.debug(`[requireAuth] Passkey not enabled, returning Security Required response`);
      return createSecurityRequiredResponse(featureName, session.userId);
    }
  }

  // Check 3: Active subscription (if required)
  if (requireSubscription && FEATURES.SUBSCRIPTIONS) {
    const hasSub = await hasActiveSubscription(session.userId);

    if (!hasSub) {
      logger.debug(`[requireAuth] No subscription, returning subscription required response`);
      return createSubscriptionRequiredResponse(featureName, session.userId);
    }
  }

  // Check 4: Custom validation (if provided)
  if (customCheck) {
    try {
      const result = await customCheck(session.userId);

      if (!result.valid) {
        logger.debug(`[requireAuth] Custom check failed`);
        return createLoginPromptResponse(featureName);
      }
    } catch (error) {
      logger.error(`[requireAuth] Error in custom check:`, { error });
      return createLoginPromptResponse(featureName);
    }
  }

  // All checks passed
  logger.debug(`[requireAuth] All checks passed for ${featureName}`);
  return null;
}
