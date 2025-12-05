/**
 * Feature Flags Configuration
 *
 * Control which features are enabled in your application.
 * TEMPLATE: Customize these flags based on your needs.
 */

/**
 * Feature flags for the application
 * Set these via environment variables to enable/disable features
 */
export const FEATURES = {
  /**
   * Enable Stripe subscription management
   * - When true: Requires STRIPE_* environment variables
   * - When false: All tools are free tier, no subscription checks
   */
  SUBSCRIPTIONS: process.env.ENABLE_SUBSCRIPTIONS === "true",

  /**
   * Enable passkey (WebAuthn) authentication
   * - When true: Users can set up passkeys for additional security
   * - When false: Passkey features are hidden
   */
  PASSKEYS: process.env.ENABLE_PASSKEYS !== "false", // Enabled by default

  // TEMPLATE: Add your own feature flags here
  // EXAMPLE_FEATURE: process.env.ENABLE_EXAMPLE === "true",
} as const;

/**
 * Helper to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}
