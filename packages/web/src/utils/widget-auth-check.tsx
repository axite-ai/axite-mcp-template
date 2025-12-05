/**
 * Widget Authentication Check Helper
 *
 * DRY helper to check if widget should render auth prompts.
 * Returns the appropriate auth component or null if no auth issues.
 */

import SubscriptionRequired from "@/app/widgets/subscription-required/widget";

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

  // Check for subscription required
  if (toolOutput.error_message === "Subscription required") {
    return <SubscriptionRequired />;
  }

  // TEMPLATE: Add checks for your custom auth requirements here
  // Example: Check for security/passkey requirement
  // if (toolOutput.message === "Security setup required") {
  //   return <SecurityRequired />;
  // }

  // No auth issues
  return null;
}
