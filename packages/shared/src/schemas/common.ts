/**
 * Common Zod schemas for MCP tool input validation
 *
 * MCP Best Practice: Use strict schemas with proper constraints and descriptions.
 * See: docs/mcp-builder/reference/node_mcp_server.md#input-validation
 *
 * These schemas are designed to be composed with your tool-specific schemas:
 *
 * @example
 * ```typescript
 * const MyToolInputSchema = z.object({
 *   query: z.string().min(1).describe("Search query"),
 *   ...PaginationInputSchema.shape,
 *   ...ResponseFormatSchema.shape,
 * }).strict();
 * ```
 */

import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  ResponseFormat,
} from "../constants";

/**
 * Pagination input parameters.
 * MCP Best Practice: Support limit/offset pagination for list operations.
 */
export const PaginationInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE, `Minimum limit is ${MIN_PAGE_SIZE}`)
    .max(MAX_PAGE_SIZE, `Maximum limit is ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE)
    .describe(
      `Maximum number of results to return (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`
    ),
  offset: z
    .number()
    .int()
    .min(0, "Offset cannot be negative")
    .default(0)
    .describe("Number of results to skip for pagination (default: 0)"),
});

/**
 * Response format selection.
 * MCP Best Practice: Support both markdown and JSON output formats.
 */
export const ResponseFormatInputSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe(
      "Output format: 'markdown' for human-readable text or 'json' for structured data"
    ),
});

/**
 * Combined pagination and format schema.
 * Use when your tool supports both pagination and format selection.
 */
export const ListToolInputSchema = PaginationInputSchema.merge(
  ResponseFormatInputSchema
);

// Export types for use in tool handlers
export type PaginationInput = z.infer<typeof PaginationInputSchema>;
export type ResponseFormatInput = z.infer<typeof ResponseFormatInputSchema>;
export type ListToolInput = z.infer<typeof ListToolInputSchema>;
