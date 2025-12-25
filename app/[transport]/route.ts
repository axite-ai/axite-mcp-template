/**
 * MCP Server Route Handler
 *
 * This is the core of your ChatGPT MCP application.
 * Register your tools here and define their behavior.
 *
 * Route structure:
 * - POST /mcp - Streamable HTTP transport (main MCP endpoint)
 * - GET /sse - Server-Sent Events transport
 * - POST /message - SSE message endpoint
 *
 * TEMPLATE: Add your own tools following the patterns below
 */

import { z } from "zod";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@/lib/auth";
import { baseURL } from "@/baseUrl";
import { logger } from "@/lib/services/logger-service";
import { createMcpHandler } from "mcp-handler";
import { createSuccessResponse } from "@/lib/utils/mcp-response-helpers";

// ============================================================================
// TOOL DEFINITIONS
// Define your tools here with their schemas and handlers
// ============================================================================

const tools = {
  hello_world: {
    title: "Say Hello",
    description: "Say hello to the world. A simple example to start with.",
    inputSchema: {
      name: z.string().optional().describe("Your name"),
    },
    widgetPath: "/widgets/hello-world",
    // Mark as read-only (doesn't modify data)
    readOnly: true,
    handler: async ({ name = "World" }: { name?: string }) => {
      return createSuccessResponse(
        `Hello, ${name}!`,
        {
          greeting: `Hello, ${name}!`,
          name,
          timestamp: new Date().toISOString(),
        },
        {
          "openai/outputTemplate": "ui://widget/hello-world",
          "openai/widgetAccessible": true,
        }
      );
    },
  },
};

// Export type for frontend type inference
export type AppType = {
  hello_world: {
    input: { name?: string };
    result: {
      content: { type: "text"; text: string }[];
      structuredContent: { greeting: string; name: string; timestamp: string };
    };
  };
};

// ============================================================================
// MCP HANDLER WITH OAUTH
// ============================================================================

const handler = withMcpAuth(auth, async (req: Request, session: any) => {
  // Clone request to read body for logging (body can only be read once)
  const clonedReq = req.clone();
  let requestBody: any = null;
  try {
    requestBody = await clonedReq.json();
    logger.info("[MCP] Incoming request:", {
      method: requestBody.method,
      id: requestBody.id,
      params: requestBody.params,
    });
  } catch (e) {
    logger.debug("[MCP] Could not parse request body for logging");
  }

  // Log session details for debugging
  logger.debug("[MCP] Session received:", {
    hasSession: !!session,
    userId: session?.userId,
    scopes: session?.scopes,
  });

  // Create MCP handler with tools registered directly
  const mcpHandler = createMcpHandler(
    (server) => {
      // Register each tool from our definitions
      for (const [name, tool] of Object.entries(tools)) {
        const resourceUri = `ui://widget/${name}.html`;

        logger.debug(`[MCP] Registering tool: ${name}`);

        // Register the tool with full OpenAI metadata support
        server.registerTool(
          name,
          {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            // Mark read-only tools so ChatGPT knows they don't modify data
            annotations: tool.readOnly ? { readOnlyHint: true } : undefined,
            // Link tool to its widget template
            _meta: {
              "openai/outputTemplate": resourceUri,
              "openai/toolInvocation/invoking": `Running ${tool.title}...`,
              "openai/toolInvocation/invoked": `${tool.title} complete`,
              // Allow widget to call tools via window.openai.callTool
              "openai/widgetAccessible": true,
            },
          },
          async (args: any) => {
            logger.debug(`[MCP] Tool called: ${name}`, { args });
            return tool.handler(args);
          }
        );

        // NOTE: Resource registration is handled by createSuccessResponse via createUIResource
        // The Apps SDK adapter automatically creates the resource with proper MIME type and scripts
      }
    },
    {
      // Server capabilities
      capabilities: {
        tools: {},
        resources: {},
      },
    },
    {
      // Handler configuration
      basePath: "/",
      verboseLogs: true,
      redisUrl: process.env.REDIS_URL,
    }
  );

  const response = await mcpHandler(req);

  // Log the response for debugging
  const responseClone = response.clone();
  try {
    const responseBody = await responseClone.text();
    logger.info("[MCP] Response:", {
      status: response.status,
      method: requestBody?.method,
      body: responseBody.substring(0, 500),
    });
  } catch (e) {
    logger.debug("[MCP] Could not log response body");
  }

  return response;
});

export const POST = handler;
export const GET = handler;
export const DELETE = handler;
