/**
 * Manage Item Tool
 *
 * Create, update, or delete items.
 * Demonstrates: CRUD operations, form handling, validation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { ItemsService } from "../../services/items-service";
import { requireAuth } from "../auth";
import { createSuccessResponse, createErrorResponse } from "@axite/shared";
import type { McpContext } from "../server";
import type { ManageItemResponse } from "@axite/shared";

/**
 * Register the manage_item tool
 */
export function registerManageItemTool(server: McpServer, context: McpContext): void {
  server.tool(
    "manage_item",
    "Create, update, or delete an item. Demonstrates CRUD operations with validation.",
    {
      action: z
        .enum(["create", "update", "delete", "archive"])
        .describe("Action to perform on the item"),
      itemId: z
        .string()
        .optional()
        .describe("Item ID (required for update/delete/archive)"),
      title: z.string().optional().describe("Item title (required for create)"),
      description: z.string().optional().describe("Item description"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Custom metadata as JSON object"),
      order: z.number().optional().describe("Display order"),
    },
    async ({ action, itemId, title, description, metadata, order }): Promise<ManageItemResponse> => {
      try {
        // Check authentication and subscription
        const authCheck = await requireAuth(context.session, "manage items", {
          requireSubscription: true,
        });
        if (authCheck) return authCheck;

        let result;
        let actionPerformed: "created" | "updated" | "deleted" | "archived";

        switch (action) {
          case "create":
            if (!title) {
              return createErrorResponse("Title is required to create an item");
            }
            result = await ItemsService.createItem({
              userId: context.session!.userId,
              title,
              description,
              metadata,
              order,
            });
            actionPerformed = "created";
            break;

          case "update":
            if (!itemId) {
              return createErrorResponse("Item ID is required to update an item");
            }
            result = await ItemsService.updateItem(itemId, context.session!.userId, {
              title,
              description,
              metadata,
              order,
            });
            actionPerformed = "updated";
            break;

          case "archive":
            if (!itemId) {
              return createErrorResponse("Item ID is required to archive an item");
            }
            result = await ItemsService.archiveItem(itemId, context.session!.userId);
            actionPerformed = "archived";
            break;

          case "delete":
            if (!itemId) {
              return createErrorResponse("Item ID is required to delete an item");
            }
            result = await ItemsService.deleteItem(itemId, context.session!.userId);
            actionPerformed = "deleted";
            break;

          default:
            return createErrorResponse("Invalid action");
        }

        return createSuccessResponse(
          `Item ${actionPerformed} successfully`,
          {
            item: {
              id: result.id,
              title: result.title,
              description: result.description || undefined,
              status: result.status,
              order: result.order,
              metadata: result.metadata as Record<string, unknown> | undefined,
              createdAt: result.createdAt.toISOString(),
              updatedAt: result.updatedAt.toISOString(),
            },
            action: actionPerformed,
            message: `Item ${actionPerformed} successfully`,
          },
          {
            "openai/outputTemplate": "ui://widget/manage-item.html",
            "openai/toolInvocation/invoked": "Action completed",
          }
        );
      } catch (error) {
        logger.error("manage_item failed", { error, action, itemId });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to manage item"
        );
      }
    }
  );
}
