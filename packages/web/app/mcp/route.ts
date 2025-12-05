/**
 * MCP Proxy Route
 *
 * Forwards MCP requests to the standalone MCP server.
 * This allows the Next.js app to serve as a unified endpoint
 * while the actual MCP logic runs in the server package.
 */

import { NextRequest } from "next/server";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    // Forward the request to the MCP server
    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
        Authorization: request.headers.get("Authorization") || "",
      },
      body: await request.text(),
    });

    // Return the response from the MCP server
    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[MCP Proxy] Failed to forward request:", error);

    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "MCP server unavailable",
        },
        id: null,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
