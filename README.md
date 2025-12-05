# Axite MCP Template

**Production-ready starter template for building ChatGPT MCP (Model Context Protocol) apps with Next.js, Better Auth OAuth 2.1, and optional Stripe subscriptions.**

Build powerful AI-native applications that integrate seamlessly with ChatGPT and Claude. This template provides everything you need to get started: authentication, database, example tools, widgets, and deployment configs.

## ✨ Features

- **🔐 OAuth 2.1 Authentication** - Better Auth with MCP plugin for ChatGPT/Claude integration
- **💳 Optional Subscriptions** - Stripe integration with feature flags (easily disable if not needed)
- **🛠️ 5 Example MCP Tools** - CRUD operations, external APIs, calculations, subscription management
- **🎨 4 Example Widgets** - Interactive UI components that render in ChatGPT
- **📊 PostgreSQL + Redis** - Production-ready database setup with Drizzle ORM
- **🔒 Type-Safe** - End-to-end TypeScript with Zod validation
- **🚀 Deploy Anywhere** - Vercel, Railway, or any Node.js hosting
- **📝 Comprehensive Docs** - Inline comments and guides for every component
- **🧪 Testing Setup** - Vitest + Playwright for integration and E2E tests

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL database
- Redis instance
- (Optional) Stripe account for subscriptions

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/axite-mcp-template.git
cd axite-mcp-template
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials. See `.env.example` for full documentation.

### 3. Setup Database

```bash
pnpm db:push
```

### 4. Run Development Server

```bash
pnpm dev
```

Your MCP server is now running at `http://localhost:3000/mcp`

If you deploy the server separately, set `MCP_SERVER_URL` to the full MCP endpoint (including the `/mcp` path), for example `http://localhost:3001/mcp`.

For quick local testing without a real backend, you can run a mock MCP server (includes OAuth-style 401 challenge and two tools: `ping`, `echo`):

```bash
pnpm mock:mcp          # starts mock server at http://localhost:3001/mcp
pnpm dev               # proxy stays pointed at http://localhost:3001/mcp by default

# Test unauth (401 + WWW-Authenticate)
curl -i -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{}'

# Test auth success
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token123" \
  -d '{}'
```

## 📚 What's Included

### MCP Tools (5 examples)

1. **`get_user_items`** - Fetch user's items (auth + subscription)
2. **`manage_item`** - CRUD operations (auth + subscription)
3. **`get_weather`** - External API integration (free, no auth)
4. **`calculate_roi`** - ROI calculator (free, no auth)
5. **`manage_subscription`** - Stripe billing (auth required)

### Widgets (4 examples)

- **user-items** - Data display
- **manage-item** - CRUD results
- **weather** - API visualization
- **roi-calculator** - Charts

### Services (3 examples)

- **ItemsService** - Database CRUD
- **WeatherService** - External APIs with caching
- **LoggerService** - Winston logging

## 🛠️ Development

### Key Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm db:push          # Push schema to database
pnpm typecheck        # Type checking
pnpm test             # Run tests
```

### Project Structure

```
├── app/mcp/route.ts       # MCP server
├── app/widgets/           # Widget pages
├── lib/
│   ├── services/          # Business logic
│   ├── types/             # TypeScript types
│   └── utils/             # Helpers
└── src/components/        # Widget components
```

## 📖 Adding Your Own Tools

See [CLAUDE.md](CLAUDE.md) for comprehensive development guide.

Quick example:

```typescript
// app/mcp/route.ts
server.registerTool("my_tool", config, async ({ param }) => {
  const authCheck = await requireAuth(session, "my feature");
  if (authCheck) return authCheck;

  return createSuccessResponse("Success!", { data });
});
```

## 🎨 Customization

### Disable Subscriptions

```env
ENABLE_SUBSCRIPTIONS=false
```

### Add Feature Flags

```typescript
// lib/config/features.ts
export const FEATURES = {
  MY_FEATURE: process.env.ENABLE_MY_FEATURE === "true",
};
```

## 🚀 Deployment

**Railway:**
```bash
railway up
```

**Vercel:**
```bash
vercel
```

See `docs/DEPLOYMENT.md` for details.

## 📄 License

MIT License - see LICENSE file.

## 🙏 Built With

- [Next.js](https://nextjs.org/)
- [Better Auth](https://better-auth.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [OpenAI Apps SDK](https://platform.openai.com/docs/apps)

---

**Ready to build?** Clone and customize! 🚀
