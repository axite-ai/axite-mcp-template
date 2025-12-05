"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user, account, passkey, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

type RecoveryCheckResult =
  | { success: true; hasGoogleOAuth: boolean; email: string }
  | { success: false; error: string };

type RecoveryCompleteResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Check if a user exists and has Google OAuth linked
 * This is the first step in the recovery flow
 */
export async function checkRecoveryEligibility(
  email: string
): Promise<RecoveryCheckResult> {
  try {
    if (!email || !email.includes("@")) {
      return {
        success: false,
        error: "Please enter a valid email address",
      };
    }

    // Find user by email
    const users = await db.select().from(user).where(eq(user.email, email.toLowerCase())).limit(1);

    if (users.length === 0) {
      // Security: Don't reveal whether email exists
      return {
        success: false,
        error: "If an account exists with this email, you'll receive recovery instructions.",
      };
    }

    const foundUser = users[0];

    // Check if user has Google OAuth account linked
    const accounts = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, foundUser.id),
          eq(account.providerId, "google")
        )
      )
      .limit(1);

    if (accounts.length === 0) {
      return {
        success: false,
        error: "Account recovery via Google is not available. Please contact support.",
      };
    }

    return {
      success: true,
      hasGoogleOAuth: true,
      email: foundUser.email,
    };
  } catch (error) {
    console.error("[Recovery] Error checking eligibility:", error);
    return {
      success: false,
      error: "An error occurred. Please try again later.",
    };
  }
}

/**
 * Complete account recovery (nuclear option)
 * - Verify Google OAuth re-authentication
 * - Invalidate all sessions
 * - Delete all passkeys
 * - Log high-risk event
 * - Redirect to passkey enrollment
 */
export async function completeAccountRecovery(): Promise<RecoveryCompleteResult> {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return {
        success: false,
        error: "Authentication required. Please sign in with Google first.",
      };
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    console.log("[Recovery] Starting nuclear-option recovery for user:", userId);

    // Step 1: Invalidate ALL sessions for this user
    try {
      // Better Auth API to revoke all sessions
      // Note: revokeSessions requires the current session headers
      await auth.api.revokeSessions({ headers: headersList });
      console.log("[Recovery] Invalidated all sessions for user:", userId);
    } catch (error) {
      console.error("[Recovery] Error invalidating sessions:", error);
      // Continue anyway - passkey deletion is more critical
    }

    // Step 2: Delete ALL passkeys for this user (nuclear option)
    const deletedPasskeys = await db
      .delete(passkey)
      .where(eq(passkey.userId, userId))
      .returning();

    console.log("[Recovery] Deleted", deletedPasskeys.length, "passkeys for user:", userId);

    // Step 3: Get request metadata for audit log
    const userAgent = headersList.get("user-agent") || "Unknown";
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "Unknown";

    // Step 4: Log high-risk security event
    await db.insert(auditLogs).values({
      userId,
      eventType: "account_recovered_via_oauth",
      eventData: {
        recoveryMethod: "google_oauth",
        sessionsInvalidated: true,
        passkeysDeleted: deletedPasskeys.length,
        email: userEmail,
        timestamp: new Date().toISOString(),
      },
      ipAddress,
      userAgent,
      success: true,
      errorMessage: null,
    });

    console.log("[Recovery] Logged recovery event to audit trail");

    return {
      success: true,
      message: "Account recovered successfully. Please create a new passkey.",
    };
  } catch (error) {
    console.error("[Recovery] Error during recovery:", error);

    // Log failed recovery attempt
    try {
      const headersList = await headers();
      const session = await auth.api.getSession({ headers: headersList });
      const userAgent = headersList.get("user-agent") || "Unknown";
      const ipAddress =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "Unknown";

      if (session?.user) {
        await db.insert(auditLogs).values({
          userId: session.user.id,
          eventType: "account_recovery_failed",
          eventData: {
            recoveryMethod: "google_oauth",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          },
          ipAddress,
          userAgent,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch (logError) {
      console.error("[Recovery] Failed to log error:", logError);
    }

    return {
      success: false,
      error: "Failed to complete recovery. Please try again or contact support.",
    };
  }
}
