/**
 * Widget Authentication Check Helper
 *
 * DRY helper to check if widget should render auth prompts.
 * Returns the appropriate auth component or null if no auth issues.
 */

import PlaidRequired from "@/src/components/plaid-required";
import SubscriptionRequired from "@/src/components/subscription-required";
import SecurityRequired from "@/src/components/security-required";

/**
 * Check widget auth state and return appropriate component if auth is required.
 * Returns null if no auth issues detected.
 *
 * @param toolOutput - The widget props received from MCP tool response
 * @returns Auth component to render, or null if authenticated
 *
 * @example
 * ```typescript
 * export default function MyWidget() {
 *   const toolOutput = useWidgetProps<ToolOutput>();
 *
 *   const authComponent = checkWidgetAuth(toolOutput);
 *   if (authComponent) return authComponent;
 *
 *   // ... render actual widget content
 * }
 * ```
 */
export function checkWidgetAuth(toolOutput: any) {
  if (!toolOutput) return null;

  // Check for Security required (Passkey)
  if (toolOutput.message === "Security setup required") {
    return <SecurityRequired />;
  }

  // Check for subscription required
  // Only show subscription modal if there's an actual error, not just because featureName exists
  if (toolOutput.error_message === "Subscription required") {
    return <SubscriptionRequired />;
  }

  // Check for Plaid connection required
  if (toolOutput.message === "Bank connection required") {
    return <PlaidRequired />;
  }

  // No auth issues
  return null;
}
