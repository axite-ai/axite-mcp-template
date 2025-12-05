# Project Structure Quick Reference

## Where Things Go

| What | Location |
|------|----------|
| **MCP Tools** | `packages/server/src/mcp/tools/` |
| **Services** | `packages/server/src/services/` |
| **Database Schema** | `packages/server/src/db/schema.ts` |
| **Widgets** | `packages/web/app/widgets/[name]/` |
| **Hooks** | `packages/web/app/hooks/` |
| **Shared Types** | `packages/shared/src/types/` |
| **Shared Utils** | `packages/shared/src/utils/` |
| **Pages** | `packages/web/app/[route]/page.tsx` |
| **API Routes** | `packages/web/app/api/` |
| **Config** | `packages/server/src/config/` |

## Import Paths

```typescript
// From web package
import { useWidgetProps } from "@/app/hooks";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";

// From server package
import { ItemsService } from "../services";
import { requireAuth } from "../mcp/auth";

// From either package (shared types)
import { createSuccessResponse, UserItemsContent } from "@axite/shared";
```

## Commands

```bash
# Development
pnpm dev              # Run both servers
pnpm dev:server       # MCP server only (port 3001)
pnpm dev:web          # Next.js only (port 3000)

# Build
pnpm build            # Build all packages
pnpm build:server     # Build server only
pnpm build:web        # Build web only

# Database
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Drizzle Studio

# Testing
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
pnpm typecheck        # Type check all packages
```

## Adding New Features

### New MCP Tool

1. Create `packages/server/src/mcp/tools/my-tool.ts`
2. Export from `packages/server/src/mcp/tools/index.ts`
3. Register in `packages/server/src/mcp/server.ts`
4. (Optional) Create widget in `packages/web/app/widgets/my-tool/`

### New Widget

1. Create `packages/web/app/widgets/my-widget/page.tsx`
2. Create `packages/web/app/widgets/my-widget/widget.tsx`
3. Register in `packages/server/src/mcp/widgets.ts`
4. Reference in tool via `"openai/outputTemplate": "ui://widget/my-widget.html"`

### New Service

1. Create `packages/server/src/services/my-service.ts`
2. Export from `packages/server/src/services/index.ts`
3. Import in tools as needed

### New Database Table

1. Add to `packages/server/src/db/schema.ts`
2. Run `pnpm db:push`
3. Create service for CRUD operations

### New Shared Type

1. Add to `packages/shared/src/types/tool-responses.ts`
2. Types are automatically available via `@axite/shared`
