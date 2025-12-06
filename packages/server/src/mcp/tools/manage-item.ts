/**
 * Manage Item Tool
 *
 * Create, update, or delete items.
 * Demonstrates: CRUD operations, form handling, validation, tool annotations
 *
 * MCP Best Practices implemented:
 * - Tool naming with {service}_ prefix placeholder
 * - All four tool annotations
 * - Strict Zod schema validation
 * - Actionable error messages
 *
 * See: docs/mcp-builder/reference/mcp_best_practices.md
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { ItemsService } from "../../services/items-service";
import { requireAuth } from "../auth";
import { createSuccessResponse, createErrorResponse } from "@axite/shared";
import type { McpContext } from "../server";
import type { ManageItemResponse } from "@axite/shared";

// MCP Best Practice: Define input schema with .strict() and descriptive constraints
const ManageItemInputSchema = z
  .object({
    action: z
      .enum(["create", "update", "delete", "archive"])
      .describe("Action to perform: 'create', 'update', 'delete', or 'archive'"),
    itemId: z
      .string()
      .min(1, "Item ID cannot be empty")
      .optional()
      .describe("Item ID (required for update/delete/archive actions)"),
    title: z
      .string()
      .min(1, "Title cannot be empty")
      .max(200, "Title must be 200 characters or less")
      .optional()
      .describe("Item title (required for create, optional for update)"),
    description: z
      .string()
      .max(2000, "Description must be 2000 characters or less")
      .optional()
      .describe("Item description (optional)"),
    metadata: z
      .record(z.unknown())
      .optional()
      .describe("Custom metadata as JSON object (optional)"),
    order: z
      .number()
      .int()
      .min(0, "Order cannot be negative")
      .optional()
      .describe("Display order for sorting (optional)"),
  })
  .strict(); // MCP Best Practice: Use .strict() to reject unknown parameters

/**
 * Register the manage_item tool
 *
 * TODO: Replace {service} with your app name (e.g., myapp_manage_item)
 */
export function registerManageItemTool(server: McpServer, context: McpContext): void {
  server.tool(
    // MCP Best Practice: Tool names use {service}_action_resource format
    // TODO: Replace {service} with your app name
    "{service}_manage_item",
    `Create, update, delete, or archive an item.

Performs CRUD operations on user items with validation.

Args:
  - action: One of 'create', 'update', 'delete', 'archive'
  - itemId: Required for update/delete/archive actions
  - title: Required for create, optional for update (max 200 chars)
  - description: Optional description (max 2000 chars)
  - metadata: Optional JSON object for custom data
  - order: Optional integer for display ordering

Returns the modified item with action confirmation.`,
    {
      action: ManageItemInputSchema.shape.action,
      itemId: ManageItemInputSchema.shape.itemId,
      title: ManageItemInputSchema.shape.title,
      description: ManageItemInputSchema.shape.description,
      metadata: ManageItemInputSchema.shape.metadata,
      order: ManageItemInputSchema.shape.order,
    },
    // MCP Best Practice: Tool annotations (when SDK supports them)
    // readOnlyHint: false     - This tool modifies data
    // destructiveHint: true   - Delete action can permanently remove data
    // idempotentHint: false   - Create produces different results each time
    // openWorldHint: false    - Only modifies internal database
    async (rawParams: Record<string, unknown>): Promise<ManageItemResponse> => {
      // Validate and parse input
      const params = ManageItemInputSchema.parse(rawParams);
      const { action, itemId, title, description, metadata, order } = params;

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
              // MCP Best Practice: Actionable error messages
              return createErrorResponse(
                "Title is required to create an item. Please provide a 'title' parameter."
              );
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
              return createErrorResponse(
                "Item ID is required to update an item. Please provide an 'itemId' parameter."
              );
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
              return createErrorResponse(
                "Item ID is required to archive an item. Please provide an 'itemId' parameter."
              );
            }
            result = await ItemsService.archiveItem(itemId, context.session!.userId);
            actionPerformed = "archived";
            break;

          case "delete":
            if (!itemId) {
              return createErrorResponse(
                "Item ID is required to delete an item. Please provide an 'itemId' parameter."
              );
            }
            result = await ItemsService.deleteItem(itemId, context.session!.userId);
            actionPerformed = "deleted";
            break;

          default:
            return createErrorResponse(
              `Invalid action '${action}'. Valid actions are: create, update, delete, archive.`
            );
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
            "openai/toolInvocation/invoked": `Item ${actionPerformed}`,
          }
        );
      } catch (error) {
        logger.error("manage_item failed", { error, action, itemId });
        // MCP Best Practice: Actionable error messages
        return createErrorResponse(
          error instanceof Error
            ? `Failed to ${action} item: ${error.message}. Please verify your input and try again.`
            : `Failed to ${action} item. Please try again.`
        );
      }
    }
  );
}
