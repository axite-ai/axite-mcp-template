// Minimal mock MCP server with OAuth-style 401 challenge using Express.
// Run with: pnpm mock:mcp

const path = require("path");
const { randomUUID } = require("crypto");

const modulePaths = [__dirname, path.join(__dirname, "packages/server/node_modules")];

const requireFromRootOrServer = (id) => {
  const resolved = require.resolve(id, { paths: modulePaths });
  return require(resolved);
};

const express = requireFromRootOrServer("express");

const MCP_PATH = "/mcp";
const PORT = process.env.MOCK_MCP_PORT || 3001;
const WWW_AUTH_HEADER =
  'Bearer realm="mock-realm", error="invalid_token", error_description="The access token is missing"';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Content-Type",
};

function setCors(res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
}

async function createMcpTransport() {
  const resolveModule = (id) => require.resolve(id, { paths: modulePaths });

  const { Server } = await import(resolveModule("@modelcontextprotocol/sdk/server/index.js"));
  const { StreamableHTTPServerTransport } = await import(
    resolveModule("@modelcontextprotocol/sdk/server/streamableHttp.js")
  );

  const server = new Server({
    name: "Mock MCP Server",
    version: "0.1.0",
    capabilities: {},
  });

  server.tool(
    "ping",
    { description: "Responds with a simple pong message." },
    async () => ({
      content: [{ type: "text", text: "pong from mock server" }],
    })
  );

  server.tool(
    "echo",
    {
      description: "Echoes text back to the client.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
    async ({ text }) => ({
      content: [{ type: "text", text: `echo: ${text}` }],
    })
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);
  return transport;
}

async function main() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    setCors(res);
    res.json({ status: "ok", service: "mock-mcp" });
  });

  app.options(MCP_PATH, (_req, res) => {
    setCors(res);
    res.status(204).end();
  });

  app.post(MCP_PATH, async (req, res) => {
    setCors(res);

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res
        .status(401)
        .set("WWW-Authenticate", WWW_AUTH_HEADER)
        .json({
          jsonrpc: "2.0",
          error: { code: 401, message: "Unauthorized" },
          id: null,
        });
    }

    try {
      const transport = await createMcpTransport();
      return transport.handleRequest(req, res);
    } catch (error) {
      console.error("[Mock MCP] Failed to handle request:", error);
      return res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`Mock MCP Server running on http://localhost:${PORT}${MCP_PATH}`);
    console.log("Tools: ping, echo");
    console.log('Auth: send Authorization: Bearer <token> to avoid 401 with WWW-Authenticate');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
