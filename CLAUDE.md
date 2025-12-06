# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Axite MCP Template** is a production-ready starter template for building ChatGPT MCP (Model Context Protocol) applications using Next.js 15. It features OAuth 2.1 authentication via Better Auth, optional Stripe subscriptions, and a complete example implementation with 5 MCP tools and 4 interactive widgets.

This is a **template repository** - developers clone it to build their own MCP applications. All example code (tools, widgets, services) is designed to demonstrate best practices and be easily replaced with custom implementations.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server (with Turbopack)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typecheck           # One-time check
pnpm typecheck:watch     # Watch mode

# Linting
pnpm lint

# Database operations
pnpm db:push         # Push schema to database (recommended for dev)
pnpm db:generate     # Generate migrations
pnpm db:migrate      # Apply migrations
pnpm db:studio       # Launch Drizzle Studio GUI
pnpm db:schema       # Regenerate schema from Better Auth config

# Testing
pnpm test            # Run Vitest tests
pnpm test:e2e        # Run Playwright E2E tests

# Code generation (coming soon)
pnpm generate:tool   # Scaffold a new MCP tool
pnpm generate:widget # Scaffold a new widget
```

## Architecture

### Type System for MCP Responses

The project uses a comprehensive, type-safe system for MCP tool responses based on the OpenAI Apps SDK specification:

**Core Type Files:**
- `lib/types/mcp-responses.ts` - Base MCP types (`MCPContent`, `MCPToolResponse`, `OpenAIResponseMetadata`)
- `lib/types/tool-responses.ts` - Application-specific structured content types
- `lib/utils/mcp-response-helpers.ts` - Helper functions for creating responses

**Key Features:**
- Type-safe content creation with literal types (`type: "text"` not `type: string`)
- Proper OpenAI metadata typing for widget configuration
- Helper functions that eliminate boilerplate:
  - `createSuccessResponse(text, structuredContent, meta?)` - Standard success responses
  - `createErrorResponse(message, meta?)` - Error responses

**Example Usage in MCP Tools:**
```typescript
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/mcp-response-helpers";
import type { UserItemsResponse } from "@/lib/types/tool-responses";

server.registerTool("get_user_items", config, async () => {
  try {
    const items = await ItemsService.getUserItems(userId);

    return createSuccessResponse(
      `Found ${items.length} items`,
      {
        items: items,
        totalItems: items.length,
        displayedItems: items.length,
      }
    );
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch items"
    );
  }
});
```

### MCP Server (`app/mcp/route.ts`)

The core of the application. Registers MCP tools that ChatGPT can invoke.

**Current Example Tools:**

**Authenticated Tools (require OAuth + subscription):**
- `get_user_items` - Fetch user's items from database
- `manage_item` - Create/update/delete items (CRUD example)

**Free Tools (no authentication required):**
- `get_weather` - Fetch weather data from external API (demonstrates API integration)
- `calculate_roi` - Calculate investment returns (demonstrates calculations/forms)

**Optional Tools (based on feature flags):**
- `manage_subscription` - Stripe billing portal (only registered if `ENABLE_SUBSCRIPTIONS=true`)

All authenticated tools use the `requireAuth()` helper which implements a two-tier authorization pattern:
1. Check if user is logged in (OAuth session)
2. Check if user has active subscription (via `hasActiveSubscription()`)

The `requireAuth()` helper from `lib/utils/mcp-auth-helpers.ts` provides a DRY way to implement these checks consistently.

### Authentication (`lib/auth/index.ts`)

Uses Better Auth with plugins:
- **MCP plugin**: Provides OAuth 2.1 flows for ChatGPT/Claude integration with trusted clients (`chatgpt.com`, `claude.ai`)
- **Stripe plugin** (optional): Manages subscriptions with trial support
- **Passkey plugin** (optional): WebAuthn for additional security

Session data stored in PostgreSQL. Rate limiting and caching use Redis.

### Data Layer

**Services:**
- `lib/services/items-service.ts` - CRUD operations for `userItems` table (example)
- `lib/services/weather-service.ts` - External API integration with caching (example)
- `lib/services/logger-service.ts` - Winston logging
- `lib/services/rate-limit-service.ts` - Rate limiting with Redis
- `lib/services/email-service.ts` - Resend integration for transactional emails

**Database:**
- PostgreSQL for user data, sessions, subscriptions
- Redis for rate limiting and caching
- Drizzle ORM for type-safe database operations
- Schema defined in `lib/db/schema.ts`

**Example Tables (customize for your app):**
- `userItems` - Generic CRUD resource demonstrating typical patterns
- `appSettings` - Application-level configuration
- `auditLogs` - Event logging and audit trail

### Feature Flags (`lib/config/features.ts`)

Optional features can be enabled/disabled via environment variables:

```typescript
export const FEATURES = {
  SUBSCRIPTIONS: process.env.ENABLE_SUBSCRIPTIONS === "true",
  PASSKEYS: process.env.ENABLE_PASSKEYS !== "false", // Enabled by default
};
```

This allows developers to:
- Disable Stripe subscriptions entirely if not needed
- Add custom feature flags for their application
- Conditionally register MCP tools based on enabled features

### ChatGPT Widget Integration

**Critical Configuration:**

1. **Asset Prefix** (`next.config.ts`): Set to `baseURL` to prevent 404s on `/_next/` assets when rendered in ChatGPT iframes

2. **CORS Middleware** (`middleware.ts`): Handles OPTIONS preflight requests for cross-origin RSC fetching during client-side navigation

3. **SDK Bootstrap** (`app/layout.tsx`): `<NextChatSDKBootstrap>` patches browser APIs to work in ChatGPT iframes:
   - `history.pushState/replaceState` - Prevents full-origin URLs
   - `window.fetch` - Rewrites same-origin requests to correct base URL
   - `<html>` attribute observer - Prevents ChatGPT from modifying root element

4. **Widget Resources**: Tools link to widgets via `templateUri` in OpenAI metadata (e.g., `"ui://widget/user-items.html"`)

### Widget Architecture Pattern

**CRITICAL: This is the most important pattern to follow when building widgets.**

1. **Widgets are View-Only Components:** Widgets display the structured content returned by MCP tools; they never issue data fetches on their own during initial render.

2. **Single Source of Truth:** Only read from `toolOutput` (structured content) and `toolMetadata` (widget-only hints). Missing data should be surfaced to the user, not patched by new requests.

3. **No Server Actions on Mount:** Avoid calling server actions inside `useEffect` when `toolOutput` is `null`. ChatGPT/Claude iframes block those unauthenticated calls, causing false errors.

4. **Server Actions Only for User Interactions:** Server actions are valid when invoked via explicit user interactions (buttons, forms). The Apps SDK forwards credentials for those calls.

5. **Auth Checks:** Always run `checkWidgetAuth(toolOutput)` before rendering so auth/subscription responses from MCP tools short-circuit reliably.

6. **Handle Missing Data Gracefully:** If `toolOutput` is missing, show an empty state or instructions instead of firing server actions.

**✅ Correct implementation (hydrate from MCP props only):**
```tsx
import { useWidgetProps } from "@openai/widget-sdk";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import type { UserItemsContent } from "@/lib/types/tool-responses";

export default function UserItemsWidget() {
  const toolOutput = useWidgetProps<{ structuredContent: UserItemsContent }>();

  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  if (!toolOutput?.structuredContent) {
    return <EmptyState message="No items yet." />;
  }

  const { items } = toolOutput.structuredContent;

  return (
    <div>
      {items.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

**❌ Incorrect anti-pattern (server action on mount):**
```tsx
useEffect(() => {
  if (!toolOutput) {
    void getDataFromServer(); // ❌ Server action - will fail in iframe
  }
}, [toolOutput]);
```

### Environment Variables

Required variables (see `.env.example`):
- `POSTGRES_*` - PostgreSQL connection (host, port, database, user, password)
- `REDIS_URL` - Redis connection string
- `BETTER_AUTH_SECRET` - Session signing secret (generate with `openssl rand -base64 32`)
- `BETTER_AUTH_URL` - Base URL for OAuth redirects
- `ENCRYPTION_KEY` - 32-byte hex key for encrypting sensitive data (generate with `openssl rand -hex 32`)

**Optional** (based on feature flags):
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe API keys (if `ENABLE_SUBSCRIPTIONS=true`)
- `STRIPE_*_PRICE_ID` - Price IDs for subscription plans
- `RESEND_API_KEY` - Resend API key for emails

Auto-detected in deployment: `VERCEL_URL`, `RAILWAY_PUBLIC_DOMAIN`

## Working with MCP Tools

When adding new tools to `app/mcp/route.ts`:

### 1. Define Structured Content Type

Add your tool's structured content type to `lib/types/tool-responses.ts`:

```typescript
export interface MyToolContent {
  data: string[];
  count: number;
  metadata?: Record<string, unknown>;
}

export type MyToolResponse = MCPToolResponse<
  MyToolContent,
  OpenAIResponseMetadata
>;
```

### 2. Register the Tool

```typescript
import { createSuccessResponse, createErrorResponse } from "@/lib/utils/mcp-response-helpers";
import { requireAuth } from "@/lib/utils/mcp-auth-helpers";

server.registerTool(
  "my_tool_name",
  {
    title: "My Tool Title",
    description: "What this tool does",
    inputSchema: {
      param1: z.string().describe("First parameter"),
      param2: z.number().optional().describe("Optional parameter"),
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/my-widget.html",
      "openai/toolInvocation/invoking": "Processing...",
      "openai/toolInvocation/invoked": "Done!",
      "openai/widgetAccessible": true,
    },
    annotations: {
      readOnlyHint: true,      // Does it modify data?
      destructiveHint: false,  // Is it destructive?
      openWorldHint: false,    // Does it call external APIs?
    },
    securitySchemes: [{ type: "oauth2", scopes: ["my:scope"] }],
  } as any,
  async ({ param1, param2 }) => {
    try {
      // Auth check (customize based on your needs)
      const authCheck = await requireAuth(session, "my feature", {
        requireSubscription: true,  // Set to false for free tier
      });
      if (authCheck) return authCheck;

      // Business logic
      const result = await myBusinessLogic(param1, param2);

      // Type-safe response
      return createSuccessResponse(
        `Processed ${result.count} items`,
        {
          data: result.data,
          count: result.count,
        }
      );
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : "Operation failed"
      );
    }
  }
);
```

### 3. Auth Patterns

**Use the DRY helper for authentication:**

```typescript
import { requireAuth } from "@/lib/utils/mcp-auth-helpers";

// Standard auth with subscription check
const authCheck = await requireAuth(session, "feature name");
if (authCheck) return authCheck;

// Free tier (no subscription required)
const authCheck = await requireAuth(session, "feature name", {
  requireSubscription: false,
});
if (authCheck) return authCheck;

// Custom validation
const authCheck = await requireAuth(session, "feature name", {
  customCheck: async (userId) => {
    const canAccess = await checkCustomPermission(userId);
    return { valid: canAccess };
  }
});
if (authCheck) return authCheck;
```

## Creating Widgets

### 1. Create Widget Page

```typescript
// app/widgets/my-widget/page.tsx
import MyWidget from "@/src/components/my-widget";

export default function MyWidgetPage() {
  return <MyWidget />;
}
```

### 2. Create Widget Component

```typescript
// src/components/my-widget/index.tsx
"use client";

import { useWidgetProps } from "@openai/widget-sdk";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import type { MyToolContent } from "@/lib/types/tool-responses";

interface ToolOutput {
  structuredContent: MyToolContent;
}

export default function MyWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();

  // Check authentication
  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  // Handle empty state
  if (!toolOutput?.structuredContent) {
    return <div>No data available</div>;
  }

  const { data, count } = toolOutput.structuredContent;

  // Render your UI
  return (
    <div>
      <h2>My Widget</h2>
      <p>Found {count} items</p>
      {data.map((item, i) => (
        <div key={i}>{item}</div>
      ))}
    </div>
  );
}
```

### 3. Register Widget Resource

Add to widgets array in `app/mcp/route.ts`:

```typescript
const widgets = [
  // ...existing widgets
  {
    id: "my-widget",
    title: "My Widget",
    description: "Description of what it does",
    path: "/widgets/my-widget",
  },
];
```

## Database Schema

**Using Drizzle ORM** - Schema defined in `lib/db/schema.ts` with snake_case column names.

**Better Auth Core Tables** (don't modify):
- `user`, `session`, `account`, `verification`, `passkey`
- `apikey`, `jwks`, `oauth_application`, `oauth_access_token`, `oauth_consent`
- `subscription` (if subscriptions enabled)

**Example Application Tables** (customize these):
- `userItems` - Generic CRUD resource
- `appSettings` - App configuration
- `auditLogs` - Event logging

**To add your own tables:**

1. Define in `lib/db/schema.ts`:
```typescript
export const myTable = pgTable("my_table", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  // ...your columns
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

2. Push to database:
```bash
pnpm db:push
```

## Path Aliases

TypeScript path alias: `@/*` maps to project root (e.g., `@/lib/auth` → `/lib/auth`)

## Deployment

Supports multiple platforms. Base URL auto-detection via `baseUrl.ts` handles:
- **Railway**: `RAILWAY_PUBLIC_DOMAIN` or `RAILWAY_STATIC_URL`
- **Vercel**: `VERCEL_URL` (auto-set by Vercel)
- **Local development**: Falls back to `http://localhost:3000`

See `docs/DEPLOYMENT.md` for platform-specific instructions.

## Testing

The project uses Vitest for automated testing:

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:e2e          # E2E tests
```

Tests use a dedicated test database (`axite_mcp_test`) that is created/dropped automatically.

See `docs/TESTING.md` for comprehensive testing guide.

## MCP Best Practices

This template implements patterns from `docs/mcp-builder/`, which contains general MCP development best practices. See `docs/MCP-PATTERNS.md` for the template-specific implementation guide.

### Key Patterns Applied

**Tool Naming**: All tools use `{service}_action_resource` format with a placeholder prefix:
```typescript
"{service}_get_user_items"  // TODO: Replace {service} with your app name
```

**Tool Annotations**: All tools include four required annotations:
```typescript
{
  annotations: {
    readOnlyHint: true,      // Does this tool only read data?
    destructiveHint: false,  // Can this tool delete data?
    idempotentHint: true,    // Same input = same output?
    openWorldHint: false,    // Does this tool call external APIs?
  },
}
```

**Pagination**: List tools include `limit`/`offset` parameters and return pagination metadata:
```typescript
const pagination = calculatePagination(totalCount, offset, limit, items.length);
// Returns: { total_count, count, offset, limit, has_more, next_offset }
```

**Response Formats**: Tools support `response_format` parameter for markdown or JSON output.

**Character Limits**: Use `truncateIfNeeded()` to prevent overwhelming responses (25,000 char limit).

### Reference Documentation

- `docs/MCP-PATTERNS.md` - Template-specific implementation guide
- `docs/mcp-builder/reference/mcp_best_practices.md` - Core MCP standards
- `docs/mcp-builder/reference/node_mcp_server.md` - TypeScript implementation guide

## Development Guidelines

- Use server actions over API routes whenever possible
- Use arrow function syntax whenever possible
- Run `pnpm typecheck` before committing
- Follow the widget hydration pattern (no server actions on mount)
- Use the `requireAuth()` helper for consistent auth checks
- Follow MCP best practices for tool naming, annotations, and responses
- Mark customization points with `// TEMPLATE:` or `// TODO:` comments

## Template Customization

This is a **template repository**. When using it for your project:

1. **Remove example code** you don't need:
   - Delete example tools from `app/mcp/route.ts`
   - Delete example widgets from `app/widgets/` and `src/components/`
   - Delete example services from `lib/services/`

2. **Update branding**:
   - Change app name in `package.json`
   - Update `README.md` with your project details
   - Customize `CLAUDE.md` with your specific patterns

3. **Add your own features**:
   - Create services in `lib/services/`
   - Define types in `lib/types/tool-responses.ts`
   - Register tools in `app/mcp/route.ts`
   - Create widgets in `app/widgets/` and `src/components/`

4. **Configure features**:
   - Set feature flags in `.env`
   - Add custom flags in `lib/config/features.ts`

## Key Files to Customize

- `app/mcp/route.ts` - Your MCP tools
- `lib/db/schema.ts` - Your database tables
- `lib/services/` - Your business logic
- `lib/types/tool-responses.ts` - Your response types
- `.env` - Your configuration

Everything else is infrastructure that rarely needs modification.
