# AskMyMoney GPT Widget Playbook

This guide documents the exact patterns, anti-patterns, and metadata requirements for building ChatGPT widgets in the AskMyMoney repo. It synthesizes the OpenAI Apps SDK reference in `llm_context/appssdk/APPS_SDK_DOCS.txt` with the production implementations under `app/mcp/route.ts`, `app/widgets/*`, and `src/components/*`. Use it before touching MCP tools or widgets so that every surface behaves consistently inside ChatGPT/Claude.

---

## 1. End-to-End Architecture

1. **Tool execution (`app/mcp/route.ts`)**
   - Tools are registered via `createMcpHandler` + `withMcpAuth`.
   - Each tool calls domain services (Plaid, subscription, deletion, etc.), enforces auth via `requireAuth`, and produces typed payloads using `createSuccessResponse` / `createErrorResponse`.
2. **Widget resource registration**
   - The same file registers `text/html+skybridge` resources that proxy the Next.js pages in `app/widgets/<widget>/page.tsx`.
   - `_meta` fields annotate layout, borders, CSP, and the domain ChatGPT should sandbox (`openai/widgetDomain`, `openai/widgetCSP`, `openai/widgetPrefersBorder`, `openai/widgetDescription`).
3. **Component render**
   - `app/widgets/<widget>/page.tsx` simply renders a client component from `src/components/<widget>`.
   - Components hydrate from the MCP tool response (structured content + `_meta`), never from their own fetch at mount. Server actions under `app/widgets/<widget>/actions.ts` only run in response to explicit user gestures.

---

## 2. Apps SDK Contract (Per `llm_context/appssdk/APPS_SDK_DOCS.txt`)

| Capability | Why it matters | Reference |
|------------|----------------|-----------|
| `window.openai` globals (`OpenAiGlobals` type) expose `theme`, `locale`, `maxHeight`, `displayMode`, `safeArea`, `toolOutput`, `toolResponseMetadata`, `widgetState`. Our hooks (`useOpenAiGlobal`, `useWidgetProps`, `useWidgetState`, `useTheme`, `useDisplayMode`, `useMaxHeight`) are thin wrappers around this surface. | React components rely on the `openai:set_globals` event instead of React state to stay synced with ChatGPT. | “Window OpenAI API Reference” + “React: Manage Widget State with useWidgetState Hook” sections. |
| `window.openai.callTool`, `sendFollowUpMessage`, `requestDisplayMode`, `openExternal`, `setWidgetState` | Use these from widgets when the user clicks a button, not during first render. | “Triggering Server Actions…”, “Sending Conversational Follow-ups…”, “Requesting Alternate Layouts…”, “Persist Component State…”, “Persist Ephemeral UI State…” sections. |
| `_meta` keys on tool descriptors (`openai/outputTemplate`, `openai/widgetAccessible`, `openai/toolInvocation/invoking`, `openai/toolInvocation/invoked`, `securitySchemes`, etc.) | These strings control ChatGPT status pills, bind a tool to a widget HTML resource, and gate widget→tool calls. Omitting them breaks host UX. | “Tool descriptor parameters” and “Enable Component-Initiated Tool Access”. |

✅ Always review `llm_context/appssdk/APPS_SDK_DOCS.txt` when you need exact wording or CSP syntax—the guide mirrors OpenAI’s public reference but codifies how we apply it.

---

## 3. Registering Widget Surfaces

1. **Add a Next.js page**: `app/widgets/<widget>/page.tsx` should render the client component only:
   ```tsx
   import MyWidget from "@/src/components/my-widget";
   export default function MyWidgetPage() {
     return <MyWidget />;
   }
   ```
2. **Expose it to ChatGPT**: Update the `widgets` array near the top of `app/mcp/route.ts`. Each entry must include:
   - `id` (used in `ui://widget/<id>.html` URIs).
   - `title` + `description`.
   - `path` (Next.js route to fetch via `getAppsSdkCompatibleHtml`).
   - Resource metadata that mirrors our existing widgets:
     ```ts
     'openai/widgetDescription': widget.description,
     'openai/widgetPrefersBorder': true,
     'openai/widgetDomain': baseURL,
     'openai/widgetCSP': {
       'base-uri': ["'self'", baseURL],
       connect_domains: [baseURL, baseURL.replace(/^http/, 'ws')],
       resource_domains: [baseURL, 'https://*.plaid.com', 'https://*.oaistatic.com'],
     },
     ```
   - MIME type **must** be `text/html+skybridge` so ChatGPT injects widget data correctly (per Apps SDK docs).
3. **Bind tool → template**: Inside the tool registration, set `_meta["openai/outputTemplate"] = "ui://widget/<widget>.html"`. Without that, ChatGPT will never load the iframe.

---

## 4. Tool Implementation & Typed Payloads

1. **Define structured content first**: Add a type to `lib/types/tool-responses.ts` so both MCP handlers and widgets share the same shape. The `ConnectItemContent` type shows how to split data between model-visible fields and widget-only metadata.
2. **Enforce auth consistently**:
   - Call `requireAuth(session, "feature name", { requireSubscription, requirePlaid, headers: req.headers })`.
   - Use `createLoginPromptResponse`, `createSubscriptionRequiredResponse`, or `createPlaidRequiredResponse` to short-circuit unauthenticated users instead of inventing custom messages.
3. **Use response helpers**:
   - `createSuccessResponse("Human-friendly summary", structuredContent, metaForWidget)`
   - `createErrorResponse("Readable failure")` for recoverable issues.
   - Never hand-roll `{ type: "text" }` objects—helpers already import `createTextContent`.
4. **Structured content vs `_meta`**:
   - `structuredContent` is read by the LLM **and** the widget. Keep it concise, typed, and safe to expose (e.g., aggregated totals, booleans).
   - `_meta` (e.g., `toolResponseMetadata`) is only visible to the widget. Put large lists, tokens, or UI-only hints here. Example: `connect_item` keeps `planLimits` / `deletionStatus` in `structuredContent` but passes the raw `items`, Plaid token, and `baseUrl` through `_meta`.
5. **Populate Apps SDK metadata** (per docs and `README.md`):
   - `_meta["openai/toolInvocation/invoking"]` and `_meta["openai/toolInvocation/invoked"]` should be short (<64 chars) and action-specific.
   - `_meta["openai/widgetAccessible"] = true` only when the widget needs to trigger tool calls (e.g., `manage_subscription`, `connect_item`). Otherwise leave it `false`.
   - Duplicate `securitySchemes` at the top level **and** in `_meta["securitySchemes"]` to support legacy clients.
   - Set `annotations` comprehensively:
     ```ts
     annotations: {
       readOnlyHint: true,        // Safe reads skip confirmation prompts
       destructiveHint: false,    // Set true for delete/overwrite flows
       openWorldHint: false,      // Set true if actions impact other users/systems
     };
     ```
6. **Use host-provided user hints responsibly**:
   - `_meta["openai/subject"]` supplies a stable, anonymized user identifier per Apps SDK v2025. Prefer this for rate limiting or caching (e.g., `rateLimiter.check(subjectId, "tool")`), but still gate access through Better Auth (`requireAuth`).
   - `_meta["openai/locale"]` and `_meta["openai/userLocation"]` help with formatting and messaging only—never make authorization decisions based on them.
7. **Validate `structuredContent` with Zod `outputSchema`**:
   - Define a Zod schema beside the TypeScript type (see Section 9.3) and pass it to `server.registerTool({ outputSchema: MySchema })`.
   - Parse your payload before returning to catch regressions and ensure widgets/models see consistent shapes.

---

## 5. Widget Component Blueprint

Create a client component under `src/components/<widget>/index.tsx` that follows these conventions:

1. **Hydration**:
   - Call `const toolOutput = useWidgetProps<TypedToolOutput>();`.
   - Read widget-only data via `const metadata = useOpenAiGlobal("toolResponseMetadata") as TypedMetadata | null;`.
   - Short-circuit auth with `const authComponent = checkWidgetAuth(toolOutput); if (authComponent) return authComponent;`.
   - Show `<WidgetLoadingSkeleton />` until both `toolOutput` and relevant metadata are present.
2. **No implicit network calls**:
   - *Pattern*: The component renders purely from `toolOutput` + `_meta`. Example: `src/components/account-balances` enumerates accounts directly from props.
   - *Anti-pattern*: Calling server actions in `useEffect` when `toolOutput` is `null`. This was the root cause of the historic Connect Item bug—Better Auth refuses iframe requests without explicit user interaction.
3. **Host-aware hooks**:
   - `useTheme()` / `useDisplayMode()` / `useMaxHeight()` adapt to ChatGPT layout changes (`window.openai` emits `openai:set_globals` per docs).
   - `useWidgetState()` wraps `window.openai.setWidgetState` so selections (expanded accordions, error banners) persist between follow-up prompts.
4. **User-triggered work only**:
   - Server actions in `app/widgets/<widget>/actions.ts` (e.g., `deleteItem`) should be invoked from click handlers.
   - For repeated data refreshes, wire a button to `await window.openai.callTool("<tool>", args)`—per “Triggering Server Actions...” in the Apps SDK docs.
5. **Communicate with the conversation**:
   - Use `await window.openai.sendFollowUpMessage({ prompt: "Updated balances." });` when user actions should appear in the transcript (“Send Follow-up Messages” reference).
   - Switch layouts via `await window.openai.requestDisplayMode({ mode: "fullscreen" });` when the UI needs more space.

### 5.3 Progressive Loading & Conditional Rendering

Tools often need to decide between radically different widgets (e.g., show Subscribe vs. Connect vs. Dashboard). Because ChatGPT requires `openai/outputTemplate` immediately, the tool should always reference **one adaptive widget** and ship all state downstream:

1. **Backend state resolution** (no client fetches):
   ```ts
   // app/mcp/route.ts
   server.registerTool("financial_overview", {
     _meta: { "openai/outputTemplate": "ui://widget/financial-overview.html" },
     // ...
   }, async (_args, { _meta }) => {
     const subject = _meta?.["openai/subject"];
     const [subscription, plaidStatus, accounts] = await Promise.all([
       UserService.getActiveSubscription(subject),
       PlaidService.getPlaidStatus(subject),
       PlaidService.getAccounts(subject),
     ]);

     const phase = !subscription?.active
       ? "subscribe"
       : plaidStatus?.connected
         ? "dashboard"
         : "connect";

     return createSuccessResponse(
       summarizeState(phase, accounts),
       {
         phase,
         hasActiveSubscription: !!subscription?.active,
         hasPlaidConnected: !!plaidStatus?.connected,
         accountCount: accounts.length,
       },
       {
         subscription,
         plaidStatus,
         accounts,
         subscribeUrl: subscription?.active ? null : `${baseURL}/pricing`,
         connectUrl: plaidStatus?.connected ? null : `${baseURL}/connect-bank`,
       }
     );
   });
   ```
2. **Widget decision tree**:
   ```tsx
   export default function FinancialOverviewWidget() {
     const toolOutput = useWidgetProps<FinancialOverviewOutput>();
     if (!toolOutput) return <WidgetLoadingSkeleton message="Loading your finances..." />;

     const authComponent = checkWidgetAuth(toolOutput);
     if (authComponent) return authComponent;

     switch (toolOutput.phase) {
       case "subscribe":
         return <SubscribePrompt plans={toolOutput._meta.subscription?.plans} />;
       case "connect":
         return <ConnectBankPrompt connectUrl={toolOutput._meta.connectUrl} />;
       case "dashboard":
         return <AccountDashboard accounts={toolOutput._meta.accounts} />;
       default:
         return <EmptyState message="Unknown state" />;
     }
   }
   ```
3. **Loading hierarchy**:
   - Tool phase: `_meta["openai/toolInvocation/invoking"]` tells ChatGPT “Checking subscription…”.
   - Widget mount: `<WidgetLoadingSkeleton />`.
   - Auth errors: `checkWidgetAuth()`.
   - Content: state-specific components, no extra fetches.
   - User actions: optimistic UI + `window.openai.callTool` or server actions triggered by clicks.
4. **Never fetch inside `useEffect` on mount**—ChatGPT iframes block Better Auth requests without a user gesture. All conditional data must already be present in `toolOutput`/`_meta`. This pattern prevented the original Connect Item bug and keeps every widget deterministic.

---

## 6. Interaction & State Patterns

| Use case | Pattern | Example |
|----------|---------|---------|
| Persisting widget-only UI state (tabs, sort, banners) | `const [state, setState] = useWidgetState(defaults);` → update on interactions only. | `src/components/connect-item` stores toast/error UI in widget state. |
| Triggering MCP tools from a widget | Only allowed when `_meta["openai/widgetAccessible"] = true`. Use `window.openai.callTool`. Re-use the same structured content type to update the UI. | Manage Subscription widget requesting a fresh billing portal link. |
| Server actions with Better Auth headers | Export from `app/widgets/<widget>/actions.ts`. ChatGPT forwards session headers only for explicit user gestures, so do *not* call them in `useEffect`. | `deleteItem()` inside `app/widgets/connect-item/actions.ts`. |
| Opening host pages (Plaid, Stripe, etc.) | Use data passed through `_meta` (e.g., `baseUrl`, `mcpToken`) to build URLs, then `window.open` or `window.openai.openExternal`. Never assume `window.location.origin`. | Connect Item widget launching `/connect-bank?token=...`. |

---

## 7. Patterns vs. Anti-Patterns

| ✅ Do this | ❌ Avoid this |
|------------|--------------|
| **Define a typed payload** in `lib/types/tool-responses.ts` before implementing the tool so both the LLM and widget are in sync. | Letting tools return ad-hoc objects; it breaks widgets when fields change. |
| **Call `requireAuth`** and bail early with the standardized auth helpers (`createLoginPromptResponse`, `createSubscriptionRequiredResponse`, `createPlaidRequiredResponse`). | Re-implementing subscription checks or duplicating plan-limit logic from `lib/utils/plan-limits` / `UserService.countUserItems`. |
| **Populate `_meta` correctly**: `openai/outputTemplate`, status strings, `widgetAccessible`, `securitySchemes`, `widgetDomain`, `widgetCSP`. | Registering a tool without metadata; the widget will never mount or will render borderless/insecure if CSP is missing. |
| **Keep structured content concise** (aggregations, booleans, counts) and push large/raw data into `_meta`. | Sending sensitive tokens or lists of accounts through `structuredContent`; the LLM sees everything in that object. |
| **Hydrate from `toolOutput` / `_meta` only** and show `<WidgetLoadingSkeleton />` until available. | Firing server actions / Plaid Link calls on mount to fetch missing data. This triggers Better Auth failures in the iframe (Connect Item bug). |
| **Use helper hooks** (`useWidgetProps`, `useOpenAiGlobal`, `useWidgetState`, `useTheme`, etc.) and `cn` for styling. | Accessing `window.openai` directly in render without guarding `typeof window`. |
| **Limit server actions to explicit clicks**; when you need to re-run the tool, call `window.openai.callTool`. | Mutating data silently or assuming the iframe shares cookies; ChatGPT sandboxes all requests. |
| **Document status strings** with `_meta["openai/toolInvocation/*"]` so ChatGPT shows meaningful “Fetching balances…” labels. | Leaving statuses blank; the host shows “Calling tool…” forever. |
| **Treat `_meta["openai/subject"]`, locale, and userLocation as hints only.** | Trusting these fields for authorization or geo-blocking. Always verify using Better Auth / database state. |
| **Keep `structuredContent` lean (<2 KB) and push large payloads into `_meta`.** | Sending thousands of rows to the LLM; it bloats prompts and can be truncated by the host. |

---

## 8. Implementation Checklist

1. **Plan the payload**
   - [ ] Add `MyWidgetContent` + `MyWidgetResponse` to `lib/types/tool-responses.ts`.
   - [ ] Define a Zod `outputSchema` mirroring the structured content.
   - [ ] Decide what belongs in `structuredContent` (model-safe, <2 KB) vs `_meta` (widget-only, paginate if >100 KB).
2. **Update server logic**
   - [ ] Implement domain logic or reuse services in `lib/services`.
   - [ ] Register or update the MCP tool in `app/mcp/route.ts`:
     - [ ] Call `requireAuth`.
     - [ ] Extract `_meta["openai/subject"]` for rate limiting / caching (still verify auth server-side).
     - [ ] Use `createSuccessResponse` / `createErrorResponse` / `createReAuthResponse`.
     - [ ] Populate `_meta` (`openai/outputTemplate`, `openai/toolInvocation/*`, `openai/widgetAccessible`, `securitySchemes`, optional `openai/locale`).
     - [ ] Attach `outputSchema` and validate before returning.
     - [ ] Set `annotations.readOnlyHint` / `destructiveHint` / `openWorldHint`.
3. **Register the widget resource**
   - [ ] Add an entry to the `widgets` array (resource id, description, Next.js path, CSP).
   - [ ] Audit CSP allowlists—only include domains you actually load (Plaid, Stripe, AskMyMoney, OpenAI assets).
   - [ ] Create `app/widgets/<widget>/page.tsx` that renders your client component.
4. **Build the client component**
   - [ ] Create `src/components/<widget>/index.tsx` with `useWidgetProps`, `checkWidgetAuth`, and `WidgetLoadingSkeleton`.
   - [ ] Use `useWidgetState`, `useTheme`, `useDisplayMode`, `useMaxHeight` where relevant.
   - [ ] Only trigger server actions or `window.openai.*` methods inside event handlers.
5. **Optional interactions**
   - [ ] Add server actions to `app/widgets/<widget>/actions.ts` for destructive flows, enforcing Better Auth headers like `connect-item` does.
   - [ ] If the widget needs to call tools itself, ensure `_meta["openai/widgetAccessible"] = true`.
6. **Verify**
   - [ ] `pnpm lint`
   - [ ] `pnpm typecheck`
   - [ ] `pnpm test:mcp` / `pnpm test:mcp-schemas` if MCP metadata changed.
   - [ ] `pnpm test` (or targeted suites if you touched services)
   - [ ] `pnpm dev` to load `/widgets/<widget>` directly in the browser before embedding into ChatGPT.
   - [ ] Capture manual MCP notes (per AGENTS.md) for PRs touching `/mcp`.

Following this playbook keeps every GPT widget consistent with the Apps SDK contract, prevents iframe auth regressions, and ensures the LLM always receives predictable, typed data. Store future MCP-specific findings in `llm_context/mcp/` to keep this knowledge close to the repo.

---

## 9. Additional Apps SDK Metadata (2025 Refresh)

### 9.1 Expanded Tool Annotations

The latest Apps SDK expects all three annotations to be set:

```ts
annotations: {
  readOnlyHint: true,        // Skip extra confirmation prompts for reads
  destructiveHint: false,    // True for deletions, overwrites, cancellations
  openWorldHint: false,      // True when affecting external systems or other users
};
```

- `destructiveHint: true` prompts ChatGPT to confirm with the user before invoking the tool.
- `openWorldHint: true` notifies the user that output may post publicly or affect other accounts (e.g., subscription changes).

### 9.2 Stable User Identity via `_meta["openai/subject"]`

Each tool invocation now includes `_meta["openai/subject"]`—an anonymized, stable identifier for the ChatGPT user. Use it for rate limiting, caching, and analytics:

```ts
const subjectId = _meta?.["openai/subject"];
if (subjectId) {
  await rateLimiter.check(subjectId, "connect_item");
}
```

Always pair this with `requireAuth`; `_meta["openai/subject"]` is a hint, not an authorization token.

### 9.3 Output Schema Enforcement

Define a Zod schema that mirrors the structured content and register it via `outputSchema`. Validate payloads before returning:

```ts
export const ConnectItemOutputSchema = z.object({
  planLimits: z.object({
    current: z.number().int(),
    max: z.number().int(),
    maxFormatted: z.string(),
    planName: z.string(),
  }),
  deletionStatus: z.object({
    canDelete: z.boolean(),
    daysUntilNext: z.number().int().optional(),
  }),
  canConnect: z.boolean(),
});

server.registerTool("connect_item", {
  ...config,
  outputSchema: ConnectItemOutputSchema,
}, async () => {
  const structured = buildStructuredContent();
  const validated = ConnectItemOutputSchema.parse(structured);
  return createSuccessResponse(message, validated, meta);
});
```

This guarantees widgets and the LLM always receive data that fits the schema.

---

## 10. Security & Privacy Best Practices

1. **Server-side enforcement only**: Never rely on `_meta["openai/userLocation"]`, `userAgent`, or `locale` for authorizing access. Use them solely for formatting or analytics; actual gating must happen via `requireAuth` + database checks.
2. **Tight CSP allowlists**: When registering resources, only include the exact domains the widget fetches. Example:
   ```ts
   'openai/widgetCSP': {
     'base-uri': ["'self'", baseURL],
     connect_domains: [baseURL, baseURL.replace(/^http/, "ws")],
     resource_domains: [
       baseURL,
       "https://cdn.plaid.com",
       "https://b.stripecdn.com",
       "https://persistent.oaistatic.com",
     ],
   }
   ```
3. **OAuth challenges**: When Plaid or Stripe tokens expire, use `mcp/www_authenticate` via `createReAuthResponse` (next section) so ChatGPT can automatically prompt for re-auth.

---

## 11. Error Handling & Re-Auth Flow

Add a helper to surface OAuth/subscription challenges:

```ts
export const createReAuthResponse = (
  challenge: "oauth2" | "subscription",
  message: string,
  redirectUrl?: string
) => ({
  content: [createTextContent(message)],
  isError: true,
  _meta: {
    "mcp/www_authenticate":
      challenge === "oauth2"
        ? 'Bearer realm="plaid", error="invalid_token"'
        : 'Subscription realm="stripe", error="payment_required"',
    ...(redirectUrl && { "openai/reconnectUrl": redirectUrl }),
  },
});
```

Usage:

```ts
try {
  await plaidService.call();
} catch (error) {
  if (error.code === "ITEM_LOGIN_REQUIRED") {
    return createReAuthResponse(
      "oauth2",
      "Your bank connection needs to be refreshed. Reconnect to continue.",
      `${baseURL}/connect-bank?reconnect=true`
    );
  }
  throw error;
}
```

---

## 12. MCP Metadata Validation & Testing

Enhance your tooling to prevent regressions:

- `pnpm test:mcp` – integration tests covering MCP flows.
- `pnpm test:mcp-schemas` – script that loads every tool definition and validates:
  - `_meta["openai/outputTemplate"]` matches `ui://widget/*.html`.
  - Status strings ≤64 characters.
  - `securitySchemes` exist at the descriptor level and inside `_meta`.
  - `outputSchema` is defined for widget-backed tools.
- `pnpm lint:mcp` – ESLint pass over `app/mcp` + helper libs.

Pseudo-code for schema validation script:

```ts
const ToolMetaSchema = z.object({
  "openai/outputTemplate": z.string().regex(/^ui:\/\/widget\/.+\.html$/),
  "openai/toolInvocation/invoking": z.string().max(64),
  "openai/toolInvocation/invoked": z.string().max(64),
  "openai/widgetAccessible": z.boolean(),
  securitySchemes: z.array(
    z.object({
      type: z.enum(["oauth2", "noauth"]),
      scopes: z.array(z.string()).optional(),
    })
  ),
});
```

Run these scripts before every MCP PR to catch metadata drift early.

---

## 13. Performance Optimization Patterns

1. **Lazy hydrate heavy UI**: Use dynamic imports (`next/dynamic`) for charts or tables. Render a `<WidgetLoadingSkeleton />` until the user expands the section.
2. **Structured content budget**: Keep `structuredContent` under ~2 KB for model reasoning. Store full datasets in `_meta`, and paginate or refetch via `window.openai.callTool` if `_meta` would exceed ~100 KB.
3. **Avoid redundant recompute**: When users need fresh data, re-call the tool (`await window.openai.callTool("get_account_balances", {})`) so the server recomputes with the latest data rather than duplicating logic client-side.

Example lazy hydration:

```tsx
const DetailedChart = dynamic(() => import("./DetailedChart"), {
  ssr: false,
  loading: () => <WidgetLoadingSkeleton />,
});

export default function SpendingInsights() {
  const data = useWidgetProps<SpendingInsightsOutput>();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div>
      <Summary data={data.summary} />
      <button onClick={() => setShowDetails(true)}>Show detailed breakdown</button>
      {showDetails && <DetailedChart data={data._meta?.chartData} />}
    </div>
  );
}
```
