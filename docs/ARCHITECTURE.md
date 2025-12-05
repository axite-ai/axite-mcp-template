# Axite MCP Template - Architecture

This document describes the monorepo architecture of the Axite MCP Template.

## Overview

The template is organized as a **pnpm monorepo** with three packages:

```
axite-mcp-template/
├── packages/
│   ├── shared/     # Shared types and utilities
│   ├── server/     # Standalone Express MCP server
│   └── web/        # Next.js frontend and widgets
├── pnpm-workspace.yaml
└── package.json    # Root scripts for monorepo management
```

## Package Details

### `@axite/shared` - Shared Package

**Purpose**: Single source of truth for types and utilities used by both server and web packages.

**Structure**:
```
packages/shared/
└── src/
    ├── types/
    │   ├── mcp-responses.ts    # Core MCP response types
    │   ├── tool-responses.ts   # Tool-specific content types
    │   ├── openai-metadata.ts  # OpenAI/ChatGPT metadata types
    │   └── index.ts
    ├── utils/
    │   ├── mcp-response-helpers.ts  # Response creation helpers
    │   └── index.ts
    └── index.ts
```

**Usage**:
```typescript
import { createSuccessResponse, UserItemsContent } from "@axite/shared";
```

---

### `@axite/server` - MCP Server Package

**Purpose**: Standalone Express server handling all MCP protocol requests.

**Structure**:
```
packages/server/
└── src/
    ├── config/
    │   ├── env.ts          # Environment validation
    │   └── features.ts     # Feature flags
    ├── db/
    │   ├── index.ts        # Drizzle database instance
    │   ├── schema.ts       # Database schema
    │   └── redis.ts        # Redis client
    ├── services/
    │   ├── items-service.ts     # CRUD operations
    │   ├── weather-service.ts   # External API integration
    │   ├── logger-service.ts    # Winston logging
    │   └── index.ts
    ├── mcp/
    │   ├── server.ts       # MCP server factory
    │   ├── auth.ts         # Auth helpers (requireAuth)
    │   ├── widgets.ts      # Widget resource registry
    │   └── tools/          # Tool-per-file architecture
    │       ├── get-user-items.ts
    │       ├── manage-item.ts
    │       ├── get-weather.ts
    │       ├── calculate-roi.ts
    │       ├── manage-subscription.ts
    │       └── index.ts
    └── index.ts            # Express entry point
```

**Key Features**:
- Tool-per-file architecture (each tool is ~50-80 lines)
- Self-contained tools with their own auth checks
- Scalable to 100+ tools without file bloat
- Runs on port 3001 by default

---

### `@axite/web` - Next.js Frontend Package

**Purpose**: Serves widgets, login pages, and settings UI.

**Structure**:
```
packages/web/
├── app/
│   ├── hooks/           # Canonical hook location (single source)
│   │   ├── use-widget-props.ts
│   │   ├── use-openai-global.ts
│   │   ├── use-display-mode.ts
│   │   └── index.ts     # Re-exports all hooks
│   ├── widgets/         # Colocated widget code
│   │   ├── user-items/
│   │   │   ├── page.tsx     # Next.js route
│   │   │   └── widget.tsx   # React component
│   │   ├── weather/
│   │   │   ├── page.tsx
│   │   │   └── widget.tsx
│   │   └── ...
│   ├── login/
│   ├── pricing/
│   ├── settings/
│   ├── mcp/
│   │   └── route.ts     # Proxy to MCP server
│   └── layout.tsx
├── src/
│   ├── utils/
│   │   └── widget-auth-check.tsx
│   └── components/
│       └── shared/      # Shared UI components
└── public/
```

**Key Features**:
- Colocated widgets (page + component in same directory)
- Single canonical hooks location
- Proxy route to MCP server for unified endpoint
- Runs on port 3000 by default

---

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ChatGPT/      │────▶│  Next.js Web    │────▶│  MCP Server     │
│   Claude        │     │  (port 3000)    │     │  (port 3001)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                        │
                              │                        │
                              ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   Widgets       │     │   PostgreSQL    │
                        │   (HTML)        │     │   Redis         │
                        └─────────────────┘     └─────────────────┘
```

1. **ChatGPT/Claude** sends MCP requests to `/mcp` endpoint
2. **Next.js Web** proxies request to MCP server (or handles directly if same-origin)
3. **MCP Server** processes tool calls, queries database
4. **Response** includes widget URI referencing Next.js pages
5. **Widget HTML** is fetched from Next.js and rendered in ChatGPT iframe

---

## Development Workflow

### Running Development Servers

```bash
# Run both servers in parallel
pnpm dev

# Or run individually
pnpm dev:server   # MCP server on :3001
pnpm dev:web      # Next.js on :3000
```

### Adding a New Tool

1. **Create tool file** in `packages/server/src/mcp/tools/`:

```typescript
// packages/server/src/mcp/tools/my-tool.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createSuccessResponse } from "@axite/shared";
import type { McpContext } from "../server";

export function registerMyTool(server: McpServer, context: McpContext): void {
  server.tool(
    "my_tool",
    "Description of what the tool does",
    {
      param: z.string().describe("Parameter description"),
    },
    async ({ param }) => {
      // Tool logic here
      return createSuccessResponse("Success!", { data: param });
    }
  );
}
```

2. **Export from index** in `packages/server/src/mcp/tools/index.ts`:

```typescript
export { registerMyTool } from "./my-tool";
```

3. **Register in server** in `packages/server/src/mcp/server.ts`:

```typescript
import { registerMyTool } from "./tools";

// In createMcpServer function:
registerMyTool(server, context);
```

### Adding a New Widget

1. **Create widget directory** in `packages/web/app/widgets/my-widget/`:

```typescript
// page.tsx
import MyWidget from "./widget";

export default function MyWidgetPage() {
  return <MyWidget />;
}

// widget.tsx
"use client";
import { useWidgetProps } from "@/app/hooks";

export default function MyWidget() {
  const toolOutput = useWidgetProps();
  // Render widget
}
```

2. **Register in widgets.ts** in `packages/server/src/mcp/widgets.ts`:

```typescript
const widgets = [
  // ... existing widgets
  {
    id: "my-widget",
    title: "My Widget",
    description: "What it does",
    path: "/widgets/my-widget",
  },
];
```

---

## Key Design Decisions

### Why Monorepo?

1. **Clear boundaries** - Server and web are distinct packages
2. **Shared types** - Single source of truth prevents drift
3. **Independent deployment** - Can deploy server and web separately
4. **Scalability** - Tool-per-file scales to hundreds of tools

### Why Separate Server?

1. **Clean separation** - MCP logic isolated from UI
2. **Independent scaling** - Can scale server without web
3. **Flexibility** - Can swap web framework without touching server
4. **Testing** - Easier to test MCP logic in isolation

### Why Colocated Widgets?

1. **Discoverability** - Find page and component in same place
2. **Maintainability** - Changes to widget in one location
3. **No import confusion** - Import from `./widget` not `@/src/components/...`

### Why Canonical Hooks?

1. **Single source** - No duplication between `app/hooks` and `src/`
2. **Clear imports** - Always `from "@/app/hooks"`
3. **Easy updates** - Change hook in one place

---

## Environment Variables

Create a `.env` file at the monorepo root:

```bash
# Server
MCP_PORT=3001
WEB_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/axite
REDIS_URL=redis://localhost:6379

# Auth
BETTER_AUTH_SECRET=your-32-char-secret

# Optional: Subscriptions
ENABLE_SUBSCRIPTIONS=false
STRIPE_SECRET_KEY=sk_test_...

# Optional: Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Deployment

### Single Server Deployment (Recommended)

Both packages can be deployed as a single application:

1. Build both packages: `pnpm build`
2. Start both: `pnpm start`
3. Configure process manager (PM2) to run both

### Separate Deployment

Deploy server and web as independent services:

**Server**:
- Deploy `packages/server` to Railway/Render
- Set `MCP_PORT` and database URLs

**Web**:
- Deploy `packages/web` to Vercel
- Set `MCP_SERVER_URL` to point to server
