/**
 * Get User Items Tool
 *
 * Retrieves all items for the authenticated user.
 * Demonstrates: Simple data fetching, database queries, widget rendering
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { ItemsService } from "../../services/items-service";
import { requireAuth } from "../auth";
import { createSuccessResponse, createErrorResponse } from "@axite/shared";
import type { McpContext } from "../server";
import type { UserItemsResponse } from "@axite/shared";

/**
 * Register the get_user_items tool
 */
export function registerGetUserItemsTool(server: McpServer, context: McpContext): void {
  server.tool(
    "get_user_items",
    "Retrieve all items for the authenticated user. Shows how to fetch and display data.",
    {
      status: z
        .enum(["active", "archived", "deleted"])
        .optional()
        .describe("Filter by item status (default: active)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of items to return (default: 50)"),
    },
    async ({ status = "active", limit = 50 }): Promise<UserItemsResponse> => {
      try {
        // Check authentication and subscription
        const authCheck = await requireAuth(context.session, "user items", {
          requireSubscription: true,
        });
        if (authCheck) return authCheck;

        // Fetch items from database
        const items = await ItemsService.getUserItems(context.session!.userId, {
          status: status as "active" | "archived" | "deleted",
          limit,
        });

        // Format response
        return createSuccessResponse(
          `Found ${items.length} ${status} item${items.length !== 1 ? "s" : ""}`,
          {
            items: items.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description || undefined,
              status: item.status,
              order: item.order,
              metadata: item.metadata as Record<string, unknown> | undefined,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
            })),
            totalItems: items.length,
            displayedItems: items.length,
          },
          {
            "openai/outputTemplate": "ui://widget/user-items.html",
            "openai/toolInvocation/invoked": "Items loaded",
          }
        );
      } catch (error) {
        logger.error("get_user_items failed", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to fetch items"
        );
      }
    }
  );
}
