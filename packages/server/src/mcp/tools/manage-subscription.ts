/**
 * Manage Subscription Tool
 *
 * View subscription status and access billing portal.
 * Demonstrates: Stripe integration, conditional registration, external API
 *
 * MCP Best Practices implemented:
 * - Tool naming with {service}_ prefix placeholder
 * - All four tool annotations (note: openWorldHint is true for Stripe API)
 * - Actionable error messages
 *
 * See: docs/mcp-builder/reference/mcp_best_practices.md
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Stripe from "stripe";
import { logger } from "../../services/logger-service";
import { requireAuth } from "../auth";
import { createSuccessResponse, createErrorResponse } from "@axite/shared";
import { FEATURES } from "../../config/features";
import type { McpContext } from "../server";
import type { ManageSubscriptionResponse } from "@axite/shared";

// Initialize Stripe (only if subscriptions enabled)
const stripe = FEATURES.SUBSCRIPTIONS
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-10-29.clover" as any,
    })
  : null;

/**
 * Register the manage_subscription tool (only if subscriptions are enabled)
 *
 * TODO: Replace {service} with your app name (e.g., myapp_manage_subscription)
 */
export function registerManageSubscriptionTool(server: McpServer, context: McpContext): void {
  // Only register if subscriptions are enabled
  if (!FEATURES.SUBSCRIPTIONS || !stripe) {
    logger.info("[Tools] manage_subscription tool not registered (subscriptions disabled)");
    return;
  }

  const WEB_URL = process.env.WEB_URL || "http://localhost:3000";

  server.tool(
    // MCP Best Practice: Tool names use {service}_action_resource format
    // TODO: Replace {service} with your app name
    "{service}_manage_subscription",
    `View your current subscription and access the billing portal.

Shows subscription status, plan details, and provides a link to the
Stripe billing portal for updating payment methods or cancellation.

No parameters required - uses authenticated user's subscription.

Returns subscription details and portal URL.`,
    {},
    // MCP Best Practice: Tool annotations (when SDK supports them)
    // readOnlyHint: false     - Portal session creation is a write operation
    // destructiveHint: false  - Viewing doesn't destroy data
    // idempotentHint: false   - Portal sessions are unique each time
    // openWorldHint: true     - Calls Stripe API
    async (): Promise<ManageSubscriptionResponse> => {
      try {
        // Check authentication (no subscription required to view subscription!)
        const authCheck = await requireAuth(context.session, "subscription management", {
          requireSubscription: false,
        });
        if (authCheck) return authCheck;

        // In a real implementation, you would:
        // 1. Look up the user's Stripe customer ID from your database
        // 2. Create a billing portal session
        // 3. Return the portal URL

        // For now, we'll create a mock response
        // TODO: Integrate with actual Stripe customer lookup

        const userId = context.session!.userId;

        // Mock: In production, look up stripeCustomerId from user table
        const stripeCustomerId = `cus_mock_${userId}`;

        try {
          // Create billing portal session
          const portalSession = await stripe!.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${WEB_URL}/settings`,
          });

          // Get subscription info
          const subscriptions = await stripe!.subscriptions.list({
            customer: stripeCustomerId,
            limit: 1,
          });

          const subscription = subscriptions.data[0] || null;

          return createSuccessResponse(
            subscription
              ? `You're subscribed to the ${subscription.items.data[0]?.price.metadata?.plan || "current"} plan`
              : "No active subscription",
            {
              subscription: subscription
                ? {
                    plan: subscription.items.data[0]?.price.metadata?.plan || "unknown",
                    status: subscription.status,
                    periodStart: new Date(
                      (subscription as any).current_period_start * 1000
                    ).toISOString(),
                    periodEnd: new Date(
                      (subscription as any).current_period_end * 1000
                    ).toISOString(),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                  }
                : null,
              portalUrl: portalSession.url,
              message: "Click below to manage your subscription",
            },
            {
              "openai/outputTemplate": "ui://widget/manage-subscription.html",
              "openai/toolInvocation/invoked": "Subscription loaded",
            }
          );
        } catch (stripeError) {
          // If Stripe lookup fails (e.g., invalid customer), return helpful message
          logger.warn("Stripe customer lookup failed", { stripeError, userId });

          return createSuccessResponse(
            "No subscription found",
            {
              subscription: null,
              portalUrl: `${WEB_URL}/pricing`,
              message: "You don't have an active subscription. Choose a plan to get started.",
            },
            {
              "openai/outputTemplate": "ui://widget/manage-subscription.html",
              "openai/toolInvocation/invoked": "Subscription loaded",
            }
          );
        }
      } catch (error) {
        logger.error("manage_subscription failed", { error });
        // MCP Best Practice: Actionable error messages
        return createErrorResponse(
          error instanceof Error
            ? `Failed to load subscription: ${error.message}. Please try again or contact support.`
            : "Failed to load subscription details. Please try again."
        );
      }
    }
  );

  logger.info("[Tools] manage_subscription tool registered");
}
