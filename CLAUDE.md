# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Axite MCP Template** is a production-ready starter template for building ChatGPT MCP applications using **Next.js 15**, **MCP-UI**, and **Better Auth**.

It is designed to be **Type-Safe End-to-End**:
- Backend tools define their shape via `AppType`.
- Frontend widgets import these types for full autocomplete.
- MCP-UI hooks provide SSR-compatible widget development.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server (with Turbopack)
pnpm dev

# Production build
pnpm build

# Type checking (CRITICAL: Run this often)
pnpm typecheck

# Database operations
pnpm db:push         # Push schema to database
pnpm db:studio       # Launch Drizzle Studio GUI
```

## Architecture

### @mcp-ui Integration Architecture

This project uses @mcp-ui for widget rendering with the following architecture:

**How It Works:**

1. **Server-side (@mcp-ui/server):**
   - `createUIResource()` creates UI resources with Apps SDK adapter
   - Apps SDK adapter automatically injects scripts into iframe HTML
   - These scripts populate `window.openai` with Apps SDK API

2. **Client-side (Custom Hooks):**
   - `src/mcp-ui-hooks.ts` provides type-safe hooks to access `window.openai`
   - These are custom hooks, NOT from @mcp-ui/client
   - @mcp-ui/client only exports `UIResourceRenderer` (for Remote DOM) and utilities

3. **Widget Pattern:**
   - Widgets are served as external iframes (`externalUrl` type)
   - Apps SDK adapter script runs in iframe and creates `window.openai`
   - Widget components use custom hooks to access `window.openai`

**Why Custom Hooks?**

@mcp-ui/client does NOT provide React hooks. Our custom hooks bridge:
- @mcp-ui/server's Apps SDK adapter (which populates `window.openai`)
- React widgets that need type-safe access to Apps SDK APIs

**Available Hooks** (from `src/mcp-ui-hooks.ts`):
- `useToolInfo()` - Access tool output and metadata
- `useDisplayMode()` - Get/set display mode
- `useWidgetState<T>()` - Persistent widget state
- `useTheme()` - Current theme
- `useCallTool()` - Call other tools (type-safe)
- `useSendFollowUpMessage()` - Send messages
- `useOpenExternal()` - Open external URLs
- `useOpenAiGlobal(key)` - Access global values

### 1. MCP Server (`app/[transport]/route.ts`)

- **mcp-handler**: Uses `createMcpHandler()` with Better Auth OAuth
- **Response Helpers**: Use `createSuccessResponse()` from `@/lib/utils/mcp-response-helpers`
- **UIResource Creation**: `createSuccessResponse()` uses @mcp-ui/server's `createUIResource()` with Apps SDK adapter
- **AppType Export**: Exports `type AppType` for frontend type inference

**Adding a Tool:**

```typescript
// app/[transport]/route.ts
server.registerTool(
  "tool_name",
  {
    title: "Tool Title",
    description: "Tool description",
    inputSchema: { name: z.string().optional() },
    annotations: { readOnlyHint: true }, // Mark as read-only if applicable
    _meta: {
      "openai/outputTemplate": "ui://widget/tool_name.html",
      "openai/toolInvocation/invoking": "Running...",
      "openai/toolInvocation/invoked": "Complete",
      "openai/widgetAccessible": true, // Allow widget to call tools
    },
  },
  async (args) => {
    return {
      content: [{ type: "text", text: "Hello!" }],
      structuredContent: { greeting: "Hello", name: args.name },
    };
  }
);
```

### 2. Frontend Widgets (`app/widgets/*` & `src/components/*`)

- **Pages**: `app/widgets/my-widget/page.tsx` renders the widget component.
- **Components**: `src/components/my-widget/index.tsx` contains the logic.
- **Layout**: `app/widgets/layout.tsx` prevents SSR (required for browser-only hooks).
- **Hooks**: **ALWAYS** import from `@/src/mcp-ui-hooks` (not directly from packages).

**Widget Pattern:**

```tsx
"use client";
import { useToolInfo } from "@/src/mcp-ui-hooks";
import type { MyContentType } from "@/lib/types/tool-responses";

export default function MyWidget() {
  const { output } = useToolInfo();
  const data = output as { structuredContent: MyContentType } | undefined;

  if (!data?.structuredContent) {
    return <div>Loading...</div>;
  }

  return <div>{data.structuredContent.greeting}</div>;
}
```

### 3. Widgets Layout (`app/widgets/layout.tsx`)

**CRITICAL**: This layout prevents SSR for all widgets. MCP-UI hooks require browser context (`window.openai`) which isn't available during server-side rendering.

```tsx
"use client";
export default function WidgetsLayout({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}
```

### 4. MCP-UI Hooks (`src/mcp-ui-hooks.ts`)

- **Single Source of Truth**: Custom hooks that interface with the Apps SDK `window.openai` API.
- **Type-Safe**: All hooks are typed based on `AppType` from the server.
- **Available Hooks**: `useToolInfo`, `useCallTool`, `useWidgetState`, `useTheme`, `useDisplayMode`, `useSendFollowUpMessage`, `useOpenExternal`, `useOpenAiGlobal`.

**Hook Migration Notes:**
- `useToolInfo()` returns `{ isSuccess, output, responseMetadata }`
- `useDisplayMode()` returns `[displayMode, requestDisplayMode]` tuple
- `useCallTool()` is fully typed based on `AppType`

### 5. Authentication (`lib/auth/index.ts`)

- **Better Auth**: Handles OAuth 2.1 interaction with ChatGPT.
- **Stripe**: Optional subscription support via plugin.
- **Helper**: Use `requireAuth(session, "feature")` in tools to enforce login/billing.

### 6. Database (`lib/db/schema.ts`)

- **Drizzle ORM**: Type-safe database definition.
- **Migrations**: `pnpm db:push` to sync schema changes.

## Widget CSP (Content Security Policy)

Widgets run in a ChatGPT iframe with strict CSP. To load CSS/JS from your server, add your domain to the resource's `_meta`:

```typescript
"openai/widgetCSP": {
  connect_domains: [baseURL],  // For API calls
  resource_domains: [baseURL], // For CSS/JS
}
```

**Important**: Set `BASE_URL` in your `.env` to your public URL (e.g., ngrok URL for development).

## Best Practices

1. **Import from `@/src/mcp-ui-hooks`**: Always use this for hooks, never import from packages directly.
2. **Type Casting**: Cast `output` to your content type: `output as { structuredContent: MyType } | undefined`.
3. **No Magic Strings**: Tool names in `useCallTool("tool_name")` are validated against `AppType`.
4. **Bootstrap**: `app/layout.tsx` includes `<NextChatSDKBootstrap>`. Do not remove it.
5. **Feature Flags**: Use `lib/config/features.ts` to toggle optional modules like Subscriptions.
6. **Read-Only Tools**: Add `annotations: { readOnlyHint: true }` to tools that don't modify data.
7. **Widget Linking**: Add `_meta["openai/outputTemplate"]` to link tools to their widget resources.
8. **Widget Tool Access**: Add `_meta["openai/widgetAccessible"]: true` to allow widgets to call tools.
9. **CSP Configuration**: Add your domain to `resource_domains` to allow CSS/JS loading.
10. **Run typecheck**: Use `pnpm typecheck` frequently to catch type errors early.

## Path Aliases

TypeScript path alias: `@/*` maps to project root (e.g., `@/lib/auth` → `/lib/auth`)

## Environment Variables

Required variables (see `.env.example`):
- `POSTGRES_*` - PostgreSQL connection
- `REDIS_URL` - Redis connection string
- `BETTER_AUTH_SECRET` - Session signing secret
- `BETTER_AUTH_URL` - Base URL for OAuth redirects
- `BASE_URL` - Public URL for your deployment (used for widget CSP)

## Deployment

Base URL auto-detection via `baseUrl.ts`:
- **Railway**: `RAILWAY_PUBLIC_DOMAIN` or `RAILWAY_STATIC_URL`
- **Vercel**: `VERCEL_URL` (auto-set by Vercel)
- **Local development**: Falls back to `http://localhost:3000`
