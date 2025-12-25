# Axite MCP Template

**A lightweight, type-safe starter for building ChatGPT MCP apps with Next.js and Skybridge.**

This template provides a simplified, production-ready foundation with:
- **Next.js App Router** structure
- **Skybridge** integration for type-safe widgets
- **Better Auth** (OAuth 2.1)
- **Stripe** subscription support (optional)
- **Drizzle ORM** with PostgreSQL

## ✨ Features

- **🚀 Type-Safe End-to-End** - Automatic type inference from backend tools to frontend widgets.
- **🔐 OAuth 2.1** - Built-in auth for ChatGPT/Claude integration.
- **⚡ Next.js Native** - Widgets are standard Next.js pages.
- **🔌 Skybridge Powered** - Use typed hooks (`useCallTool`, `useToolInfo`) instead of raw SDK calls.

## 🚀 Quick Start

### 1. Install

```bash
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your details.

### 3. Run Development Server

```bash
pnpm dev
```

Your MCP server is running at `http://localhost:3000/mcp`.

## 🛠️ Creating Tools & Widgets

### 1. Define Tool & Widget (`app/mcp/route.ts`)

```typescript
server.registerWidget(
  "my_tool",
  { title: "My Tool", widgetPath: "/widgets/my-tool" },
  {
    description: "Does something cool",
    inputSchema: z.object({ query: z.string() })
  },
  async ({ query }) => {
    return createSuccessResponse("Done", { result: query });
  }
);
```

### 2. Create Widget Page (`app/widgets/my-tool/page.tsx`)

```tsx
import MyWidget from "@/src/components/my-widget";

export default function MyToolPage() {
  return <MyWidget />;
}
```

### 3. Build Widget Component (`src/components/my-widget/index.tsx`)

```tsx
"use client";
import { useToolInfo } from "@/src/mcp-ui-hooks";

export default function MyWidget() {
  // Types are automatically inferred!
  const { output } = useToolInfo();

  if (!output) return <div>Loading...</div>;
  return <div>Result: {output.structuredContent.result}</div>;
}
```

## 📚 Documentation

- `app/mcp/route.ts` - Main server entry point
- `src/mcp-ui-hooks.ts` - Type definitions and hooks
- `lib/db/schema.ts` - Database schema

## 📄 License

MIT
