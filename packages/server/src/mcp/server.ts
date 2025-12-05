/**
 * MCP Server Factory
 *
 * Creates and configures the MCP server instance with all tools registered.
 * This is the central point where all tools are assembled.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Request } from "express";
import { logger } from "../services/logger-service";
import { registerWidgets } from "./widgets";
import { registerGetUserItemsTool } from "./tools/get-user-items";
import { registerManageItemTool } from "./tools/manage-item";
import { registerGetWeatherTool } from "./tools/get-weather";
import { registerCalculateRoiTool } from "./tools/calculate-roi";
import { registerManageSubscriptionTool } from "./tools/manage-subscription";
import { getSessionFromRequest, type McpSession } from "./auth";

export interface McpContext {
  session: McpSession | null;
  request: Request;
}

/**
 * Create and configure the MCP server with all tools
 */
export async function createMcpServer(req: Request): Promise<McpServer> {
  // Extract session from request
  const session = await getSessionFromRequest(req);

  logger.debug("[MCP] Creating server with session", {
    hasSession: !!session,
    userId: session?.userId,
  });

  // Create MCP server instance
  const server = new McpServer(
    {
      name: "axite-mcp-server",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Create context object shared by all tools
  const context: McpContext = {
    session,
    request: req,
  };

  // Register widget resources
  registerWidgets(server, context);

  // Register tools - each tool is self-contained in its own file
  registerGetUserItemsTool(server, context);
  registerManageItemTool(server, context);
  registerGetWeatherTool(server, context);
  registerCalculateRoiTool(server, context);
  registerManageSubscriptionTool(server, context);

  logger.info("[MCP] Server created with all tools registered");

  return server;
}
