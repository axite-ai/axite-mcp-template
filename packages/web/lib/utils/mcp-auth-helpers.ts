/**
 * MCP Tool Authentication Helpers
 *
 * DRY helpers to check authentication requirements in MCP tools.
 * Reduces boilerplate and ensures consistency across all tools.
 */

import type { AuthChallengeResponse } from "@/lib/types/tool-responses";
import { hasActiveSubscription } from "./subscription-helpers";
import {
  createLoginPromptResponse,
  createSubscriptionRequiredResponse,
  createSecurityRequiredResponse,
} from "./auth-responses";
import { db } from "@/lib/db";
import { passkey } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { FEATURES } from "@/lib/config/features";

interface AuthRequirements {
  /** Require active subscription (default: true if subscriptions enabled) */
  requireSubscription?: boolean;
  /** Require passkey to be enabled (default: false) */
  requireSecurity?: boolean;
  /** Custom validation function (optional) */
  customCheck?: (userId: string) => Promise<{ valid: boolean; error?: any }>;
}

/**
 * Check authentication requirements and return error response if needed.
 * Returns null if all checks pass.
 *
 * @param session - MCP session from withMcpAuth
 * @param featureName - Name of the feature being accessed (for error messages)
 * @param options - Auth requirement options
 * @returns Auth error response or null if all checks pass
 *
 * @example
 * ```typescript
 * // Basic auth with subscription check
 * server.registerTool("get_items", config, async () => {
 *   const authCheck = await requireAuth(session, "items");
 *   if (authCheck) return authCheck;
 *
 *   // ... actual tool logic
 * });
 *
 * // Auth without subscription (free tier)
 * server.registerTool("free_tool", config, async () => {
 *   const authCheck = await requireAuth(session, "free tool", {
 *     requireSubscription: false,
 *   });
 *   if (authCheck) return authCheck;
 *
 *   // ... actual tool logic
 * });
 *
 * // Auth with custom validation
 * server.registerTool("custom_tool", config, async () => {
 *   const authCheck = await requireAuth(session, "custom feature", {
 *     customCheck: async (userId) => {
 *       const canAccess = await checkCustomPermission(userId);
 *       return { valid: canAccess };
 *     }
 *   });
 *   if (authCheck) return authCheck;
 *
 *   // ... actual tool logic
 * });
 * ```
 */
export async function requireAuth(
  session: { userId: string } | null | undefined,
  featureName: string,
  options: AuthRequirements = {}
): Promise<AuthChallengeResponse | null> {
  const {
    requireSubscription = FEATURES.SUBSCRIPTIONS, // Default to true only if subscriptions enabled
    requireSecurity = false,
    customCheck,
  } = options;

  console.log(`[requireAuth] Checking auth for ${featureName}:`, {
    hasSession: !!session,
    userId: session?.userId,
    requireSubscription,
    requireSecurity,
    subscriptionsEnabled: FEATURES.SUBSCRIPTIONS,
  });

  // Check 1: Session exists (OAuth authentication)
  if (!session) {
    console.log(`[requireAuth] No session, returning login prompt`);
    return createLoginPromptResponse(featureName);
  }

  // Check 2: Security (Passkey) enabled (if required)
  if (requireSecurity) {
    try {
      // Check Passkeys from database
      const passkeys = await db
        .select()
        .from(passkey)
        .where(eq(passkey.userId, session.userId))
        .limit(1);
      const hasPasskey = passkeys.length > 0;

      console.log(`[requireAuth] Security check:`, {
        required: true,
        hasPasskey,
        userId: session.userId,
      });

      if (!hasPasskey) {
        console.log(
          `[requireAuth] Passkey not enabled, returning Security Required response`
        );
        return createSecurityRequiredResponse(featureName, session.userId);
      }
    } catch (error) {
      console.error(`[requireAuth] Error checking security status:`, error);
      // Fail closed
      return createSecurityRequiredResponse(featureName, session.userId);
    }
  }

  // Check 3: Active subscription (if required and feature enabled)
  if (requireSubscription && FEATURES.SUBSCRIPTIONS) {
    const hasSubscription = await hasActiveSubscription(session.userId);
    console.log(`[requireAuth] Subscription check:`, {
      required: true,
      hasSubscription,
    });

    if (!hasSubscription) {
      console.log(
        `[requireAuth] No subscription, returning subscription required response`
      );
      return createSubscriptionRequiredResponse(featureName, session.userId);
    }
  }

  // Check 4: Custom validation (if provided)
  if (customCheck) {
    try {
      const result = await customCheck(session.userId);
      console.log(`[requireAuth] Custom check:`, {
        valid: result.valid,
        error: result.error,
      });

      if (!result.valid) {
        console.log(`[requireAuth] Custom check failed`);
        // TEMPLATE: Create a custom error response based on your needs
        // For now, return a generic login prompt
        return createLoginPromptResponse(featureName);
      }
    } catch (error) {
      console.error(`[requireAuth] Error in custom check:`, error);
      return createLoginPromptResponse(featureName);
    }
  }

  // All checks passed
  console.log(`[requireAuth] All checks passed for ${featureName}`);
  return null;
}
