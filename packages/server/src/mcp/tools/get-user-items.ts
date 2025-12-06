/**
 * Get User Items Tool
 *
 * Retrieves all items for the authenticated user with pagination support.
 * Demonstrates: Data fetching, pagination, response formats, tool annotations
 *
 * MCP Best Practices implemented:
 * - Tool naming with {service}_ prefix placeholder
 * - All four tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
 * - Pagination with limit/offset and has_more/next_offset
 * - Response format support (markdown/json)
 * - Strict Zod schema validation
 *
 * See: docs/mcp-builder/reference/mcp_best_practices.md
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { ItemsService } from "../../services/items-service";
import { requireAuth } from "../auth";
import {
  createSuccessResponse,
  createErrorResponse,
  calculatePagination,
  ResponseFormat,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@axite/shared";
import type { McpContext } from "../server";
import type { UserItemsResponse } from "@axite/shared";

// MCP Best Practice: Define input schema with .strict() and descriptive constraints
const GetUserItemsInputSchema = z
  .object({
    status: z
      .enum(["active", "archived", "deleted"])
      .default("active")
      .describe("Filter items by status (default: active)"),
    limit: z
      .number()
      .int()
      .min(MIN_PAGE_SIZE, `Minimum limit is ${MIN_PAGE_SIZE}`)
      .max(MAX_PAGE_SIZE, `Maximum limit is ${MAX_PAGE_SIZE}`)
      .default(DEFAULT_PAGE_SIZE)
      .describe(
        `Maximum number of items to return (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`
      ),
    offset: z
      .number()
      .int()
      .min(0, "Offset cannot be negative")
      .default(0)
      .describe("Number of items to skip for pagination (default: 0)"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
  })
  .strict(); // MCP Best Practice: Use .strict() to reject unknown parameters

type GetUserItemsInput = z.infer<typeof GetUserItemsInputSchema>;

/**
 * Register the get_user_items tool
 *
 * TODO: Replace {service} with your app name (e.g., myapp_get_user_items)
 */
export function registerGetUserItemsTool(server: McpServer, context: McpContext): void {
  server.tool(
    // MCP Best Practice: Tool names use {service}_action_resource format
    // TODO: Replace {service} with your app name
    "{service}_get_user_items",
    `Retrieve items for the authenticated user with pagination support.

Returns a paginated list of user items filtered by status. Use offset parameter
to fetch additional pages when has_more is true.

Args:
  - status: Filter by item status - 'active', 'archived', or 'deleted' (default: active)
  - limit: Maximum items to return, 1-${MAX_PAGE_SIZE} (default: ${DEFAULT_PAGE_SIZE})
  - offset: Number of items to skip for pagination (default: 0)
  - response_format: Output format - 'markdown' or 'json' (default: markdown)

Returns pagination metadata including:
  - total_count: Total items available
  - has_more: Whether more pages exist
  - next_offset: Offset for next page (if has_more is true)`,
    {
      status: GetUserItemsInputSchema.shape.status,
      limit: GetUserItemsInputSchema.shape.limit,
      offset: GetUserItemsInputSchema.shape.offset,
      response_format: GetUserItemsInputSchema.shape.response_format,
    },
    // MCP Best Practice: Tool annotations (when SDK supports them)
    // readOnlyHint: true      - This tool only reads data
    // destructiveHint: false  - Never deletes or modifies data
    // idempotentHint: true    - Same input always returns same output
    // openWorldHint: false    - Only queries internal database
    async (rawParams: Record<string, unknown>): Promise<UserItemsResponse> => {
      // Validate and parse input with defaults
      const params = GetUserItemsInputSchema.parse(rawParams);
      const { status, limit, offset, response_format } = params;

      try {
        // Check authentication and subscription
        const authCheck = await requireAuth(context.session, "user items", {
          requireSubscription: true,
        });
        if (authCheck) return authCheck;

        const userId = context.session!.userId;

        // MCP Best Practice: Fetch total count for pagination metadata
        const totalCount = await ItemsService.countUserItems(userId, status);

        // Fetch items from database with pagination
        const items = await ItemsService.getUserItems(userId, {
          status,
          limit,
          offset,
        });

        // MCP Best Practice: Calculate pagination metadata
        const pagination = calculatePagination(totalCount, offset, limit, items.length);

        // Format items for response
        const formattedItems = items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description || undefined,
          status: item.status,
          order: item.order,
          metadata: item.metadata as Record<string, unknown> | undefined,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }));

        // MCP Best Practice: Format response based on requested format
        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          textContent = formatAsMarkdown(formattedItems, pagination, status);
        } else {
          textContent = `Found ${pagination.total_count} ${status} item(s). Showing ${pagination.count} starting at offset ${pagination.offset}.`;
        }

        return createSuccessResponse(
          textContent,
          {
            items: formattedItems,
            pagination,
          },
          {
            "openai/outputTemplate": "ui://widget/user-items.html",
            "openai/toolInvocation/invoked": `Loaded ${pagination.count} items`,
          }
        );
      } catch (error) {
        logger.error("get_user_items failed", { error });
        // MCP Best Practice: Return actionable error messages
        return createErrorResponse(
          error instanceof Error
            ? `Failed to fetch items: ${error.message}. Please try again or contact support.`
            : "Failed to fetch items. Please try again."
        );
      }
    }
  );
}

/**
 * Format items as human-readable markdown
 */
function formatAsMarkdown(
  items: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    createdAt: string;
  }>,
  pagination: { total_count: number; count: number; has_more: boolean; offset: number },
  status: string
): string {
  const lines: string[] = [
    `# ${status.charAt(0).toUpperCase() + status.slice(1)} Items`,
    "",
    `Found **${pagination.total_count}** ${status} item(s). Showing ${pagination.count} starting at offset ${pagination.offset}.`,
    "",
  ];

  if (items.length === 0) {
    lines.push("*No items found matching your criteria.*");
  } else {
    for (const item of items) {
      lines.push(`## ${item.title}`);
      if (item.description) {
        lines.push(item.description);
      }
      lines.push(`- **ID**: \`${item.id}\``);
      lines.push(`- **Created**: ${new Date(item.createdAt).toLocaleDateString()}`);
      lines.push("");
    }
  }

  if (pagination.has_more) {
    lines.push("---");
    lines.push(
      `*More items available. Use \`offset: ${pagination.offset + pagination.count}\` to see the next page.*`
    );
  }

  return lines.join("\n");
}
