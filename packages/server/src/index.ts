/**
 * Axite MCP Server - Standalone Express Server
 *
 * This is the main entry point for the MCP server.
 * It handles all MCP protocol requests and tool registrations.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "./services/logger-service";
import { createMcpServer } from "./mcp/server";
import { loadEnv } from "./config/env";

// Load environment variables
loadEnv();

const app = express();
const PORT = process.env.MCP_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.WEB_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// MCP endpoint
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    logger.debug("[MCP] Incoming request", {
      method: req.method,
      path: req.path,
      headers: {
        authorization: req.headers.authorization ? "***" : undefined,
        "content-type": req.headers["content-type"],
      },
    });

    // Create MCP server instance for this request
    const server = await createMcpServer(req);

    // Create transport and handle request
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await server.connect(transport);

    // Handle the request
    const response = await transport.handleRequest(req, res);

    return response;
  } catch (error) {
    logger.error("[MCP] Request failed", { error });
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal server error",
      },
      id: null,
    });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("[Server] Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  logger.info(`[Server] MCP Server running on port ${PORT}`);
  logger.info(`[Server] Health check: http://localhost:${PORT}/health`);
  logger.info(`[Server] MCP endpoint: http://localhost:${PORT}/mcp`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("[Server] Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("[Server] Received SIGINT, shutting down...");
  process.exit(0);
});
