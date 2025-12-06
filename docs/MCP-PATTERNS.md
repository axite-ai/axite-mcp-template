# MCP Best Practices for Axite Template

This guide documents the MCP (Model Context Protocol) best practices implemented in this template. It combines patterns from `docs/mcp-builder/reference/` with axite-specific implementation details.

## Quick Reference

### Tool Naming Convention

All tools use a `{service}_` prefix placeholder that you should replace with your app name:

```typescript
// Template pattern
"{service}_get_user_items"

// Your implementation
"myapp_get_user_items"
```

**Format**: `{service}_{action}_{resource}` (snake_case)

**Examples**:
- `myapp_get_user_items`
- `myapp_manage_item`
- `myapp_calculate_roi`

### Required Tool Annotations

Every tool MUST include all four annotations:

```typescript
server.tool(
  "tool_name",
  "description",
  { /* schema */ },
  async (params) => { /* handler */ },
  {
    annotations: {
      readOnlyHint: true,      // Does this tool ONLY read data?
      destructiveHint: false,  // Can this tool delete/destroy data?
      idempotentHint: true,    // Same input = same result?
      openWorldHint: false,    // Does this tool call external APIs?
    },
  } as any
);
```

| Annotation | When `true` | When `false` |
|------------|-------------|--------------|
| `readOnlyHint` | Tool only reads data | Tool creates/updates/deletes data |
| `destructiveHint` | Tool can permanently delete data | Tool is safe, no permanent deletions |
| `idempotentHint` | Repeated calls produce same result | Each call may produce different results |
| `openWorldHint` | Tool calls external APIs/services | Tool only uses internal database |

### Pagination Pattern

For any tool that returns a list:

**Input Schema**:
```typescript
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@axite/shared";

const schema = z.object({
  limit: z
    .number()
    .int()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Maximum results (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
}).strict();
```

**Response Structure**:
```typescript
import { calculatePagination } from "@axite/shared";

// In your tool handler:
const totalCount = await Service.count(userId);
const items = await Service.list(userId, { limit, offset });
const pagination = calculatePagination(totalCount, offset, limit, items.length);

return createSuccessResponse(text, {
  items,
  pagination, // { total_count, count, offset, limit, has_more, next_offset? }
});
```

### Response Format Support

Support both markdown (human-readable) and JSON (machine-readable) output:

**Input Schema**:
```typescript
import { ResponseFormat } from "@axite/shared";

const schema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' or 'json'"),
});
```

**Handler**:
```typescript
let textContent: string;
if (response_format === ResponseFormat.MARKDOWN) {
  textContent = formatAsMarkdown(data);
} else {
  textContent = `Summary: ${data.count} items found`;
}
```

### Character Limits

Prevent overwhelming responses:

```typescript
import { CHARACTER_LIMIT, truncateIfNeeded } from "@axite/shared";

const { content, truncated, message } = truncateIfNeeded(largeContent);
if (truncated) {
  // message contains: "Response truncated at 25,000 characters..."
}
```

### Error Handling

Return actionable error messages:

```typescript
// Good - tells user what to do
return createErrorResponse(
  `Item '${itemId}' not found. Please verify the ID and try again.`
);

// Bad - not actionable
return createErrorResponse("Item not found");
```

### Strict Schema Validation

Always use `.strict()` on Zod schemas:

```typescript
const schema = z.object({
  query: z.string().min(1).describe("Search query"),
  limit: z.number().default(20),
}).strict(); // Rejects unknown parameters
```

---

## Implementation Examples

### Read-Only List Tool

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
  calculatePagination,
  ResponseFormat,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@axite/shared";

const schema = z.object({
  status: z.enum(["active", "archived"]).default("active"),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.number().int().min(0).default(0),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
}).strict();

server.tool(
  "{service}_list_items",
  "List items with pagination...",
  schema.shape,
  async (rawParams) => {
    const params = schema.parse(rawParams);

    const totalCount = await Service.count(params.status);
    const items = await Service.list(params);
    const pagination = calculatePagination(totalCount, params.offset, params.limit, items.length);

    return createSuccessResponse(
      formatText(items, params.response_format),
      { items, pagination }
    );
  },
  {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  } as any
);
```

### CRUD Tool

```typescript
server.tool(
  "{service}_manage_item",
  "Create, update, or delete items...",
  {
    action: z.enum(["create", "update", "delete"]),
    itemId: z.string().optional(),
    title: z.string().optional(),
  },
  async ({ action, itemId, title }) => {
    // Validation
    if (action !== "create" && !itemId) {
      return createErrorResponse(
        `Item ID is required for ${action}. Please provide 'itemId' parameter.`
      );
    }

    // Business logic...
  },
  {
    annotations: {
      readOnlyHint: false,      // Modifies data
      destructiveHint: true,    // Delete action
      idempotentHint: false,    // Create is not idempotent
      openWorldHint: false,
    },
  } as any
);
```

### External API Tool

```typescript
server.tool(
  "{service}_get_weather",
  "Fetch weather from external API...",
  { location: z.string() },
  async ({ location }) => {
    const data = await WeatherAPI.fetch(location);
    return createSuccessResponse(formatWeather(data), data);
  },
  {
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,     // Cached responses
      openWorldHint: true,      // External API
    },
  } as any
);
```

---

## File Structure

### Shared Package (`packages/shared/src/`)

```
constants.ts          # CHARACTER_LIMIT, pagination defaults, ResponseFormat
types/
  mcp-responses.ts    # MCPToolResponse, PaginationMeta, OpenAIResponseMetadata
  tool-responses.ts   # Tool-specific content types (UserItemsContent, etc.)
utils/
  mcp-response-helpers.ts  # createSuccessResponse, calculatePagination, etc.
schemas/
  common.ts           # PaginationInputSchema, ResponseFormatInputSchema
```

### Tool Files (`packages/server/src/mcp/tools/`)

Each tool follows the pattern:
1. File header with best practices implemented
2. Input schema with `.strict()`
3. Registration function with annotations
4. Handler with auth check, business logic, response formatting
5. Optional markdown formatter function

---

## Reference Documentation

For comprehensive MCP development guidance, see:

- **[MCP Best Practices](./mcp-builder/reference/mcp_best_practices.md)** - Core standards for naming, responses, security
- **[Node/TypeScript Guide](./mcp-builder/reference/node_mcp_server.md)** - TypeScript implementation patterns
- **[Evaluation Guide](./mcp-builder/reference/evaluation.md)** - Testing MCP servers with evaluation harness

---

## Customization Checklist

When customizing this template:

1. [ ] Replace `{service}` with your app name in all tool names
2. [ ] Update tool descriptions for your domain
3. [ ] Define your own content types in `tool-responses.ts`
4. [ ] Implement your services in `packages/server/src/services/`
5. [ ] Create widgets for your tools in `packages/web/app/widgets/`
6. [ ] Run `pnpm typecheck` to verify all changes compile
