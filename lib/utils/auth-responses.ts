/**
 * Authentication Response Builders
 *
 * Helper functions to create standardized responses when authentication is required.
 * These responses include the login widget to allow users to authenticate inline.
 */

import type { OpenAIResponseMetadata } from "../types";
import { baseURL } from "@/baseUrl";
import { logger } from "@/lib/services/logger-service";

/**
 * Create a response that prompts the user to authenticate
 *
 * This response includes a reference to the login widget, allowing users
 * to authenticate without leaving ChatGPT.
 *
 * @param featureName - Optional name of the feature requiring authentication
 * @returns MCP tool response with login widget reference
 */
export function createLoginPromptResponse(featureName?: string) {
  const baseMessage = featureName
    ? `To access ${featureName}, please sign in to your AskMyMoney account.`
    : "This feature requires authentication. Please sign in to your AskMyMoney account.";

  const responseMeta: OpenAIResponseMetadata = {
    "openai/toolInvocation/invoking": "Checking authentication",
    "openai/toolInvocation/invoked": "Authentication required",
    "openai/outputTemplate": "ui://widget/login.html",
    "openai/widgetAccessible": false, // Login widget should not call tools
    "openai/resultCanProduceWidget": true, // This response produces a widget
  };

  return {
    content: [
      {
        type: "text" as const,
        text: baseMessage,
      } as { [x: string]: unknown; type: "text"; text: string },
    ],
    // Include minimal structured content to satisfy outputSchema validation
    structuredContent: {
      message: baseMessage,
    },
    isError: false, // Not an error - just requires auth
    _meta: responseMeta,
  };
}

/**
 * Create a response prompting the user to subscribe
 *
 * @param featureName - Optional name of the feature requiring subscription
 * @param userId - User ID from the authenticated MCP session
 * @returns MCP tool response with subscription-required widget reference
 */
export function createSubscriptionRequiredResponse(featureName?: string, userId?: string) {
  const baseMessage = featureName
    ? `To access ${featureName}, please subscribe to a plan.`
    : "This feature requires a subscription. Please choose a plan.";

  const responseMeta: OpenAIResponseMetadata = {
    "openai/toolInvocation/invoking": "Checking subscription",
    "openai/toolInvocation/invoked": "Subscription required",
    "openai/outputTemplate": "ui://widget/subscription-required.html",
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: baseMessage,
      } as { [x: string]: unknown; type: "text"; text: string },
    ],
    // Include structured content so widget can access feature name, pricing URL, and userId
    structuredContent: {
      featureName: featureName || "this feature",
      error_message: "Subscription required",
      pricingUrl: `${baseURL}/pricing`,
    },
    isError: false,
    _meta: {
      ...responseMeta,
      userId, // Pass userId so widget can use it in server action
    },
  };
}

/**
 * Create a response prompting the user to connect their bank via Plaid Link
 *
 * Extracts the MCP access token from headers and passes it to the widget
 * so it can be used when opening the /connect-bank popup
 *
 * @param userId - The user ID from the MCP session
 * @param headers - The headers from the MCP request (contains Authorization Bearer token)
 * @returns MCP tool response with Plaid connection widget
 */
export async function createPlaidRequiredResponse(userId: string, headers: Headers) {
  console.log('[Plaid Required Response] Creating response for user:', userId);

  // Extract the Bearer token from the Authorization header
  const authHeader = headers.get('authorization');
  const mcpToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  console.log('[Plaid Required Response] MCP token:', mcpToken ? 'present' : 'missing');

  const baseMessage = "Please connect your financial accounts to access your data.";

  const responseMeta: OpenAIResponseMetadata = {
    "openai/toolInvocation/invoking": "Checking bank connection",
    "openai/toolInvocation/invoked": "Bank connection required",
    "openai/outputTemplate": "ui://widget/plaid-required.html",
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  };

  const response = {
    content: [
      {
        type: "text" as const,
        text: baseMessage,
      } as { [x: string]: unknown; type: "text"; text: string },
    ],
    // Pass the MCP access token to the widget so it can open /connect-bank with auth
    structuredContent: {
      baseUrl: baseURL,
      message: "Bank connection required",
    },
    isError: false,
    _meta: {
      ...responseMeta,
      userId,
      mcpToken, // MCP Bearer token for authenticating /connect-bank popup
    },
  };

  console.log('[Plaid Required Response] Widget will receive MCP token in props');

  return response;
}

/**
 * Create a response prompting the user to set up security (Passkey)
 *
 * This is a security requirement - all users must enable a passkey.
 *
 * @param featureName - Optional name of the feature requiring security
 * @param userId - User ID from the authenticated session
 * @param headers - Request headers containing the MCP Bearer token
 * @returns MCP tool response indicating security setup is required
 */
export function createSecurityRequiredResponse(featureName?: string, userId?: string, headers?: Headers) {
  console.log('[Security Required Response] Creating response for user:', userId);

  // Extract the Bearer token from the Authorization header
  const authHeader = headers?.get('authorization');
  const mcpToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  console.log('[Security Required Response] MCP token:', mcpToken ? 'present' : 'missing');

  const baseMessage = featureName
    ? `To access ${featureName}, you must first enable a passkey.`
    : "This feature requires additional security. Please set up a passkey to continue.";

  const responseMeta: OpenAIResponseMetadata = {
    "openai/toolInvocation/invoking": "Checking security status",
    "openai/toolInvocation/invoked": "Security setup required",
    "openai/outputTemplate": "ui://widget/security-required.html", // We will map this to a simple widget later or just rely on the link
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  };

  const response = {
    content: [
      {
        type: "text" as const,
        text: baseMessage,
      } as { [x: string]: unknown; type: "text"; text: string },
    ],
    // Pass the MCP access token to the widget so it can open /onboarding with auth
    structuredContent: {
      message: "Security setup required",
      baseUrl: baseURL,
      featureName: featureName || "this feature",
      setupUrl: `${baseURL}/onboarding`,
    },
    isError: false, // Not an error - security requirement
    _meta: {
      ...responseMeta,
      userId,
      mcpToken, // MCP Bearer token for authenticating popup
    },
  };

  return response;
}
