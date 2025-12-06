/**
 * MCP Best Practice Constants
 *
 * These constants implement recommendations from docs/mcp-builder/reference/mcp_best_practices.md
 * and docs/mcp-builder/reference/node_mcp_server.md
 */

/**
 * Maximum character count for response content.
 * Prevents overwhelming the model with excessively large responses.
 * Responses exceeding this limit should be truncated with a message.
 */
export const CHARACTER_LIMIT = 25000;

/**
 * Pagination defaults following MCP best practices.
 * Tools returning lists should support limit/offset parameters.
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

/**
 * Response format options for dual output support.
 * MCP best practice: Support both human-readable (markdown) and machine-readable (json) formats.
 */
export enum ResponseFormat {
  /** Human-readable format with headers, lists, and formatting */
  MARKDOWN = "markdown",
  /** Machine-readable structured JSON output */
  JSON = "json",
}

/**
 * All MCP constants bundled for convenient import
 */
export const MCP_CONSTANTS = {
  CHARACTER_LIMIT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} as const;
