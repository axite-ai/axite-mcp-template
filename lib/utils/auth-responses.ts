/**
 * Authentication Response Builders
 *
 * Helper functions to create standardized responses when authentication is required.
 * These responses include the login widget to allow users to authenticate inline.
 */

import type { AuthChallengeResponse } from "../types/tool-responses";
import { createTextContent, createMCPResponse } from "../types/mcp-responses";
import { baseURL } from "@/baseUrl";

/**
 * Create a response that prompts the user to authenticate
 *
 * This response includes a reference to the login widget, allowing users
 * to authenticate without leaving ChatGPT.
 *
 * @param featureName - Optional name of the feature requiring authentication
 * @returns MCP tool response with login widget reference
 */
export function createLoginPromptResponse(featureName?: string): AuthChallengeResponse {
  const baseMessage = featureName
    ? `To access ${featureName}, please sign in to your account.`
    : "This feature requires authentication. Please sign in to your account.";

  return createMCPResponse(
    [createTextContent(baseMessage)],
    {
      structuredContent: {
        message: baseMessage,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Checking authentication",
        "openai/toolInvocation/invoked": "Authentication required",
        "openai/outputTemplate": "ui://widget/login.html",
        "openai/widgetAccessible": false,
        "openai/resultCanProduceWidget": true,
      },
      isError: false,
    }
  );
}

/**
 * Create a response prompting the user to subscribe
 *
 * @param featureName - Optional name of the feature requiring subscription
 * @param userId - User ID from the authenticated MCP session
 * @returns MCP tool response with subscription-required widget reference
 */
export function createSubscriptionRequiredResponse(featureName?: string, userId?: string): AuthChallengeResponse {
  const baseMessage = featureName
    ? `To access ${featureName}, please subscribe to a plan.`
    : "This feature requires a subscription. Please choose a plan.";

  return createMCPResponse(
    [createTextContent(baseMessage)],
    {
      structuredContent: {
        message: baseMessage,
        featureName: featureName || "this feature",
        error_message: "Subscription required",
        pricingUrl: `${baseURL}/pricing`,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Checking subscription",
        "openai/toolInvocation/invoked": "Subscription required",
        "openai/outputTemplate": "ui://widget/subscription-required.html",
        "openai/widgetAccessible": false,
        "openai/resultCanProduceWidget": true,
        userId,
      },
      isError: false,
    }
  );
}

/**
 * Create a response prompting the user to set up security (Passkey)
 *
 * This is a security requirement - all users must enable a passkey.
 *
 * @param featureName - Optional name of the feature requiring security
 * @param userId - User ID from the authenticated session
 * @returns MCP tool response indicating security setup is required
 */
export function createSecurityRequiredResponse(featureName?: string, userId?: string): AuthChallengeResponse {
  console.log('[Security Required Response] Creating response for user:', userId);

  const baseMessage = featureName
    ? `To access ${featureName}, you must first enable a passkey.`
    : "This feature requires additional security. Please set up a passkey to continue.";

  return createMCPResponse(
    [createTextContent(baseMessage)],
    {
      structuredContent: {
        message: "Security setup required",
        baseUrl: baseURL,
        featureName: featureName || "this feature",
        setupUrl: `${baseURL}/onboarding`,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Checking security status",
        "openai/toolInvocation/invoked": "Security setup required",
        "openai/outputTemplate": "ui://widget/security-required.html",
        "openai/widgetAccessible": false,
        "openai/resultCanProduceWidget": true,
        userId,
      },
      isError: false,
    }
  );
}
