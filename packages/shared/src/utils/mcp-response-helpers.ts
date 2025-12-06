/**
 * Helper functions for creating MCP tool responses
 * These helpers ensure proper typing for all MCP tool responses
 *
 * Implements patterns from docs/mcp-builder/reference/mcp_best_practices.md
 */

import type {
  MCPToolResponse,
  OpenAIResponseMetadata,
  PaginationMeta,
} from "../types/mcp-responses";
import type { AuthChallengeContent } from "../types/tool-responses";
import { createTextContent } from "../types/mcp-responses";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants";

/**
 * Creates a generic error response that matches AuthChallengeContent structure
 * This allows error responses to be compatible with tool response union types
 */
export const createErrorResponse = (
  message: string,
  meta?: Partial<OpenAIResponseMetadata>
): MCPToolResponse<AuthChallengeContent, OpenAIResponseMetadata> => ({
  content: [createTextContent(message)],
  structuredContent: {
    message,
  },
  isError: true,
  _meta: {
    "openai/toolInvocation/invoked": "Error occurred",
    ...meta
  }
});

/**
 * Creates a success response with structured content
 */
export const createSuccessResponse = <T extends Record<string, unknown>>(
  text: string,
  structuredContent: T,
  meta?: Partial<OpenAIResponseMetadata>
) => ({
  content: [createTextContent(text)],
  structuredContent,
  ...(meta && { _meta: meta })
});

/**
 * Creates an authentication challenge response
 */
export const createAuthChallengeResponse = (
  resourceMetadataUrl: string,
  errorDescription: string = "Authentication required"
): MCPToolResponse<{ error: string }, OpenAIResponseMetadata> => ({
  content: [createTextContent(errorDescription)],
  structuredContent: {
    error: "insufficient_scope"
  },
  isError: true,
  _meta: {
    "mcp/www_authenticate": `Bearer resource_metadata="${resourceMetadataUrl}", error="insufficient_scope", error_description="${errorDescription}"`
  }
});

// ============================================================================
// PAGINATION & TRUNCATION HELPERS
// MCP Best Practice: Support pagination and prevent overwhelming responses
// See: docs/mcp-builder/reference/mcp_best_practices.md#pagination
// ============================================================================

/**
 * Truncate content if it exceeds the character limit.
 * MCP Best Practice: Prevent overwhelming the model with large responses.
 *
 * @param content - The content string to potentially truncate
 * @param limit - Maximum character count (default: CHARACTER_LIMIT)
 * @returns Object with truncated content and metadata
 */
export const truncateIfNeeded = (
  content: string,
  limit: number = CHARACTER_LIMIT
): { content: string; truncated: boolean; message?: string } => {
  if (content.length <= limit) {
    return { content, truncated: false };
  }
  return {
    content: content.slice(0, limit),
    truncated: true,
    message: `Response truncated at ${limit.toLocaleString()} characters. Use pagination or filters to retrieve more specific data.`,
  };
};

/**
 * Calculate pagination metadata for a list response.
 * MCP Best Practice: Always return has_more, next_offset, and total_count.
 *
 * @param totalCount - Total number of items available
 * @param offset - Current offset (items skipped)
 * @param limit - Items per page
 * @param returnedCount - Number of items in current response
 * @returns Complete pagination metadata
 */
export const calculatePagination = (
  totalCount: number,
  offset: number,
  limit: number,
  returnedCount: number
): PaginationMeta => {
  const hasMore = totalCount > offset + returnedCount;
  return {
    total_count: totalCount,
    count: returnedCount,
    offset,
    limit,
    has_more: hasMore,
    ...(hasMore && { next_offset: offset + returnedCount }),
  };
};

/**
 * Creates a paginated success response with structured content.
 * Use this for any tool that returns a list of items.
 *
 * @param text - Human-readable summary text
 * @param structuredContent - The data payload (items, results, etc.)
 * @param pagination - Pagination metadata from calculatePagination()
 * @param meta - Optional OpenAI metadata (widget template, etc.)
 */
export const createPaginatedResponse = <T extends Record<string, unknown>>(
  text: string,
  structuredContent: T,
  pagination: PaginationMeta,
  meta?: Partial<OpenAIResponseMetadata>
) => ({
  content: [createTextContent(text)],
  structuredContent: { ...structuredContent, pagination },
  ...(meta && { _meta: meta }),
});

// ============================================================================
// RESPONSE FORMAT HELPERS
// MCP Best Practice: Support both markdown and JSON output formats
// See: docs/mcp-builder/reference/mcp_best_practices.md#response-formats
// ============================================================================

/**
 * Format data based on requested response format.
 * MCP Best Practice: Support dual formats for flexibility.
 *
 * @param data - The data to format
 * @param format - Requested format (markdown or json)
 * @param markdownFormatter - Custom function to format data as markdown
 * @returns Formatted string
 */
export const formatResponse = <T>(
  data: T,
  format: ResponseFormat,
  markdownFormatter?: (data: T) => string
): string => {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(data, null, 2);
  }
  // Use custom formatter or fall back to JSON
  return markdownFormatter?.(data) ?? JSON.stringify(data, null, 2);
};

// Re-export for convenience
export { ResponseFormat } from "../constants";
