import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  getAccountBalances,
  getTransactions,
  getSpendingInsights,
  checkAccountHealth,
} from "@/lib/services/plaid-service";
import { UserService } from "@/lib/services/user-service";
import { auth } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/utils/subscription-helpers";
import {
  createLoginPromptResponse,
  createSubscriptionRequiredResponse,
  createPlaidRequiredResponse,
} from "@/lib/utils/auth-responses";
import { withMcpAuth } from "better-auth/plugins";

console.log("Auth API methods at startup:", Object.keys(auth.api));

// Type for OpenAI-extended MCP tool configurations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtendedToolConfig = any;

const handler = withMcpAuth(auth, async (req, session) => {
  // Detailed session logging
  console.log("[MCP] Session received:", {
    hasSession: !!session,
    userId: session?.userId,
    clientId: session?.clientId,
    scopes: session?.scopes,
    accessTokenExpiry: session?.accessTokenExpiresAt,
    isExpired: session?.accessTokenExpiresAt ? new Date(session.accessTokenExpiresAt) < new Date() : null,
  });

  // Log the request details
  const url = new URL(req.url);
  const authHeader = req.headers.get('authorization');
  console.log("[MCP] Request details:", {
    method: req.method,
    path: url.pathname,
    searchParams: Object.fromEntries(url.searchParams),
    hasAuthHeader: !!authHeader,
    authType: authHeader?.split(' ')[0],
  });

  // Clone request to read body without consuming it
  const clonedReq = req.clone();
  try {
    const body = await clonedReq.text();
    if (body) {
      const parsed = JSON.parse(body);
      console.log("[MCP] Request body:", {
        method: parsed.method,
        id: parsed.id,
        paramsKeys: parsed.params ? Object.keys(parsed.params) : [],
      });
    }
  } catch {
    // Ignore if body can't be read
  }

  return createMcpHandler(async (server) => {
    // ============================================================================
    // AUTHENTICATED PLAID TOOLS
    // ============================================================================

    // Get Account Balances
    const getAccountBalancesConfig = {
      title: "Get Account Balances",
      description: "Get current account balances and details for all linked accounts. Shows an interactive card view. Requires authentication.",
      inputSchema: {
        _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
      },
      _meta: {
        securitySchemes: [{ type: "oauth2" }], // Back-compat mirror for ChatGPT
        "openai/toolInvocation/invoking": "Fetching your account balances",
        "openai/toolInvocation/invoked": "Retrieved account balances",
        // TODO: Add openai/outputTemplate when widget is built
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      securitySchemes: [{ type: "oauth2" }],
    } as any;

    console.log("[MCP] Registering tool: get_account_balances", {
      securitySchemes: getAccountBalancesConfig.securitySchemes,
      annotations: getAccountBalancesConfig.annotations,
    });

    server.registerTool(
      "get_account_balances",
      {
        title: "Get Account Balances",
        description: "Get current account balances and details for all linked accounts. Shows an interactive card view. Requires authentication.",
        inputSchema: {
          _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
        },
        _meta: {
          "openai/toolInvocation/invoking": "Fetching your account balances",
          "openai/toolInvocation/invoked": "Retrieved account balances",
        },
        annotations: {
          destructiveHint: false,
          openWorldHint: false,
          readOnlyHint: true,
        },
      securitySchemes: [{ type: "noauth" }, { type: "oauth2", scopes: ["balances:read"] }],
    } as ExtendedToolConfig,
    async () => {
      try {
        if (!session || !(await hasActiveSubscription(session.userId))) {
          return createSubscriptionRequiredResponse("account balances");
        }

          // Check 3: Plaid Connection
          const accessTokens = await UserService.getUserAccessTokens(session.userId);
          if (accessTokens.length === 0) {
            return createPlaidRequiredResponse();
          }

        // Fetch balances from all connected accounts
        const allAccounts = [];
        for (const accessToken of accessTokens) {
          const balances = await getAccountBalances(accessToken);
          allAccounts.push(...balances.accounts);
        }

        // Calculate total balance
        const totalBalance = allAccounts.reduce((sum, account) => {
          return sum + (account.balances.current || 0);
        }, 0);

        const output = {
          accounts: allAccounts,
          totalBalance,
          lastUpdated: new Date().toISOString(),
        };

        return {
          content: [
            {
              type: "text",
              text: `Found ${allAccounts.length} account(s) with a total balance of $${totalBalance.toFixed(2)}`,
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        console.error("[Tool] get_account_balances error", { error });
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "Failed to fetch account balances",
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Transactions
  server.registerTool(
    "get_transactions",
    {
      title: "Get Transactions",
      description: "Get recent transactions for all accounts. Shows an interactive transaction list. Requires authentication.",
      inputSchema: {
        startDate: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to 30 days ago."),
        endDate: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to today."),
        limit: z.number().optional().describe("Maximum number of transactions to return. Defaults to 100."),
      },
      _meta: {
        securitySchemes: [{ type: "oauth2" }], // Back-compat mirror for ChatGPT
        "openai/toolInvocation/invoking": "Fetching transactions...",
        "openai/toolInvocation/invoked": "Transactions retrieved",
        // TODO: Add openai/outputTemplate when widget is built
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      securitySchemes: [{ type: "noauth" }, { type: "oauth2", scopes: ["transactions:read"] }],
    } as ExtendedToolConfig,
    async ({ startDate, endDate, limit }: { startDate?: string; endDate?: string; limit?: number }) => {
      try {
        if (!session || !(await hasActiveSubscription(session.userId))) {
          return createSubscriptionRequiredResponse("transactions");
        }

        // Check 3: Plaid Connection
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        if (accessTokens.length === 0) {
          return createPlaidRequiredResponse();
        }

        // Default date range: last 30 days
        const end = endDate || new Date().toISOString().split("T")[0];
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Fetch transactions from all accounts
        const allTransactions = [];
        for (const accessToken of accessTokens) {
          const result = await getTransactions(accessToken, start, end);
          allTransactions.push(...result.transactions);
        }

        // Sort by date (most recent first) and limit
        allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const limitedTransactions = allTransactions.slice(0, limit || 100);

        const output = {
          transactions: limitedTransactions,
          totalTransactions: allTransactions.length,
          dateRange: { start, end },
        };

        return {
          content: [
            {
              type: "text",
              text: `Found ${allTransactions.length} transaction(s) from ${start} to ${end}`,
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        console.error("[Tool] get_transactions error", { error });
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "Failed to fetch transactions",
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Spending Insights
  server.registerTool(
    "get_spending_insights",
    {
      title: "Get Spending Insights",
      description: "Analyze spending patterns by category. Shows an interactive visualization. Requires authentication.",
      inputSchema: {
        startDate: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to 30 days ago."),
        endDate: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to today."),
      },
      _meta: {
        securitySchemes: [{ type: "oauth2" }], // Back-compat mirror for ChatGPT
        "openai/toolInvocation/invoking": "Analyzing spending...",
        "openai/toolInvocation/invoked": "Spending analysis ready",
        // TODO: Add openai/outputTemplate when widget is built
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      securitySchemes: [{ type: "noauth" }, { type: "oauth2", scopes: ["insights:read"] }],
    } as ExtendedToolConfig,
    async ({ startDate, endDate }: { startDate?: string; endDate?: string }) => {
      try {
        if (!session || !(await hasActiveSubscription(session.userId))) {
          return createSubscriptionRequiredResponse("spending insights");
        }

        // Check 3: Plaid Connection
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        if (accessTokens.length === 0) {
          return createPlaidRequiredResponse();
        }

        const end = endDate || new Date().toISOString().split("T")[0];
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Get spending insights from all accounts
        const allInsights = [];
        for (const accessToken of accessTokens) {
          const insights = await getSpendingInsights(accessToken, start, end);
          allInsights.push(insights);
        }

        // Merge insights from multiple accounts
        const categoryMap = new Map<string, { amount: number; count: number }>();
        let totalSpending = 0;

        for (const insights of allInsights) {
          for (const cat of insights.categoryBreakdown) {
            const existing = categoryMap.get(cat.category) || { amount: 0, count: 0 };
            categoryMap.set(cat.category, {
              amount: existing.amount + cat.amount,
              count: existing.count + 1,
            });
            totalSpending += cat.amount;
          }
        }

        // Convert to array and calculate percentages
        const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
          name,
          amount: data.amount,
          count: data.count,
          percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
        }));

        // Sort by amount (highest first)
        categories.sort((a, b) => b.amount - a.amount);

        const output = {
          categories,
          totalSpending,
          dateRange: { start, end },
        };

        return {
          content: [
            {
              type: "text",
              text: `Total spending: $${totalSpending.toFixed(2)} across ${categories.length} categories from ${start} to ${end}`,
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        console.error("[Tool] get_spending_insights error", { error });
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "Failed to analyze spending",
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Check Account Health
  server.registerTool(
    "check_account_health",
    {
      title: "Check Account Health",
      description: "Get account health information including balances, warnings, and status. Requires authentication.",
      inputSchema: {},
      _meta: {
        securitySchemes: [{ type: "oauth2" }], // Back-compat mirror for ChatGPT
        // TODO: Add openai/outputTemplate when widget is built
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      securitySchemes: [{ type: "noauth" }, { type: "oauth2", scopes: ["health:read"] }],
    } as ExtendedToolConfig,
    async () => {
      try {
        if (!session) {
          return createLoginPromptResponse("account health check");
        }

        // Check 2: Active Subscription
        const hasSubscription = await hasActiveSubscription(session.userId);
        if (!hasSubscription) {
          return createSubscriptionRequiredResponse("account health check");
        }

        // Check 3: Plaid Connection
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        if (accessTokens.length === 0) {
          return createPlaidRequiredResponse();
        }

        // Collect health data from all accounts
        const allAccounts = [];
        let overallStatus: "healthy" | "attention_needed" = "healthy";

        for (const accessToken of accessTokens) {
          const health = await checkAccountHealth(accessToken);
          allAccounts.push(...health.accounts);

          if (health.overallStatus === "attention_needed") {
            overallStatus = "attention_needed";
          }
        }

        const totalWarnings = allAccounts.reduce((sum, account) => sum + account.warnings.length, 0);

        const output = {
          accounts: allAccounts,
          overallStatus,
          summary: {
            totalAccounts: allAccounts.length,
            accountsWithWarnings: allAccounts.filter((a) => a.warnings.length > 0).length,
          },
        };

        const statusEmoji = overallStatus === "healthy" ? "✅" : "⚠️";
        const statusText =
          overallStatus === "healthy"
            ? "All accounts are in good standing."
            : `${totalWarnings} warning(s) detected across ${output.summary.accountsWithWarnings} account(s).`;

        return {
          content: [
            {
              type: "text",
              text: `${statusEmoji} ${statusText}\n\nChecked ${allAccounts.length} account(s).`,
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        console.error("[Tool] check_account_health error", { error });
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "Failed to check account health",
            },
          ],
          isError: true,
        };
      }
    }
  );

    // ============================================================================
    // TEST WIDGET
    // ============================================================================
    server.registerTool(
      "test_widget",
      {
        title: "Test Widget",
        description: "A simple widget to test basic functionality.",
        inputSchema: {},
        _meta: {
          // Widget template removed until implemented
        },
        securitySchemes: [{ type: "noauth" }],
      } as ExtendedToolConfig,
      async () => {
        return {
          content: [
            {
              type: "text",
              text: "Hello from the test widget!",
            },
          ],
          structuredContent: {
            message: "Hello from the test widget!",
          },
        };
      }
    );

    // ============================================================================
    // SUBSCRIPTION CHECKOUT
    // ============================================================================
    server.registerTool(
      "create_checkout_session",
      {
        title: "Create Subscription Checkout",
        description: "Create a Stripe checkout session for subscription. Can be called from widgets.",
        inputSchema: {
          plan: z.enum(['basic', 'pro', 'enterprise']).describe("The subscription plan to purchase"),
        },
        _meta: {
          securitySchemes: [{ type: "oauth2" }], // Back-compat mirror for ChatGPT
          "openai/widgetAccessible": true,  // Allow widgets to call this tool
        },
        securitySchemes: [{ type: "oauth2" }],
      } as ExtendedToolConfig,
      async (args) => {
        try {
          if (!session) {
            return {
              content: [{ type: "text", text: "Authentication required" }],
              isError: true,
            };
          }

          const plan = args.plan as string;
          const baseUrl = process.env.BETTER_AUTH_URL || 'https://dev.askmymoney.ai';

          console.log('[Checkout Session] MCP Session userId:', session.userId);

          // TODO: Implement Stripe checkout session creation
          // This would require Stripe SDK integration
          const checkoutUrl = `${baseUrl}/pricing?plan=${plan}`;

          console.log('[Checkout Session] Redirecting to pricing page:', checkoutUrl);

          const result = { url: checkoutUrl };

          return {
            content: [{
              type: "text",
              text: `Checkout session created for ${plan} plan`,
            }],
            structuredContent: {
              checkoutUrl: result.url,
              plan,
            },
          };
        } catch (error) {
          console.error('[Tool] create_checkout_session error', { error });
          return {
            content: [{
              type: "text",
              text: error instanceof Error ? error.message : "Failed to create checkout session",
            }],
            isError: true,
          };
        }
      }
    );

    // ============================================================================
    // ADVANCED TEST WIDGET
    // ============================================================================
    server.registerTool(
      "advanced_test_widget",
      {
        title: "Advanced Test Widget",
        description: "A more complex widget to test state and tool calls.",
        inputSchema: {},
        _meta: {
          // Widget template removed until implemented
        },
        securitySchemes: [{ type: "noauth" }],
      } as ExtendedToolConfig,
      async () => {
        return {
          content: [
            {
              type: "text",
              text: "Advanced test widget loaded.",
            },
          ],
          structuredContent: {
            message: "Initial message",
          },
        };
      }
    );

    server.registerTool(
      "test_widget_action",
      {
        title: "Test Widget Action",
        description: "A simple action that can be called from the advanced test widget.",
        inputSchema: {
          current_count: z.number(),
        },
        securitySchemes: [{ type: "noauth" }],
      } as ExtendedToolConfig,
      async ({ current_count }) => {
        return {
          content: [
            {
              type: "text",
              text: `The count is ${current_count}.`,
            },
          ],
          structuredContent: {
            message: `The count from the tool call is ${current_count}.`,
          },
        };
      }
    );
  // ============================================================================
  // FREE TIER TOOLS (No Authentication Required)
  // ============================================================================

  // Get Financial Tips
  server.registerTool(
    "get_financial_tips",
    {
      title: "Get Financial Tips",
      description: "Get educational financial advice on budgeting, saving, investing, debt management, or credit. Free tool, no authentication required.",
      inputSchema: {
        topic: z
          .enum(["budgeting", "saving", "investing", "debt", "credit", "general"])
          .optional()
          .describe("The financial topic to get tips about. Defaults to 'general'."),
      },
      outputSchema: {
        topic: z.string(),
        tips: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            category: z.string(),
          })
        ),
        resources: z.array(z.string()).optional(),
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      securitySchemes: [{ type: "noauth" }],
    } as ExtendedToolConfig,
    async ({ topic = "general" }: { topic?: string }) => {
      // Educational financial tips organized by topic
      const tipsByTopic: Record<string, Array<{ title: string; description: string; category: string }>> = {
        budgeting: [
          {
            title: "Follow the 50/30/20 Rule",
            description: "Allocate 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.",
            category: "budgeting",
          },
          {
            title: "Track Every Expense",
            description: "Use a budgeting app or spreadsheet to monitor where your money goes each month.",
            category: "budgeting",
          },
          {
            title: "Create a Zero-Based Budget",
            description: "Assign every dollar a purpose so income minus expenses equals zero.",
            category: "budgeting",
          },
          {
            title: "Review and Adjust Monthly",
            description: "Analyze your spending patterns and adjust your budget categories as needed.",
            category: "budgeting",
          },
        ],
        saving: [
          {
            title: "Build an Emergency Fund",
            description: "Save 3-6 months of expenses in a high-yield savings account for unexpected costs.",
            category: "saving",
          },
          {
            title: "Automate Your Savings",
            description: "Set up automatic transfers to savings accounts on payday.",
            category: "saving",
          },
          {
            title: "Use the Pay Yourself First Method",
            description: "Save a percentage of income before spending on anything else.",
            category: "saving",
          },
          {
            title: "Take Advantage of Employer Match",
            description: "Contribute enough to your 401(k) to get the full employer match - it's free money.",
            category: "saving",
          },
        ],
        investing: [
          {
            title: "Start Early with Compound Interest",
            description: "Time in the market beats timing the market. Start investing as soon as possible.",
            category: "investing",
          },
          {
            title: "Diversify Your Portfolio",
            description: "Spread investments across different asset classes to reduce risk.",
            category: "investing",
          },
          {
            title: "Consider Low-Cost Index Funds",
            description: "Index funds offer broad market exposure with low fees.",
            category: "investing",
          },
          {
            title: "Invest for the Long Term",
            description: "Avoid reacting to short-term market volatility and maintain a long-term perspective.",
            category: "investing",
          },
        ],
        debt: [
          {
            title: "Use the Debt Avalanche Method",
            description: "Pay off debts with the highest interest rates first while making minimum payments on others.",
            category: "debt",
          },
          {
            title: "Consider Debt Consolidation",
            description: "Combine multiple debts into one loan with a lower interest rate if possible.",
            category: "debt",
          },
          {
            title: "Negotiate with Creditors",
            description: "Contact creditors to negotiate lower interest rates or payment plans.",
            category: "debt",
          },
          {
            title: "Avoid New Debt While Paying Off Old",
            description: "Focus on reducing existing debt before taking on new obligations.",
            category: "debt",
          },
        ],
        credit: [
          {
            title: "Pay Your Bills On Time",
            description: "Payment history is the biggest factor in your credit score (35%).",
            category: "credit",
          },
          {
            title: "Keep Credit Utilization Below 30%",
            description: "Use less than 30% of your available credit limit on each card.",
            category: "credit",
          },
          {
            title: "Don't Close Old Credit Cards",
            description: "Length of credit history matters. Keep old accounts open even if unused.",
            category: "credit",
          },
          {
            title: "Monitor Your Credit Report",
            description: "Check your credit report annually for errors and signs of identity theft.",
            category: "credit",
          },
        ],
        general: [
          {
            title: "Live Below Your Means",
            description: "Spend less than you earn and invest the difference for long-term wealth building.",
            category: "general",
          },
          {
            title: "Educate Yourself Continuously",
            description: "Read books, listen to podcasts, and learn about personal finance regularly.",
            category: "general",
          },
          {
            title: "Set Clear Financial Goals",
            description: "Define specific, measurable financial goals with deadlines.",
            category: "general",
          },
          {
            title: "Protect Your Assets with Insurance",
            description: "Ensure you have adequate health, life, disability, and property insurance.",
            category: "general",
          },
        ],
      };

      const tips = tipsByTopic[topic] || tipsByTopic.general;

      const output = {
        topic,
        tips,
        resources: [
          "https://www.consumerfinance.gov/",
          "https://www.investor.gov/",
          "https://www.fdic.gov/resources/consumers/",
        ],
      };

      return {
        content: [
          {
            type: "text",
            text: `Here are ${tips.length} financial tips for ${topic}:\n\n${tips.map((tip, i) => `${i + 1}. **${tip.title}**: ${tip.description}`).join("\n\n")}`,
          },
        ],
        structuredContent: output,
      };
    }
  );

  // Calculate Budget (50/30/20 Rule)
  server.registerTool(
    "calculate_budget",
    {
      title: "Calculate Budget",
      description: "Calculate recommended budget allocations using the 50/30/20 rule. No authentication required.",
      inputSchema: {
        monthlyIncome: z.number().positive().describe("Monthly after-tax income in dollars"),
        hasDebts: z.boolean().optional().describe("Whether you have high-interest debts to pay off"),
      },
      outputSchema: {
        monthlyIncome: z.number(),
        needs: z.object({ amount: z.number(), percentage: z.number() }),
        wants: z.object({ amount: z.number(), percentage: z.number() }),
        savings: z.object({ amount: z.number(), percentage: z.number() }),
        debtPayment: z.object({ amount: z.number(), percentage: z.number() }).optional(),
        recommendations: z.array(z.string()),
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      securitySchemes: [{ type: "noauth" }],
    } as ExtendedToolConfig,
    async ({ monthlyIncome, hasDebts = false }) => {
      // Standard 50/30/20 rule
      let needsPercent = 50;
      let wantsPercent = 30;
      let savingsPercent = 20;
      let debtPercent = 0;

      // If user has debts, recommend aggressive debt payoff
      if (hasDebts) {
        needsPercent = 50;
        wantsPercent = 20;
        savingsPercent = 10;
        debtPercent = 20;
      }

      const needs = (monthlyIncome * needsPercent) / 100;
      const wants = (monthlyIncome * wantsPercent) / 100;
      const savings = (monthlyIncome * savingsPercent) / 100;
      const debt = hasDebts ? (monthlyIncome * debtPercent) / 100 : 0;

      const recommendations = [
        `Allocate $${needs.toFixed(2)} (${needsPercent}%) to needs like housing, food, utilities, and transportation.`,
        `Set aside $${wants.toFixed(2)} (${wantsPercent}%) for wants like dining out, entertainment, and hobbies.`,
        `Save $${savings.toFixed(2)} (${savingsPercent}%) for emergency fund and long-term goals.`,
      ];

      if (hasDebts) {
        recommendations.push(`Pay $${debt.toFixed(2)} (${debtPercent}%) toward high-interest debt to become debt-free faster.`);
        recommendations.push("Focus on eliminating high-interest debt before increasing investment contributions.");
      } else {
        recommendations.push("Consider increasing savings rate once you're comfortable with your budget.");
      }

      const output = {
        monthlyIncome,
        needs: { amount: needs, percentage: needsPercent },
        wants: { amount: wants, percentage: wantsPercent },
        savings: { amount: savings, percentage: savingsPercent },
        ...(hasDebts && { debtPayment: { amount: debt, percentage: debtPercent } }),
        recommendations,
      };

      return {
        content: [
          {
            type: "text",
            text:
            `Budget breakdown for $${monthlyIncome.toFixed(2)}/month:\n\n` +
            `💰 Needs: $${needs.toFixed(2)} (${needsPercent}%)\n` +
            `🎯 Wants: $${wants.toFixed(2)} (${wantsPercent}%)\n` +
            `📈 Savings: $${savings.toFixed(2)} (${savingsPercent}%)\n` +
            (hasDebts ? `💳 Debt Payment: $${debt.toFixed(2)} (${debtPercent}%)\n` : "") +
            `\n${recommendations.join("\n")}`,
          },
        ],
        structuredContent: output,
      };
    }
  );

})(req);
});

// Wrap handlers with error logging
const wrappedHandler = async (req: Request) => {
  try {
    logOAuthRequest('MCP', req);

    // Check if this is a tools/list request for detailed logging
    const clonedReq = req.clone();
    let isToolsList = false;
    try {
      const body = await clonedReq.text();
      if (body) {
        const parsed = JSON.parse(body);
        isToolsList = parsed.method === 'tools/list';
      }
    } catch (e) {
      // Ignore parsing errors
    }

    const response = await handler(req);

    console.log('[MCP] Response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
    });

    // Patch tools/list response to add top-level securitySchemes for ChatGPT compatibility
    if (isToolsList && response.ok) {
      const clonedResponse = response.clone();
      try {
        const text = await clonedResponse.text();
        const lines = text.split('\n');
        const patchedLines: string[] = [];
        let wasPatched = false;

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            if (data.result?.tools) {
              // Patch each tool to copy _meta.securitySchemes to top level
              for (const tool of data.result.tools) {
                if (tool._meta?.securitySchemes && !tool.securitySchemes) {
                  tool.securitySchemes = tool._meta.securitySchemes;
                  wasPatched = true;
                  console.log(`[MCP] Patched ${tool.name} with securitySchemes:`, tool.securitySchemes);
                }
              }

              // Log the patched result
              console.log('[MCP] tools/list response (after patching):', {
                toolCount: data.result.tools.length,
                wasPatched,
                tools: data.result.tools.map((t: any) => ({
                  name: t.name,
                  hasSecuritySchemes: !!t.securitySchemes,
                  hasMetaSecuritySchemes: !!t._meta?.securitySchemes,
                  securitySchemes: t.securitySchemes,
                  metaSecuritySchemes: t._meta?.securitySchemes,
                })),
              });

              // Rebuild the line with patched data
              patchedLines.push('data: ' + JSON.stringify(data));
            } else {
              patchedLines.push(line);
            }
          } else {
            patchedLines.push(line);
          }
        }

        // Return patched response if we made changes
        if (wasPatched) {
          console.log('[MCP] Returning patched tools/list response');
          return new Response(patchedLines.join('\n'), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch (e) {
        console.error('[MCP] Failed to patch tools/list response:', e);
      }
    }

    return response;
  } catch (error) {
    logOAuthError('MCP', error, {
      url: req.url,
      method: req.method,
    });

    // Return a proper error response
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export { wrappedHandler as GET, wrappedHandler as POST };
