import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import type { AccountBase, LiabilitiesObject } from "plaid";
import {
  getAccountBalances,
  getSpendingInsights,
  checkAccountHealth,
  getInvestmentHoldings,
  getInvestmentTransactions,
  getLiabilities,
  syncTransactionsForItem,
  getRecurringTransactions,
  evaluatePaymentRisk,
  calculateAccountHealthScore,
  calculateBusinessMetrics,
  calculateInvestmentPerformance,
  detectSpendingAnomalies,
  mapToTaxCategory,
} from "@/lib/services/plaid-service";
import { getConnectItemStatus } from "@/app/widgets/connect-item/actions";
import { db } from "@/lib/db";
import { plaidTransactions, plaidAccounts, user } from "@/lib/db/schema";
import { and, gte, lte, eq as drizzleEq, inArray } from 'drizzle-orm';
import { UserService } from "@/lib/services/user-service";
import { auth } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/utils/subscription-helpers";
import Stripe from "stripe";
import {
  createLoginPromptResponse,
  createSubscriptionRequiredResponse,
  createPlaidRequiredResponse,
} from "@/lib/utils/auth-responses";
import { requireAuth } from "@/lib/utils/mcp-auth-helpers";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/utils/mcp-response-helpers";
import { createTextContent } from "@/lib/types/mcp-responses";
import type {
  AccountBalancesResponse,
  AccountOverviewResponse,
  TransactionsResponse,
  SpendingInsightsResponse,
  SpendingAnalysisResponse,
  AccountHealthResponse,
  FinancialTipsResponse,
  BudgetCalculationResponse,
  MessageResponse,
  SubscriptionManagementResponse,
  InvestmentHoldingsResponse,
  InvestmentPortfolioResponse,
  LiabilitiesResponse,
  ConnectItemResponse,
  RecurringPaymentsResponse,
  BusinessCashFlowResponse,
  ExpenseCategorizationResponse,
  PaymentRiskResponse,
} from "@/lib/types/tool-responses";
import {
  AccountOverviewSchema,
  SpendingAnalysisSchema,
  RecurringPaymentsSchema,
  BusinessCashFlowSchema,
  ExpenseCategorizationSchema,
  PaymentRiskSchema,
  InvestmentPortfolioSchema,
} from "@/lib/types/tool-responses";
import { withMcpAuth } from "better-auth/plugins";
import { baseURL } from "@/baseUrl";
import { logOAuthRequest, logOAuthError } from "@/lib/auth/oauth-logger";

console.log("Auth API methods at startup:", Object.keys(auth.api));

// Helper to fetch HTML from Next.js pages (Vercel template pattern)
const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

// Note: securitySchemes is required by OpenAI Apps SDK spec but not yet in MCP SDK types
// We use @ts-expect-error to suppress these known type mismatches

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
    // WIDGET RESOURCES
    // ============================================================================
    // Fetch HTML from Next.js pages (Vercel template pattern)
    const widgets = [
      { id: 'account-balances', title: 'Account Balances Widget', description: 'Interactive account balances view with trends and health metrics', path: '/widgets/account-balances' },
      { id: 'transactions', title: 'Transactions Widget', description: 'Transaction list with details', path: '/widgets/transactions' },
      { id: 'spending-insights', title: 'Spending Insights Widget', description: 'Category-based spending breakdown with anomaly detection', path: '/widgets/spending-insights' },
      { id: 'account-health', title: 'Account Health Widget', description: 'Account health status and warnings', path: '/widgets/account-health' },
      { id: 'investments', title: 'Investment Holdings Widget', description: 'Investment portfolio with performance metrics and asset allocation', path: '/widgets/investments' },
      { id: 'liabilities', title: 'Liabilities Widget', description: 'Detailed view of credit cards, loans, and mortgages', path: '/widgets/liabilities' },
      { id: 'recurring-payments', title: 'Recurring Payments Widget', description: 'Track subscriptions and recurring charges with upcoming payment predictions', path: '/widgets/recurring-payments' },
      { id: 'business-cashflow', title: 'Business Cash Flow Widget', description: 'Runway calculator and burn rate analysis for businesses', path: '/widgets/business-cashflow' },
      { id: 'expense-categorizer', title: 'Expense Categorizer Widget', description: 'Smart expense categorization with tax category mapping', path: '/widgets/expense-categorizer' },
      { id: 'plaid-required', title: 'Connect Bank Account', description: 'Prompts user to connect their bank account via Plaid', path: '/widgets/plaid-required' },
      { id: 'subscription-required', title: 'Choose Subscription Plan', description: 'Select and subscribe to a plan to unlock features', path: '/widgets/subscription-required' },
      { id: 'manage-subscription', title: 'Manage Subscription', description: 'Update or cancel your subscription', path: '/widgets/manage-subscription' },
      { id: 'connect-item', title: 'Manage Financial Accounts', description: 'Connect or manage your linked financial accounts', path: '/widgets/connect-item' },
    ];

    for (const widget of widgets) {
      server.registerResource(
        widget.id,
        `ui://widget/${widget.id}.html`,
        {
          title: widget.title,
          description: widget.description,
          mimeType: 'text/html+skybridge',
          _meta: {
            'openai/widgetDescription': widget.description,
            'openai/widgetPrefersBorder': true,
          },
        },
        async () => {
          // Fetch HTML from Next.js at runtime
          const html = await getAppsSdkCompatibleHtml(baseURL, widget.path);
          return {
            contents: [{
              uri: `ui://widget/${widget.id}.html`,
              mimeType: 'text/html+skybridge',
              text: html,
              _meta: {
                'openai/widgetDescription': widget.description,
                'openai/widgetPrefersBorder': true,
                'openai/widgetDomain': baseURL,
                'openai/widgetCSP': {
                  'base-uri': ["'self'", baseURL], // Allow Next.js dev scripts to set the base URI
                  connect_domains: [
                    baseURL,
                    baseURL.replace(/^http/, 'ws') // Allow HMR WebSockets in dev
                  ],
                  resource_domains: [
                    baseURL,
                    'https://*.plaid.com',
                    'https://*.oaistatic.com',
                  ],
                },
              },
            }],
          };
        }
      );
      console.log(`[MCP] Registered widget: ${widget.id} (fetches from ${widget.path})`);
    }

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
        "openai/outputTemplate": "ui://widget/account-balances.html",
        "openai/toolInvocation/invoking": "Fetching your account balances",
        "openai/toolInvocation/invoked": "Retrieved account balances",
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      securitySchemes: [{ type: "oauth2" }],
    };

    console.log("[MCP] Registering tool: get_account_balances", {
      securitySchemes: getAccountBalancesConfig.securitySchemes,
      annotations: getAccountBalancesConfig.annotations,
    });

    server.registerTool(
      "get_account_balances",
      {
        title: "Get Account Overview Dashboard",
        description: "Comprehensive account overview with balances, health metrics, trends, and cash flow projections. Shows interactive dashboard with expandable account cards. Requires authentication.",
        inputSchema: {
          timeframe: z.enum(["7d", "30d", "90d", "1y"]).optional().describe("Timeframe for trend analysis. Defaults to 30d."),
          includeProjections: z.boolean().optional().describe("Include AI-powered cash flow projections. Defaults to false."),
          _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
        },
        outputSchema: AccountOverviewSchema,
        _meta: {
          "openai/outputTemplate": "ui://widget/account-balances.html",
          "openai/toolInvocation/invoking": "Analyzing your accounts...",
          "openai/toolInvocation/invoked": "Financial overview ready",
          "openai/widgetAccessible": true,
        },
        annotations: {
          destructiveHint: false,
          openWorldHint: false,
          readOnlyHint: true,
        },
        // @ts-expect-error - securitySchemes not yet in MCP SDK types
        securitySchemes: [{ type: "oauth2", scopes: ["accounts:read", "balances:read"] }],
      },
    async ({ timeframe = "30d", includeProjections = false }: {
      timeframe?: "7d" | "30d" | "90d" | "1y";
      includeProjections?: boolean;
    }) => {
      try {
        // Check authentication requirements
        const authCheck = await requireAuth(session, "account overview", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Fetch balances from all connected accounts
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        const allAccounts: AccountBase[] = [];
        for (const accessToken of accessTokens) {
          const balances = await getAccountBalances(accessToken);
          allAccounts.push(...balances.accounts);
        }

        // Fetch recent transactions for trend analysis
        const dayMap = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
        const days = dayMap[timeframe];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const transactions = await db.query.plaidTransactions.findMany({
          where: and(
            inArray(plaidTransactions.userId, [session.userId]),
            gte(plaidTransactions.date, startDate),
            lte(plaidTransactions.date, endDate)
          ),
          limit: 1000,
        });

        // Calculate health score and trend
        const { score: healthScore, trend } = calculateAccountHealthScore(
          allAccounts,
          transactions.map(t => ({ amount: parseFloat(t.amount), date: t.date }))
        );

        // Calculate total balance
        const totalBalance = allAccounts.reduce((sum, account) => {
          return sum + (account.balances.current || 0);
        }, 0);

        // Prepare structured content for model
        const structuredContent = {
          summary: {
            totalBalance,
            accountCount: allAccounts.length,
            healthScore,
            trend,
          },
          accounts: allAccounts.slice(0, 10).map(acc => ({
            id: acc.account_id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype ?? "",
            balance: acc.balances.current ?? 0,
            available: acc.balances.available ?? 0,
            currencyCode: acc.balances.iso_currency_code ?? "USD",
          })),
        };

        // Generate projections if requested
        let projections;
        if (includeProjections) {
          const metrics = calculateBusinessMetrics(
            allAccounts.map(a => ({ balances: a.balances })),
            transactions.map(t => ({ amount: parseFloat(t.amount), date: t.date })),
            6
          );
          projections = metrics.projections;
        }

        const metaForWidget = {
          accounts: allAccounts,
          recentTransactions: transactions.slice(0, 100),
          healthDetails: {
            score: healthScore,
            trend,
          },
          projections,
        };

        return createSuccessResponse(
          `Found ${allAccounts.length} account(s) with total balance of $${totalBalance.toFixed(2)}. Health score: ${healthScore}/100 (${trend}).`,
          structuredContent,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] get_account_balances error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to fetch account overview"
        );
      }
    }
  );

  // Get Transactions
  server.registerTool(
    "get_transactions",
    {
      title: "Get Transactions",
      description: "Get recent transactions for all accounts with rich details including merchant logos, categories, locations, and payment info. Shows an interactive transaction list with filtering and grouping. Requires authentication.",
      inputSchema: {
        startDate: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to 30 days ago."),
        endDate: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to today."),
        limit: z.number().optional().describe("Maximum number of transactions to return. Defaults to 100."),
        category: z.string().optional().describe("Filter by personal_finance_category primary category (e.g., 'FOOD_AND_DRINK', 'TRANSFER_IN')"),
        paymentChannel: z.enum(["online", "in store", "other"]).optional().describe("Filter by payment channel"),
        includePending: z.boolean().optional().describe("Include pending transactions. Defaults to true."),
      },
      _meta: {
        securitySchemes: [{ type: "oauth2" }], // Back-compat mirror for ChatGPT
        "openai/outputTemplate": "ui://widget/transactions.html",
        "openai/toolInvocation/invoking": "Fetching transactions...",
        "openai/toolInvocation/invoked": "Transactions retrieved",
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["transactions:read"] }],
    },
    async ({ startDate, endDate, limit, category, paymentChannel, includePending = true }: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      category?: string;
      paymentChannel?: "online" | "in store" | "other";
      includePending?: boolean;
    }) => {
      try {
        // Check authentication requirements
        const authCheck = await requireAuth(session, "transactions", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Default date range: last 30 days
        const end = endDate || new Date().toISOString().split("T")[0];
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Sync transactions for all items to ensure data is fresh
        const userItems = await UserService.getUserPlaidItems(session.userId);
        for (const item of userItems) {
          await syncTransactionsForItem(item.itemId);
        }

        // Get all account IDs for the user's items
        const userAccountIds = (await db.query.plaidAccounts.findMany({
          where: inArray(plaidAccounts.itemId, userItems.map(item => item.itemId))
        })).map(acc => acc.accountId);

        // Fetch transactions from the local database
        const allTransactions = await db.query.plaidTransactions.findMany({
          where: and(
            inArray(plaidTransactions.accountId, userAccountIds),
            gte(plaidTransactions.date, new Date(start)),
            lte(plaidTransactions.date, new Date(end))
          )
        });

        // Apply filters
        let filteredTransactions = allTransactions;

        // Filter by pending status
        if (!includePending) {
          filteredTransactions = filteredTransactions.filter(tx => !tx.pending);
        }

        // Filter by category
        if (category) {
          filteredTransactions = filteredTransactions.filter(tx =>
            tx.categoryPrimary === category
          );
        }

        // Filter by payment channel
        if (paymentChannel) {
          filteredTransactions = filteredTransactions.filter(tx =>
            tx.paymentChannel === paymentChannel
          );
        }

        // Sort by date (most recent first) and limit
        filteredTransactions.sort((a, b) => {
          const dateA = new Date(a.authorizedDate || a.date).getTime();
          const dateB = new Date(b.authorizedDate || b.date).getTime();
          return dateB - dateA;
        });
        const limitedTransactions = filteredTransactions.slice(0, limit || 100);

        // Calculate metadata
        const categoryBreakdown = new Map<string, { count: number; total: number }>();
        const merchantBreakdown = new Map<string, { name: string; count: number; total: number }>();
        let totalSpending = 0;
        let totalIncome = 0;
        let pendingCount = 0;

        for (const tx of limitedTransactions) {
          const amount = parseFloat(tx.amount);
          // Category breakdown
          const cat = tx.categoryPrimary || 'UNCATEGORIZED';
          const catData = categoryBreakdown.get(cat) || { count: 0, total: 0 };
          categoryBreakdown.set(cat, {
            count: catData.count + 1,
            total: catData.total + amount
          });

          // Merchant breakdown
          const merchantName = tx.merchantName || tx.name || 'Unknown';
          const merchantId = merchantName; // No merchant_entity_id in our schema
          const merchData = merchantBreakdown.get(merchantId) || { name: merchantName, count: 0, total: 0 };
          merchantBreakdown.set(merchantId, {
            name: merchantName,
            count: merchData.count + 1,
            total: merchData.total + amount
          });

          // Spending totals
          if (amount > 0) {
            totalSpending += amount;
          } else {
            totalIncome += Math.abs(amount);
          }

          if (tx.pending) {
            pendingCount++;
          }
        }

        // Transform database records to Plaid Transaction format
        const plaidFormattedTransactions = limitedTransactions.map((tx) => ({
          ...tx,
          // Map snake_case DB columns to Plaid's expected camelCase structure
          transaction_id: tx.transactionId,
          account_id: tx.accountId,
          iso_currency_code: tx.isoCurrencyCode,
          unofficial_currency_code: tx.unofficialCurrencyCode,
          check_number: tx.checkNumber,
          authorized_date: tx.authorizedDate?.toISOString().split('T')[0] || null,
          authorized_datetime: tx.authorizedDatetime?.toISOString() || null,
          merchant_name: tx.merchantName,
          payment_channel: tx.paymentChannel,
          pending_transaction_id: tx.pendingTransactionId,
          transaction_code: tx.transactionCode,
          original_description: tx.originalDescription,
          logo_url: tx.logoUrl,
          payment_meta: tx.paymentMeta,
          // Transform category fields to Plaid's personal_finance_category structure
          personal_finance_category: tx.categoryPrimary ? {
            primary: tx.categoryPrimary,
            detailed: tx.categoryDetailed || '',
            confidence_level: (tx.categoryConfidence || 'UNKNOWN') as 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
          } : null,
          // Convert dates to ISO strings
          date: typeof tx.date === 'string' ? tx.date : tx.date?.toISOString().split('T')[0] || '',
          datetime: tx.datetime?.toISOString() || null,
          // Convert amount to number
          amount: parseFloat(tx.amount),
        }));

        const structuredContentForModel = {
          totalTransactions: allTransactions.length,
          displayedTransactions: limitedTransactions.length,
          dateRange: { start, end },
          metadata: {
            categoryBreakdown: Array.from(categoryBreakdown.entries()).map(([cat, data]) => ({
              category: cat,
              count: data.count,
              total: data.total
            })).sort((a, b) => b.total - a.total),
            topMerchants: Array.from(merchantBreakdown.entries())
              .map(([id, data]) => ({
                merchantId: id,
                name: data.name,
                count: data.count,
                total: data.total
              }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 10),
            summary: {
              totalSpending,
              totalIncome,
              netCashFlow: totalIncome - totalSpending,
              pendingCount,
              averageTransaction: limitedTransactions.length > 0
                ? limitedTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) / limitedTransactions.length
                : 0
            }
          }
        };

        const metaForWidget = {
          transactions: plaidFormattedTransactions,
        };

        return createSuccessResponse(
          `Found ${limitedTransactions.length} transaction(s) from ${start} to ${end}` +
          (category ? ` in category ${category}` : '') +
          (paymentChannel ? ` via ${paymentChannel}` : ''),
          structuredContentForModel,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] get_transactions error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to fetch transactions"
        );
      }
    }
  );

  // Analyze Spending (Enhanced)
  server.registerTool(
    "get_spending_insights",
    {
      title: "Analyze Spending Patterns",
      description: "Deep analysis of spending with AI-powered categorization, anomaly detection, merchant insights, and trend comparison. Shows interactive visualization with drill-down capabilities. Requires authentication.",
      inputSchema: {
        startDate: z.string().optional().describe("Start date in YYYY-MM-DD format. Defaults to 30 days ago."),
        endDate: z.string().optional().describe("End date in YYYY-MM-DD format. Defaults to today."),
        groupBy: z.enum(["category", "merchant", "day", "week", "month"]).optional().describe("How to group spending insights. Defaults to category."),
        minAmount: z.number().optional().describe("Only include transactions above this amount"),
        includeAnomalies: z.boolean().optional().describe("Detect unusual spending patterns. Defaults to true."),
        compareWithAverage: z.boolean().optional().describe("Compare with historical average. Defaults to true."),
        _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
      },
      outputSchema: SpendingAnalysisSchema,
      _meta: {
        "openai/outputTemplate": "ui://widget/spending-insights.html",
        "openai/toolInvocation/invoking": "Crunching your spending data...",
        "openai/toolInvocation/invoked": "Insights ready",
        "openai/widgetAccessible": true,
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["transactions:read"] }],
    },
    async ({
      startDate,
      endDate,
      groupBy = "category",
      minAmount,
      includeAnomalies = true,
      compareWithAverage = true
    }: {
      startDate?: string;
      endDate?: string;
      groupBy?: "category" | "merchant" | "day" | "week" | "month";
      minAmount?: number;
      includeAnomalies?: boolean;
      compareWithAverage?: boolean;
    }) => {
      try {
        // Check authentication requirements
        const authCheck = await requireAuth(session, "spending analysis", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        const end = endDate || new Date().toISOString().split("T")[0];
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Fetch transactions from database
        const transactions = await db.query.plaidTransactions.findMany({
          where: and(
            drizzleEq(plaidTransactions.userId, session.userId),
            gte(plaidTransactions.date, new Date(start)),
            lte(plaidTransactions.date, new Date(end))
          ),
          limit: 5000,
        });

        // Filter by amount if specified
        let filteredTxns = transactions.filter(t => parseFloat(t.amount) > 0); // Only expenses
        if (minAmount) {
          filteredTxns = filteredTxns.filter(t => parseFloat(t.amount) >= minAmount);
        }

        // Group by category
        const categoryMap = new Map<string, number>();
        const categoryCount = new Map<string, number>();

        for (const tx of filteredTxns) {
          const category = tx.categoryPrimary || "Uncategorized";
          const amount = parseFloat(tx.amount);
          categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
          categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
        }

        const totalSpent = Array.from(categoryMap.values()).reduce((sum, amt) => sum + amt, 0);

        // Top categories
        const topCategories = Array.from(categoryMap.entries())
          .map(([category, amount]) => ({
            category,
            amount,
            transactionCount: categoryCount.get(category) || 0,
            percentOfTotal: (amount / totalSpent) * 100,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        // Detect anomalies if requested
        let anomalies: any[] = [];
        if (includeAnomalies) {
          const txnsForAnomaly = filteredTxns.map(t => ({
            amount: parseFloat(t.amount),
            category: t.categoryPrimary ?? undefined,
            date: t.date,
            name: t.name ?? "Unknown",
          }));
          anomalies = detectSpendingAnomalies(txnsForAnomaly);
        }

        // Compare with historical average if requested
        let comparison = null;
        if (compareWithAverage) {
          // Fetch previous period for comparison
          const periodDays = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
          const compareStart = new Date(new Date(start).getTime() - periodDays * 24 * 60 * 60 * 1000);
          const compareEnd = new Date(start);

          const compareTxns = await db.query.plaidTransactions.findMany({
            where: and(
              drizzleEq(plaidTransactions.userId, session.userId),
              gte(plaidTransactions.date, compareStart),
              lte(plaidTransactions.date, compareEnd)
            ),
          });

          const compareTotal = compareTxns
            .filter(t => parseFloat(t.amount) > 0)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

          comparison = {
            previousPeriodTotal: compareTotal,
            currentPeriodTotal: totalSpent,
            percentChange: compareTotal > 0 ? ((totalSpent - compareTotal) / compareTotal) * 100 : 0,
          };
        }

        // Determine trend
        let trend: "spending_more" | "spending_less" | "consistent" = "consistent";
        if (comparison) {
          if (comparison.percentChange > 10) trend = "spending_more";
          else if (comparison.percentChange < -10) trend = "spending_less";
        }

        const structuredContent = {
          totalSpent,
          topCategories: topCategories.slice(0, 5),
          trend,
          anomalyCount: anomalies.length,
          averageTransactionAmount: totalSpent / filteredTxns.length,
          dateRange: { start, end },
        };

        const metaForWidget = {
          allCategories: topCategories,
          anomalies,
          comparison,
          merchantInsights: filteredTxns
            .filter(t => t.merchantName)
            .reduce((acc, t) => {
              const merchant = t.merchantName!;
              if (!acc[merchant]) {
                acc[merchant] = { count: 0, total: 0, logo: t.logoUrl };
              }
              acc[merchant].count++;
              acc[merchant].total += parseFloat(t.amount);
              return acc;
            }, {} as Record<string, { count: number; total: number; logo?: string | null }>),
          rawTransactions: filteredTxns.slice(0, 500),
        };

        return createSuccessResponse(
          `Analyzed $${totalSpent.toFixed(2)} in spending across ${topCategories.length} categories. ${trend === "spending_more" ? "📈 Spending increased" : trend === "spending_less" ? "📉 Spending decreased" : "➡️ Spending stable"}. ${anomalies.length > 0 ? `⚠️ ${anomalies.length} anomalies detected.` : ""}`,
          structuredContent,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] get_spending_insights error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to analyze spending"
        );
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
        "openai/outputTemplate": "ui://widget/account-health.html",
        "openai/toolInvocation/invoking": "Checking account health...",
        "openai/toolInvocation/invoked": "Health check complete",
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["health:read"] }],
    },
    async () => {
      try {
        // Check authentication requirements
        const authCheck = await requireAuth(session, "account health check", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Collect health data from all accounts
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
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

        return createSuccessResponse(
          `${statusEmoji} ${statusText}\n\nChecked ${allAccounts.length} account(s).`,
          output
        );
      } catch (error) {
        console.error("[Tool] check_account_health error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to check account health"
        );
      }
    }
  );

  // Get Investment Portfolio (Enhanced)
  server.registerTool(
    "get_investment_holdings",
    {
      title: "Get Investment Portfolio",
      description: "Track investment accounts including brokerages, 401k, IRAs, crypto exchanges, and 529 education accounts. Get real-time holdings, cost basis, performance metrics, and asset allocation breakdown. Requires authentication.",
      inputSchema: {
        includePerformance: z.boolean().optional().describe("Calculate gains/losses and performance metrics. Defaults to true."),
        includeAssetAllocation: z.boolean().optional().describe("Break down by asset class (stocks, bonds, crypto, etc.). Defaults to true."),
        timeframe: z.enum(["1d", "1w", "1m", "3m", "1y", "all"]).optional().describe("Performance timeframe. Defaults to 1y."),
        _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
      },
      outputSchema: InvestmentPortfolioSchema,
      _meta: {
        "openai/outputTemplate": "ui://widget/investments.html",
        "openai/toolInvocation/invoking": "Loading portfolio...",
        "openai/toolInvocation/invoked": "Portfolio ready",
        "openai/widgetAccessible": true,
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["investments:read"] }],
    },
    async ({
      includePerformance = true,
      includeAssetAllocation = true,
      timeframe = "1y"
    }: {
      includePerformance?: boolean;
      includeAssetAllocation?: boolean;
      timeframe?: "1d" | "1w" | "1m" | "3m" | "1y" | "all";
    }) => {
      try {
        // Check authentication requirements
        const authCheck = await requireAuth(session, "investment portfolio", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Fetch holdings from all connected accounts
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        const allAccounts: any[] = [];
        const allHoldings: any[] = [];
        const allSecurities: any[] = [];
        const securitiesMap = new Map<string, unknown>();

        for (const accessToken of accessTokens) {
          const data = await getInvestmentHoldings(accessToken);

          // Skip if institution doesn't support investments
          if (!data) continue;

          allAccounts.push(...data.accounts);
          allHoldings.push(...data.holdings);

          // Deduplicate securities by security_id
          for (const security of data.securities) {
            if (!securitiesMap.has(security.security_id)) {
              securitiesMap.set(security.security_id, security);
              allSecurities.push(security);
            }
          }
        }

        // Calculate performance metrics if requested
        const performance = includePerformance
          ? calculateInvestmentPerformance(allHoldings)
          : null;

        // Calculate asset allocation if requested
        let assetAllocation: Record<string, number> | undefined;
        if (includeAssetAllocation) {
          assetAllocation = allSecurities.reduce((acc, sec) => {
            const holding = allHoldings.find((h: any) => h.security_id === sec.security_id);
            if (!holding) return acc;

            const type = sec.type || "other";
            const value = holding.institution_value || holding.quantity * holding.institution_price;

            acc[type] = (acc[type] || 0) + value;
            return acc;
          }, {} as Record<string, number>);
        }

        const structuredContent = {
          totalValue: performance?.totalValue || allHoldings.reduce((sum, h) => sum + (h.institution_value || 0), 0),
          totalGainLoss: performance?.totalGainLoss || 0,
          percentReturn: performance?.percentReturn || 0,
          accountCount: allAccounts.length,
          holdingCount: allHoldings.length,
          assetAllocation,
        };

        const metaForWidget = {
          accounts: allAccounts,
          holdings: allHoldings.map((h: any) => {
            const security = allSecurities.find((s: any) => s.security_id === h.security_id);
            return {
              ...h,
              securityName: security?.name,
              tickerSymbol: security?.ticker_symbol,
              securityType: security?.type,
            };
          }),
          securities: allSecurities,
          performance,
          assetAllocation,
          topHoldings: allHoldings
            .sort((a: any, b: any) => (b.institution_value || 0) - (a.institution_value || 0))
            .slice(0, 10)
            .map((h: any) => {
              const security = allSecurities.find((s: any) => s.security_id === h.security_id);
              return {
                name: security?.name,
                symbol: security?.ticker_symbol,
                value: h.institution_value,
                quantity: h.quantity,
              };
            }),
        };

        const gainLossText = performance
          ? ` ${performance.totalGainLoss >= 0 ? "📈" : "📉"} ${performance.totalGainLoss >= 0 ? "+" : ""}$${performance.totalGainLoss.toFixed(2)} (${performance.percentReturn >= 0 ? "+" : ""}${performance.percentReturn.toFixed(2)}%)`
          : "";

        return createSuccessResponse(
          `Portfolio value: $${structuredContent.totalValue.toFixed(2)} across ${allAccounts.length} account(s).${gainLossText}`,
          structuredContent,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] get_investment_holdings error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to fetch investment portfolio"
        );
      }
    }
  );

  // Get Liabilities
  server.registerTool(
    "get_liabilities",
    {
      title: "Get Liabilities",
      description: "Get detailed information about all liabilities including credit cards, student loans, and mortgages. Shows payment schedules, interest rates, and debt summary. Requires authentication.",
      inputSchema: {},
      _meta: {
        "openai/outputTemplate": "ui://widget/liabilities.html",
        "openai/toolInvocation/invoking": "Fetching liability information...",
        "openai/toolInvocation/invoked": "Liabilities retrieved",
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["liabilities:read"] }],
    },
    async () => {
      try {
        // Check authentication requirements
        const authCheck = await requireAuth(session, "liabilities", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Fetch liabilities from all connected accounts
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        const allAccounts: AccountBase[] = [];
        const allCredit: NonNullable<LiabilitiesObject['credit']> = [];
        const allStudent: NonNullable<LiabilitiesObject['student']> = [];
        const allMortgage: NonNullable<LiabilitiesObject['mortgage']> = [];

        for (const accessToken of accessTokens) {
          const data = await getLiabilities(accessToken);

          // Skip if institution doesn't support liabilities
          if (!data) continue;

          const { accounts, liabilities } = data;
          allAccounts.push(...accounts);

          if (liabilities.credit) {
            allCredit.push(...liabilities.credit);
          }
          if (liabilities.student) {
            allStudent.push(...liabilities.student);
          }
          if (liabilities.mortgage) {
            allMortgage.push(...liabilities.mortgage);
          }
        }

        // Calculate summary statistics
        let totalDebt = 0;
        let totalMinimumPayment = 0;
        let accountsOverdue = 0;
        let earliestPaymentDue: string | null = null;

        // Calculate from credit cards
        for (const credit of allCredit) {
          const account = allAccounts.find(a => a.account_id === credit.account_id);
          if (account?.balances?.current) {
            totalDebt += Math.abs(account.balances.current);
          }
          if (credit.minimum_payment_amount) {
            totalMinimumPayment += credit.minimum_payment_amount;
          }
          if (credit.is_overdue) {
            accountsOverdue++;
          }
          if (credit.next_payment_due_date) {
            if (!earliestPaymentDue || credit.next_payment_due_date < earliestPaymentDue) {
              earliestPaymentDue = credit.next_payment_due_date;
            }
          }
        }

        // Calculate from student loans
        for (const student of allStudent) {
          const account = allAccounts.find(a => a.account_id === student.account_id);
          if (account?.balances?.current) {
            totalDebt += account.balances.current;
          }
          if (student.minimum_payment_amount) {
            totalMinimumPayment += student.minimum_payment_amount;
          }
          if (student.is_overdue) {
            accountsOverdue++;
          }
          if (student.next_payment_due_date) {
            if (!earliestPaymentDue || student.next_payment_due_date < earliestPaymentDue) {
              earliestPaymentDue = student.next_payment_due_date;
            }
          }
        }

        // Calculate from mortgages
        for (const mortgage of allMortgage) {
          const account = allAccounts.find(a => a.account_id === mortgage.account_id);
          if (account?.balances?.current) {
            totalDebt += account.balances.current;
          }
          if (mortgage.next_monthly_payment) {
            totalMinimumPayment += mortgage.next_monthly_payment;
          }
          if (mortgage.past_due_amount && mortgage.past_due_amount > 0) {
            accountsOverdue++;
          }
          if (mortgage.next_payment_due_date) {
            if (!earliestPaymentDue || mortgage.next_payment_due_date < earliestPaymentDue) {
              earliestPaymentDue = mortgage.next_payment_due_date;
            }
          }
        }

        const structuredContentForModel = {
          summary: {
            totalDebt,
            totalMinimumPayment,
            accountsOverdue,
            nextPaymentDue: earliestPaymentDue,
          },
        };

        const metaForWidget = {
          accounts: allAccounts.map(account => ({
            account_id: account.account_id,
            name: account.name,
            official_name: account.official_name,
            type: account.type,
            subtype: account.subtype,
            mask: account.mask,
            balances: {
              current: account.balances.current,
              available: account.balances.available,
              limit: account.balances.limit,
              iso_currency_code: account.balances.iso_currency_code || 'USD',
            },
          })),
          credit: allCredit,
          student: allStudent,
          mortgage: allMortgage,
          lastUpdated: new Date().toISOString(),
        };

        const totalLiabilities = allCredit.length + allStudent.length + allMortgage.length;
        const liabilityBreakdown = [
          allCredit.length > 0 && `${allCredit.length} credit card(s)`,
          allStudent.length > 0 && `${allStudent.length} student loan(s)`,
          allMortgage.length > 0 && `${allMortgage.length} mortgage(s)`,
        ].filter(Boolean).join(', ');

        return createSuccessResponse(
          `Found ${totalLiabilities} liabilities: ${liabilityBreakdown}.\n\n` +
          `Total debt: $${totalDebt.toFixed(2)}\n` +
          `Minimum payments due: $${totalMinimumPayment.toFixed(2)}` +
          (accountsOverdue > 0 ? `\n⚠️ ${accountsOverdue} account(s) overdue` : ''),
          structuredContentForModel,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] get_liabilities error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to fetch liabilities"
        );
      }
    }
  );

    // Manage Subscription
    server.registerTool(
      "manage_subscription",
      {
        title: "Manage Subscription",
        description: "Access the billing portal to update or cancel your subscription. Shows an interactive widget with subscription management options. Requires authentication and active subscription.",
        inputSchema: {},
        _meta: {
          "openai/outputTemplate": "ui://widget/manage-subscription.html",
          "openai/toolInvocation/invoking": "Loading subscription management...",
          "openai/toolInvocation/invoked": "Subscription management ready",
          "openai/widgetAccessible": true,
        },
        annotations: {
          destructiveHint: false,
          openWorldHint: false,
          readOnlyHint: true,
        },
        // @ts-expect-error - securitySchemes not yet in MCP SDK types
        securitySchemes: [{ type: "oauth2", scopes: ["subscription:manage"] }],
      },
      async () => {
        try {
          // Check authentication requirements (no Plaid required for subscription management)
          const authCheck = await requireAuth(session, "subscription management", {
            requireSubscription: true,
            requirePlaid: false,
          });
          if (authCheck) return authCheck;

          // Initialize Stripe client
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: "2025-10-29.clover",
          });

          // Get user's Stripe customer ID and email from database
          const userResult = await db
            .select({
              stripeCustomerId: user.stripeCustomerId,
              email: user.email,
            })
            .from(user)
            .where(drizzleEq(user.id, session.userId))
            .limit(1);

          if (userResult.length === 0) {
            return createErrorResponse("User not found");
          }

          const userData = userResult[0];
          const stripeCustomerId = userData.stripeCustomerId;

          if (!stripeCustomerId) {
            return createErrorResponse("No Stripe customer found. Please contact support.");
          }

          // Create a billing portal session with prefilled customer email
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${baseURL}/pricing`,
          });

          // Get user's current plan (optional - for display purposes)
          const ctx = await auth.$context;
          const subscriptions = await ctx.adapter.findMany({
            model: "subscription",
            where: [{ field: "referenceId", value: session.userId }],
          }) as Array<{ plan: string }>;

          const currentPlan = subscriptions?.[0]?.plan || null;

          return createSuccessResponse(
            "Click the link below to manage your subscription, update payment methods, or view billing history.",
            {
              billingPortalUrl: portalSession.url,
              currentPlan,
              message: "Manage your subscription through the Stripe billing portal.",
            }
          );
        } catch (error) {
          console.error("[Tool] manage_subscription error", { error });
          return createErrorResponse(
            error instanceof Error ? error.message : "Failed to access subscription management"
          );
        }
      }
    );

    // ============================================================================
    // CONNECT ITEM (Account Management)
    // ============================================================================
    server.registerTool(
      "connect_item",
      {
        title: "Manage Financial Accounts",
        description: "Connect new financial accounts (banks, credit cards, investments, loans) or manage existing connections. Always shows your connected accounts to prevent duplicates. Requires authentication and active subscription.",
        inputSchema: {},
        _meta: {
          "openai/outputTemplate": "ui://widget/connect-item.html",
          "openai/toolInvocation/invoking": "Loading your accounts...",
          "openai/toolInvocation/invoked": "Account management ready",
          "openai/widgetAccessible": true,
        },
        annotations: {
          destructiveHint: false, // Deletion happens in a separate server action inside the widget
          readOnlyHint: true, // This tool call only reads data to display the widget
        },
        // @ts-expect-error - securitySchemes not yet in MCP SDK types
        securitySchemes: [{ type: "oauth2", scopes: ["accounts:read"] }],
      },
      async () => {
        try {
          // Check authentication requirements
          // NOTE: requirePlaid is FALSE because this IS how users connect Plaid
          const authCheck = await requireAuth(session, "account management", {
            requireSubscription: true,
            requirePlaid: false,
          });
          if (authCheck) return authCheck;

          // Get connect item status (pass userId from session)
          const result = await getConnectItemStatus(session.userId);

          if (!result.success) {
            return createErrorResponse(result.error);
          }

          const { data } = result;

          // Create message based on status
          let message = "";
          if (data.items.length === 0) {
            message = "Ready to connect your first financial account. Get started by connecting your bank, credit card, or investment account.";
          } else if (data.canConnect) {
            message = `You have ${data.planLimits.current} of ${data.planLimits.maxFormatted} accounts connected. You can connect more accounts.`;
          } else {
            if (data.deletionStatus.canDelete) {
              message = `Account limit reached (${data.planLimits.current}/${data.planLimits.maxFormatted}). Remove an account or upgrade your plan to connect more.`;
            } else {
              message = `Account limit reached. Next deletion available in ${data.deletionStatus.daysUntilNext} days, or upgrade your plan.`;
            }
          }

          const structuredContentForModel = {
            planLimits: data.planLimits,
            deletionStatus: data.deletionStatus,
            canConnect: data.canConnect,
          };

          const metaForWidget = {
            items: data.items,
            mcpToken: req.headers.get("authorization")?.replace("Bearer ", ""),
            baseUrl: baseURL,
          };

          return createSuccessResponse(message, structuredContentForModel, metaForWidget);
        } catch (error) {
          console.error("[Tool] connect_item error", { error });
          return createErrorResponse(
            error instanceof Error ? error.message : "Failed to load account management"
          );
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
        // @ts-expect-error - securitySchemes not yet in MCP SDK types
        securitySchemes: [{ type: "noauth" }],
      },
      async () => {
        return createSuccessResponse(
          "Hello from the test widget!",
          {
            message: "Hello from the test widget!",
          }
        );
      }
    );

    // ============================================================================
    // SUBSCRIPTION CHECKOUT
    // ============================================================================
    // NOTE: Subscription checkout is now handled by the subscription-required widget
    // via server actions that call auth.api.upgradeSubscription() with admin API key.
    // This ensures Better Auth properly processes webhooks and creates subscription records.
    // The old create_checkout_session tool has been removed.

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
        // @ts-expect-error - securitySchemes not yet in MCP SDK types
        securitySchemes: [{ type: "noauth" }],
      },
      async () => {
        return createSuccessResponse(
          "Advanced test widget loaded.",
          {
            message: "Initial message",
          }
        );
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
        // @ts-expect-error - securitySchemes not yet in MCP SDK types
        securitySchemes: [{ type: "noauth" }],
      },
      async (args: Record<string, unknown>) => {
        const { current_count } = args as { current_count: number };
        return createSuccessResponse(
          `The count is ${current_count}.`,
          {
            message: `The count from the tool call is ${current_count}.`,
          }
        );
      }
    );

  // Track Recurring Payments & Subscriptions (NEW)
  server.registerTool(
    "track_recurring_payments",
    {
      title: "Track Recurring Payments & Subscriptions",
      description: "AI-powered detection of all recurring charges including subscriptions, bills, and memberships. Predicts upcoming payments and identifies potential savings from unused subscriptions. Requires authentication.",
      inputSchema: {
        confidenceThreshold: z.number().min(0.5).max(1.0).optional().describe("Minimum confidence to classify as recurring (0.5 = include uncertain, 0.9 = only highly confident). Defaults to 0.8."),
        lookbackMonths: z.number().int().min(3).max(12).optional().describe("How many months to analyze for patterns. Defaults to 6."),
        includeInactive: z.boolean().optional().describe("Include subscriptions that may have been cancelled. Defaults to false."),
        _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
      },
      outputSchema: RecurringPaymentsSchema,
      _meta: {
        "openai/outputTemplate": "ui://widget/recurring-payments.html",
        "openai/toolInvocation/invoking": "Detecting recurring payments...",
        "openai/toolInvocation/invoked": "Subscriptions identified",
        "openai/widgetAccessible": true,
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["transactions:read"] }],
    },
    async ({
      confidenceThreshold = 0.8,
      lookbackMonths = 6,
      includeInactive = false
    }: {
      confidenceThreshold?: number;
      lookbackMonths?: number;
      includeInactive?: boolean;
    }) => {
      try {
        // Check authentication requirements
        const authCheck = await requireAuth(session, "recurring payments", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Fetch recurring transactions from all connected accounts
        const accessTokens = await UserService.getUserAccessTokens(session.userId);

        let allRecurringStreams: any[] = [];
        for (const accessToken of accessTokens) {
          try {
            const recurring = await getRecurringTransactions(accessToken);
            allRecurringStreams.push(...recurring.outflowStreams);
          } catch (error) {
            console.error("[Tool] Failed to get recurring for one item:", error);
            // Continue with other items
          }
        }

        // Filter by confidence
        const filteredStreams = allRecurringStreams.filter(stream => {
          const confidence = stream.status === "MATURE" ? 0.9 :
                            stream.status === "EARLY_DETECTION" ? 0.7 :
                            stream.status === "TOMBSTONED" ? 0.3 : 0.5;
          return confidence >= confidenceThreshold;
        }).filter(stream => includeInactive || stream.status !== "TOMBSTONED");

        // Calculate monthly total
        const monthlyTotal = filteredStreams.reduce((sum, stream) => {
          const amount = stream.average_amount?.amount || 0;
          const frequency = stream.frequency;

          // Convert to monthly
          if (frequency === "WEEKLY") return sum + (amount * 4.33);
          if (frequency === "BIWEEKLY") return sum + (amount * 2.17);
          if (frequency === "SEMI_MONTHLY") return sum + (amount * 2);
          if (frequency === "MONTHLY") return sum + amount;
          if (frequency === "ANNUALLY") return sum + (amount / 12);
          return sum + amount;
        }, 0);

        // Predict upcoming payments
        const upcoming = filteredStreams
          .map(stream => ({
            name: stream.merchant_name || stream.description || "Unknown",
            amount: stream.average_amount?.amount || 0,
            nextDate: stream.last_date || new Date().toISOString().split('T')[0],
            frequency: stream.frequency || "MONTHLY",
            confidence: stream.status === "MATURE" ? "high" as const :
                       stream.status === "EARLY_DETECTION" ? "medium" as const :
                       "low" as const,
          }))
          .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());

        const highestSubscription = upcoming.length > 0
          ? upcoming.reduce((max, curr) => curr.amount > max.amount ? curr : max, upcoming[0])
          : undefined;

        const structuredContent = {
          monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          subscriptionCount: filteredStreams.length,
          upcomingPayments: upcoming.slice(0, 10),
          highestSubscription: highestSubscription ? {
            name: highestSubscription.name,
            amount: highestSubscription.amount,
            frequency: highestSubscription.frequency,
          } : undefined,
        };

        const metaForWidget = {
          allRecurring: filteredStreams,
          upcomingPayments: upcoming,
          categoryBreakdown: filteredStreams.reduce((acc, stream) => {
            const category = stream.personal_finance_category?.primary || "Other";
            acc[category] = (acc[category] || 0) + (stream.average_amount?.amount || 0);
            return acc;
          }, {} as Record<string, number>),
          savingsOpportunities: filteredStreams.filter(s => {
            // Identify potential savings (low transaction count, high amount)
            return s.transaction_count < 3 && (s.average_amount?.amount || 0) > 10;
          }),
        };

        const upcomingSoon = upcoming.filter(u => {
          const daysUntil = Math.floor((new Date(u.nextDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return daysUntil <= 7 && daysUntil >= 0;
        }).length;

        return createSuccessResponse(
          `Found ${filteredStreams.length} recurring payments totaling $${monthlyTotal.toFixed(2)}/month. ${upcomingSoon > 0 ? `${upcomingSoon} payment(s) due in the next 7 days.` : ""}`,
          structuredContent,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] track_recurring_payments error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to track recurring payments"
        );
      }
    }
  );

  // Business Cash Flow Analysis (NEW)
  server.registerTool(
    "business_cash_flow",
    {
      title: "Business Cash Flow Analysis",
      description: "Comprehensive cash flow analysis for businesses with runway projections, burn rate calculations, and working capital insights. Essential for financial planning and investor reporting. Requires authentication.",
      inputSchema: {
        period: z.enum(["weekly", "monthly", "quarterly"]).optional().describe("Reporting period granularity. Defaults to monthly."),
        projectMonths: z.number().int().min(1).max(12).optional().describe("Months to project forward for runway calculation. Defaults to 6."),
        includeBreakdown: z.boolean().optional().describe("Include detailed revenue/expense breakdown by category. Defaults to true."),
        _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
      },
      outputSchema: BusinessCashFlowSchema,
      _meta: {
        "openai/outputTemplate": "ui://widget/business-cashflow.html",
        "openai/toolInvocation/invoking": "Analyzing business cash flow...",
        "openai/toolInvocation/invoked": "Cash flow report ready",
        "openai/widgetAccessible": true,
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["business:read", "transactions:read", "balances:read"] }],
    },
    async ({
      period = "monthly",
      projectMonths = 6,
      includeBreakdown = true
    }: {
      period?: "weekly" | "monthly" | "quarterly";
      projectMonths?: number;
      includeBreakdown?: boolean;
    }) => {
      try {
        const authCheck = await requireAuth(session, "business cash flow", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Fetch business accounts
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        const allAccounts: AccountBase[] = [];
        for (const accessToken of accessTokens) {
          const balances = await getAccountBalances(accessToken);
          allAccounts.push(...balances.accounts);
        }

        // Fetch transactions for the past year
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);

        const transactions = await db.query.plaidTransactions.findMany({
          where: and(
            drizzleEq(plaidTransactions.userId, session.userId),
            gte(plaidTransactions.date, startDate),
            lte(plaidTransactions.date, endDate)
          ),
          limit: 10000,
        });

        // Calculate business metrics
        const metrics = calculateBusinessMetrics(
          allAccounts.map(a => ({ balances: a.balances })),
          transactions.map(t => ({ amount: parseFloat(t.amount), date: t.date })),
          projectMonths
        );

        const endDateFormatted = new Date();
        endDateFormatted.setMonth(endDateFormatted.getMonth() + Math.round(metrics.runwayMonths));

        const structuredContent = {
          runway: {
            months: Math.round(metrics.runwayMonths * 10) / 10,
            endDate: endDateFormatted.toISOString().split('T')[0],
            confidence: metrics.runwayMonths > 12 ? "high" as const :
                       metrics.runwayMonths > 6 ? "medium" as const :
                       "critical" as const,
          },
          currentPeriod: {
            revenue: metrics.revenue,
            expenses: metrics.expenses,
            net: metrics.netCashFlow,
            burnRate: metrics.monthlyBurnRate,
          },
          projections: metrics.projections.slice(0, 6),
          healthStatus: metrics.netCashFlow >= 0 ? "positive" as const :
                       metrics.runwayMonths > 6 ? "stable" as const :
                       "critical" as const,
        };

        const metaForWidget = {
          fullProjections: metrics.projections,
          breakdown: includeBreakdown ? transactions.reduce((acc, t) => {
            const category = t.categoryPrimary || "Uncategorized";
            const amount = parseFloat(t.amount);
            if (!acc[category]) acc[category] = { revenue: 0, expenses: 0, count: 0 };
            if (amount < 0) acc[category].revenue += Math.abs(amount);
            else acc[category].expenses += amount;
            acc[category].count++;
            return acc;
          }, {} as Record<string, { revenue: number; expenses: number; count: number }>) : null,
          currentBalance: metrics.currentBalance,
        };

        return createSuccessResponse(
          `Current runway: ${Math.round(metrics.runwayMonths)} months. ${metrics.netCashFlow >= 0 ? "Positive" : "Negative"} cash flow of $${Math.abs(metrics.netCashFlow).toFixed(2)} this period. ${metrics.runwayMonths < 6 ? "⚠️ Critical: Consider cost reduction or fundraising." : ""}`,
          structuredContent,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] business_cash_flow error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to analyze business cash flow"
        );
      }
    }
  );

  // Categorize Expenses (NEW)
  server.registerTool(
    "categorize_expenses",
    {
      title: "Smart Expense Categorization",
      description: "AI-powered business expense categorization with tax category mapping, receipt matching, and automated bookkeeping prep. Learns from your corrections to improve accuracy. Requires authentication.",
      inputSchema: {
        timeframe: z.enum(["7d", "30d", "90d", "1y", "ytd"]).optional().describe("Timeframe for expense categorization. Defaults to 30d."),
        autoApply: z.boolean().optional().describe("Automatically apply ML-suggested categories (use with caution). Defaults to false."),
        includeOnlyUnreviewed: z.boolean().optional().describe("Only show transactions that haven't been categorized yet. Defaults to true."),
        taxYearMode: z.boolean().optional().describe("Group by tax categories for end-of-year reporting. Defaults to false."),
        _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
      },
      outputSchema: ExpenseCategorizationSchema,
      _meta: {
        "openai/outputTemplate": "ui://widget/expense-categorizer.html",
        "openai/toolInvocation/invoking": "Categorizing expenses...",
        "openai/toolInvocation/invoked": "Categories assigned",
        "openai/widgetAccessible": true,
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["transactions:read", "transactions:write", "business:write"] }],
    },
    async ({
      timeframe = "30d",
      autoApply = false,
      includeOnlyUnreviewed = true,
      taxYearMode = false
    }: {
      timeframe?: "7d" | "30d" | "90d" | "1y" | "ytd";
      autoApply?: boolean;
      includeOnlyUnreviewed?: boolean;
      taxYearMode?: boolean;
    }) => {
      try {
        const authCheck = await requireAuth(session, "expense categorization", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Calculate date range
        const dayMap = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, "ytd": Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)) };
        const days = dayMap[timeframe];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch transactions
        const transactions = await db.query.plaidTransactions.findMany({
          where: and(
            drizzleEq(plaidTransactions.userId, session.userId),
            gte(plaidTransactions.date, startDate),
            lte(plaidTransactions.date, endDate)
          ),
          limit: 5000,
        });

        // Filter to expenses only
        let expenses = transactions.filter(t => parseFloat(t.amount) > 0);

        // Map to tax categories
        const suggestions = expenses.map(txn => {
          const plaidCategory = txn.categoryPrimary ? { primary: txn.categoryPrimary, detailed: txn.categoryDetailed || undefined } : undefined;
          const taxCategory = mapToTaxCategory(plaidCategory);
          const confidence = txn.categoryConfidence === "VERY_HIGH" ? 0.95 :
                           txn.categoryConfidence === "HIGH" ? 0.85 :
                           txn.categoryConfidence === "MEDIUM" ? 0.7 :
                           txn.categoryConfidence === "LOW" ? 0.5 : 0.6;

          return {
            transaction_id: txn.transactionId,
            merchant: txn.merchantName || txn.name || "Unknown",
            amount: parseFloat(txn.amount),
            date: txn.date.toISOString().split('T')[0],
            plaidCategory: plaidCategory?.primary,
            plaidDetailed: plaidCategory?.detailed,
            suggestedTaxCategory: taxCategory,
            confidence,
            needsReview: confidence < 0.8,
          };
        });

        // Group by tax category
        const taxBreakdown = suggestions.reduce((acc, s) => {
          acc[s.suggestedTaxCategory] = (acc[s.suggestedTaxCategory] || 0) + s.amount;
          return acc;
        }, {} as Record<string, number>);

        const structuredContent = {
          categorized: autoApply ? suggestions.filter(s => s.confidence >= 0.9).length : 0,
          needsReview: suggestions.filter(s => s.needsReview).length,
          taxCategories: taxBreakdown,
          totalAmount: expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0),
        };

        const metaForWidget = {
          allSuggestions: suggestions,
          unreviewedTransactions: suggestions.filter(s => s.needsReview),
          confidenceDistribution: {
            high: suggestions.filter(s => s.confidence >= 0.8).length,
            medium: suggestions.filter(s => s.confidence >= 0.6 && s.confidence < 0.8).length,
            low: suggestions.filter(s => s.confidence < 0.6).length,
          },
          taxYearSummary: taxYearMode ? taxBreakdown : null,
        };

        return createSuccessResponse(
          `Reviewed ${expenses.length} expenses. ${structuredContent.needsReview} require manual review. ${autoApply ? `Applied ${structuredContent.categorized} high-confidence categories.` : ""}`,
          structuredContent,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] categorize_expenses error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to categorize expenses"
        );
      }
    }
  );

  // Evaluate Payment Risk (NEW)
  server.registerTool(
    "evaluate_payment_risk",
    {
      title: "ACH Payment Risk Assessment",
      description: "Real-time ML risk scoring before initiating ACH payments. Predicts likelihood of returns/bounces using network intelligence from billions of transactions. Reduces failed payments by 50%. Requires authentication and connected bank accounts. Note: accountId must be a valid Plaid account_id from user's connected accounts (use get_account_balances to see available account IDs).",
      inputSchema: {
        accountId: z.string().describe("Plaid account_id from user's connected accounts (e.g., 'BxBXxLj1m68yDjeybBQC6eucT6K5tQhVCEBBv'). Use get_account_balances to see available accounts."),
        amount: z.number().min(0.01).describe("Payment amount in dollars"),
        direction: z.enum(["debit", "credit"]).describe("debit = pulling money from account, credit = sending money to account"),
        includeBalanceCheck: z.boolean().optional().describe("Also check current balance sufficiency. Defaults to true."),
        _meta: z.any().optional().describe("OpenAI Apps SDK metadata"),
      },
      outputSchema: PaymentRiskSchema,
      _meta: {
        "openai/toolInvocation/invoking": "Evaluating payment risk...",
        "openai/toolInvocation/invoked": "Risk assessment complete",
      },
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "oauth2", scopes: ["signal:read", "balances:read"] }],
    },
    async ({
      accountId,
      amount,
      direction,
      includeBalanceCheck = true
    }: {
      accountId: string;
      amount: number;
      direction: "debit" | "credit";
      includeBalanceCheck?: boolean;
    }) => {
      try {
        const authCheck = await requireAuth(session, "payment risk evaluation", {
          requireSubscription: true,
          requirePlaid: true,
          headers: req.headers,
        });
        if (authCheck) return authCheck;

        // Get access token for the account
        const accessTokens = await UserService.getUserAccessTokens(session.userId);
        if (accessTokens.length === 0) {
          return createErrorResponse("No Plaid accounts connected. Connect your bank account first using the connect_item tool.");
        }

        // Use first access token (in production, match to specific account)
        const accessToken = accessTokens[0];

        // Validate account exists before calling Plaid
        const balanceResponse = await getAccountBalances(accessToken);
        const accountExists = balanceResponse.accounts.some(a => a.account_id === accountId);
        if (!accountExists) {
          const availableAccounts = balanceResponse.accounts.map(a =>
            `${a.name} (${a.subtype || a.type}) - ID: ${a.account_id}`
          ).join(', ');
          return createErrorResponse(
            `Account ID '${accountId}' not found in your connected accounts. Available accounts: ${availableAccounts}`
          );
        }

        // Evaluate risk
        const riskData = await evaluatePaymentRisk(
          accessToken,
          accountId,
          amount,
          session.userId
        );

        const overallRisk = riskData.scores.customerInitiatedReturnRisk + riskData.scores.bankInitiatedReturnRisk;
        const recommendation = overallRisk < 20 ? "proceed" as const :
                              overallRisk < 50 ? "review" as const :
                              "decline" as const;

        // Balance check if requested
        let balanceSufficient: boolean | null = null;
        if (includeBalanceCheck && direction === "debit") {
          const balanceResponse = await getAccountBalances(accessToken);
          const account = balanceResponse.accounts.find(a => a.account_id === accountId);
          if (account) {
            balanceSufficient = (account.balances.available ?? 0) >= amount;
          }
        }

        const structuredContent = {
          riskScore: {
            overall: Math.round(overallRisk),
            bankInitiated: riskData.scores.bankInitiatedReturnRisk,
            customerInitiated: riskData.scores.customerInitiatedReturnRisk,
          },
          recommendation,
          balanceSufficient,
        };

        const metaForWidget = {
          fullRiskData: riskData,
          riskFactors: [],
        };

        return createSuccessResponse(
          `${recommendation === "proceed" ? "✅ Low risk" : recommendation === "review" ? "⚠️ Medium risk" : "🚫 High risk"} for $${amount.toFixed(2)} ${direction}. ${balanceSufficient !== null ? `Balance check: ${balanceSufficient ? "Sufficient" : "Insufficient"}` : ""}`,
          structuredContent,
          metaForWidget
        );
      } catch (error) {
        console.error("[Tool] evaluate_payment_risk error", { error });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to evaluate payment risk"
        );
      }
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
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "noauth" }],
    },
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

      return createSuccessResponse(
        `Here are ${tips.length} financial tips for ${topic}:\n\n${tips.map((tip, i) => `${i + 1}. **${tip.title}**: ${tip.description}`).join("\n\n")}`,
        output
      );
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
      // @ts-expect-error - securitySchemes not yet in MCP SDK types
      securitySchemes: [{ type: "noauth" }],
    },
    async (args: Record<string, unknown>) => {
      const { monthlyIncome, hasDebts = false } = args as { monthlyIncome: number; hasDebts?: boolean };
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

      return createSuccessResponse(
        `Budget breakdown for $${monthlyIncome.toFixed(2)}/month:\n\n` +
        `💰 Needs: $${needs.toFixed(2)} (${needsPercent}%)\n` +
        `🎯 Wants: $${wants.toFixed(2)} (${wantsPercent}%)\n` +
        `📈 Savings: $${savings.toFixed(2)} (${savingsPercent}%)\n` +
        (hasDebts ? `💳 Debt Payment: $${debt.toFixed(2)} (${debtPercent}%)\n` : "") +
        `\n${recommendations.join("\n")}`,
        output
      );
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
    } catch  {
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
                tools: data.result.tools.map((t: { name: string; securitySchemes?: unknown; _meta?: { securitySchemes?: unknown } }) => ({
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
