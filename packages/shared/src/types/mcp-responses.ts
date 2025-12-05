/**
 * Type definitions for MCP tool responses following the OpenAI Apps SDK specification
 * Based on: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
 */

/**
 * Content types that can be returned in MCP responses
 * The model reads both content and structuredContent
 *
 * Based on MCP SDK ContentType from @modelcontextprotocol/sdk
 */
export type MCPContent =
  | { type: "text"; text: string; _meta?: Record<string, unknown> }
  | { type: "image"; data: string; mimeType: string; _meta?: Record<string, unknown> }
  | { type: "audio"; data: string; mimeType: string; _meta?: Record<string, unknown> }
  | {
      type: "resource";
      resource:
        | { uri: string; text: string; mimeType?: string; _meta?: Record<string, unknown> }
        | { uri: string; blob: string; mimeType?: string; _meta?: Record<string, unknown> };
      _meta?: Record<string, unknown>;
    };

/**
 * OpenAI-specific metadata for tool responses
 * These control how ChatGPT renders and interacts with the response
 */
export interface OpenAIResponseMetadata {
  /** Widget description surfaced to the model when the component loads */
  "openai/widgetDescription"?: string;

  /** Hint that the component should render inside a bordered card */
  "openai/widgetPrefersBorder"?: boolean;

  /** Whether the widget can call tools on its own */
  "openai/widgetAccessible"?: boolean;

  /** Whether this result can produce a widget */
  "openai/resultCanProduceWidget"?: boolean;

  /** Short status text while the tool runs */
  "openai/toolInvocation/invoking"?: string;

  /** Short status text after the tool completes */
  "openai/toolInvocation/invoked"?: string;

  /** Resource URI for component HTML template */
  "openai/outputTemplate"?: string;

  /** CSP configuration for the widget */
  "openai/widgetCSP"?: {
    connect_domains?: string[];
    resource_domains?: string[];
  };

  /** Dedicated subdomain for hosted components */
  "openai/widgetDomain"?: string;

  /** Requested locale (BCP 47) */
  "openai/locale"?: string;

  /** User agent hint for analytics or formatting */
  "openai/userAgent"?: string;

  /** Coarse location hint */
  "openai/userLocation"?: {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
    longitude?: number;
    latitude?: number;
  };

  /** Anonymized user id for rate limiting and identification */
  "openai/subject"?: string;

  /** RFC 7235 WWW-Authenticate challenges to trigger OAuth */
  "mcp/www_authenticate"?: string | string[];

  /** Legacy locale key */
  "webplus/i18n"?: string;

  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Standard MCP tool response
 * This is what your tool handlers should return
 */
export interface MCPToolResponse<
  TStructuredContent extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>
> {
  /**
   * Content surfaced to both the model and the component
   * Use this for narration and display text
   */
  content: MCPContent[];

  /**
   * Structured data surfaced to the model and the component
   * Must match the declared outputSchema when provided
   * Keep this concise - the model reads it verbatim
   */
  structuredContent?: TStructuredContent;

  /**
   * Metadata delivered ONLY to the component, hidden from the model
   * Use this for large datasets, UI-only fields, or sensitive data
   */
  _meta?: TMetadata & Partial<OpenAIResponseMetadata>;

  /**
   * Whether this response represents an error
   */
  isError?: boolean;

  /** Additional fields allowed by MCP spec */
  [key: string]: unknown;
}

/**
 * Helper to create a text content item with proper typing
 */
export const createTextContent = (text: string, meta?: Record<string, unknown>): MCPContent => ({
  type: "text" as const,
  text,
  ...(meta && { _meta: meta })
});

/**
 * Helper to create an image content item with proper typing
 */
export const createImageContent = (
  data: string,
  mimeType: string,
  meta?: Record<string, unknown>
): MCPContent => ({
  type: "image" as const,
  data,
  mimeType,
  ...(meta && { _meta: meta })
});

/**
 * Helper to create a resource content item with proper typing
 * Note: Must provide either `text` or `blob`
 */
export const createResourceContent = (
  uri: string,
  content: { text: string; mimeType?: string } | { blob: string; mimeType?: string },
  meta?: Record<string, unknown>
): MCPContent => ({
  type: "resource" as const,
  resource: {
    uri,
    ...content
  },
  ...(meta && { _meta: meta })
});

/**
 * Helper to create a complete MCP tool response with proper typing
 */
export const createMCPResponse = <
  TStructuredContent extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>
>(
  content: MCPContent[],
  options?: {
    structuredContent?: TStructuredContent;
    _meta?: TMetadata & Partial<OpenAIResponseMetadata>;
    isError?: boolean;
  }
): MCPToolResponse<TStructuredContent, TMetadata> => ({
  content,
  ...(options?.structuredContent !== undefined && { structuredContent: options.structuredContent }),
  ...(options?._meta && { _meta: options._meta }),
  ...(options?.isError !== undefined && { isError: options.isError })
});
