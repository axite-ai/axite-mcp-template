/**
 * OpenAI Apps SDK Metadata Types
 *
 * Metadata provided by ChatGPT in the `_meta` field of tool parameters.
 * Used for personalization, security logging, and analytics.
 */

/**
 * User location information from ChatGPT
 */
export interface OpenAIUserLocation {
  city: string;
  region: string;
  country: string;
  timezone: string;       // IANA timezone, e.g., "America/Detroit"
  latitude: string;
  longitude: string;
}

/**
 * Metadata provided by ChatGPT in tool requests
 */
export interface OpenAIMetadata {
  /**
   * User's browser/device information
   * e.g., "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..."
   */
  'openai/userAgent': string;

  /**
   * User's locale preference
   * e.g., "en-US", "es-MX", "fr-FR"
   */
  'openai/locale': string;

  /**
   * User's geographic location
   */
  'openai/userLocation': OpenAIUserLocation;

  /**
   * Unique session identifier for the user
   * Use for correlation across tool calls
   */
  'openai/subject': string;
}

/**
 * Tool execution context combining authentication and OpenAI metadata
 * TEMPLATE: Customize this interface for your application's needs
 */
export interface ToolExecutionContext {
  // Authentication
  userId: string;
  sessionId: string;

  // OpenAI metadata (optional - may not be present in all requests)
  metadata?: OpenAIMetadata;

  // TEMPLATE: Third-party service tokens (example from previous Plaid integration)
  // Rename or replace with your own integration tokens as needed
  plaidAccessTokens?: string[];
}

/**
 * Tool annotations for ChatGPT behavior
 */
export interface ToolAnnotations {
  /**
   * Whether this tool performs destructive operations
   * (changes user data, makes purchases, etc.)
   */
  destructiveHint: boolean;

  /**
   * Whether this tool makes calls to the open internet
   */
  openWorldHint: boolean;

  /**
   * Whether this tool is read-only (no side effects)
   */
  readOnlyHint: boolean;
}

/**
 * Security scheme for per-tool authentication
 * Declares authentication requirements for individual tools
 */
export type ToolSecurityScheme =
  | { type: "noauth" }                    // Callable anonymously
  | { type: "oauth2"; scopes?: string[] }; // Requires OAuth 2.0
