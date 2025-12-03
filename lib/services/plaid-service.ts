import { db } from '@/lib/db';
import { plaidItems, plaidAccounts, plaidTransactions, plaidLinkSessions } from '@/lib/db/schema';
import { eq, sql, inArray, and, gte, lte, desc } from 'drizzle-orm';
import { getPlaidClient } from '../config/plaid';
import { EncryptionService } from './encryption-service';
import { logger } from './logger-service';

// Export Plaid client for use in other services
export const plaidClient = getPlaidClient();
import {
  CountryCode,
  Products,
  AccountsGetRequest,
  TransactionsSyncRequest,
  RemovedTransaction,
  Transaction,
  TransactionsRecurringGetRequest,
  AuthGetRequest,
  InvestmentsHoldingsGetRequest,
  InvestmentsTransactionsGetRequest,
  LiabilitiesGetRequest,
  LinkTokenCreateRequest,
  ItemPublicTokenExchangeRequest,
  ItemGetRequest,
  UserCreateRequest,
} from 'plaid';

/**
 * Helper to log detailed Plaid API errors
 */
function logPlaidError(functionName: string, error: any): void {
  if (error.response?.data) {
    console.error(`[Plaid] ${functionName} API error:`, JSON.stringify(error.response.data, null, 2));
  } else {
    console.error(`[Plaid] ${functionName} error:`, error);
  }
}

/**
 * Helper to get error message from Plaid API error
 */
function getPlaidErrorMessage(error: any): string {
  return error.response?.data?.error_message || error.message || 'Unknown error';
}

/**
 * Helper to check if error is PRODUCTS_NOT_SUPPORTED
 * Returns true if the institution doesn't support the product
 */
function isProductNotSupported(error: any): boolean {
  return error.response?.data?.error_code === 'PRODUCTS_NOT_SUPPORTED';
}

/**
 * Get or create a Plaid user token for Multi-Item Link
 * Checks database for existing token, creates new one if not found
 * @param userId Unique user identifier
 * @returns Plaid user token for reuse across Link sessions
 */
export const getOrCreatePlaidUserToken = async (userId: string): Promise<string> => {
  try {
    // Check if user already has a user token from a previous session
    const [existingSession] = await db
      .select({ plaidUserToken: plaidLinkSessions.plaidUserToken })
      .from(plaidLinkSessions)
      .where(eq(plaidLinkSessions.userId, userId))
      .orderBy(desc(plaidLinkSessions.createdAt))
      .limit(1);

    if (existingSession?.plaidUserToken) {
      console.log('[Plaid] Reusing existing user token for userId:', userId);
      return existingSession.plaidUserToken;
    }

    // No existing token, create a new one
    console.log('[Plaid] Creating new user token for userId:', userId);
    const request: UserCreateRequest = {
      client_user_id: userId,
    };

    const response = await getPlaidClient().userCreate(request);
    console.log('[Plaid] Created user token for userId:', userId);

    if (!response.data.user_token) {
      throw new Error('Plaid API did not return a user token');
    }

    return response.data.user_token;
  } catch (error: any) {
    logPlaidError('userCreate', error);
    throw new Error(`Failed to create Plaid user token: ${getPlaidErrorMessage(error)}`);
  }
};

/**
 * Create a Link token for initializing Plaid Link with Multi-Item support
 * Always uses user tokens for Multi-Item Link functionality
 * @param userId Unique user identifier
 * @param options Optional configuration
 * @param options.redirectUri Optional redirect URI for OAuth flows
 * @param options.accessToken Optional access token for update mode (re-authentication)
 * @returns Link token for client-side Plaid Link initialization
 */
export const createLinkToken = async (
  userId: string,
  options?: {
    redirectUri?: string;
    accessToken?: string;
  }
) => {
  try {
    const { redirectUri, accessToken } = options || {};

    // For update mode, we don't need a user token
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: 'AskMyMoney',
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: process.env.BETTER_AUTH_URL ? `${process.env.BETTER_AUTH_URL}/api/plaid/webhook` : undefined,
      ...(redirectUri && { redirect_uri: redirectUri }),
    };

    // Update mode: re-authenticate existing item
    if (accessToken) {
      console.log('[Plaid] Creating link token for update mode (re-authentication)');
      request.access_token = accessToken;
      // Do NOT include products array for update mode
    } else {
      // Regular mode: connect new items
      console.log('[Plaid] Creating link token with Multi-Item Link enabled');

      // Get or create a user token for Multi-Item Link
      const userToken = await getOrCreatePlaidUserToken(userId);
      request.user_token = userToken;
      request.products = [Products.Transactions];
      request.optional_products = [Products.Auth, Products.Investments, Products.Liabilities];
      request.enable_multi_item_link = true;
      request.investments = {
        allow_unverified_crypto_wallets: true,
        allow_manual_entry: true,
      };
      request.cra_enabled = true;

      // Store Link session in database for webhook processing (only for new connections)
      await db.insert(plaidLinkSessions).values({
        userId,
        linkToken: '',
        plaidUserToken: userToken,
        status: 'pending',
      });
    }

    const response = await getPlaidClient().linkTokenCreate(request);

    // Update the link token in the session if we created one
    if (!accessToken) {
      await db
        .update(plaidLinkSessions)
        .set({ linkToken: response.data.link_token })
        .where(eq(plaidLinkSessions.userId, userId));
    }

    console.log('[Plaid] Created link token successfully');

    return response.data;
  } catch (error: any) {
    logPlaidError('linkTokenCreate', error);
    throw new Error(`Failed to create link token: ${getPlaidErrorMessage(error)}`);
  }
};

/**
 * Exchange a public token for an access token
 * @param publicToken Public token from Plaid Link
 * @returns Access token and item ID
 */
export const exchangePublicToken = async (publicToken: string) => {
  try {
    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    const response = await getPlaidClient().itemPublicTokenExchange(request);
    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    };
  } catch (error: any) {
    logPlaidError('itemPublicTokenExchange', error);
    throw new Error(`Failed to exchange public token: ${getPlaidErrorMessage(error)}`);
  }
};

/**
 * Get account balances for a given access token
 * @param accessToken Plaid access token
 * @returns Account balances and details
 */
export async function getAccountBalances(accessToken: string) {
  const request: AccountsGetRequest = {
    access_token: accessToken,
  };
  try {
    const response = await getPlaidClient().accountsGet(request);
    return response.data;
  } catch (error: any) {
    logPlaidError('accountsGet', error);
    throw new Error(`Failed to get account balances: ${getPlaidErrorMessage(error)}`);
  }
}

/**
 * Get transactions for a given access token
 * @param accessToken Plaid access token
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Transactions and accounts
 */
/**
 * Fetches transaction updates from Plaid for a given item.
 * @param accessToken The access token for the item.
 * @param initialCursor The last stored cursor for the item.
 * @returns An object containing added, modified, and removed transactions, plus the next cursor.
 */
async function fetchTransactionUpdates(accessToken: string, initialCursor: string | null) {
  let cursor = initialCursor;
  const added: Transaction[] = [];
  const modified: Transaction[] = [];
  const removed: RemovedTransaction[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await getPlaidClient().transactionsSync({
        access_token: accessToken,
        cursor: cursor ?? undefined,
        count: 500, // Max count
      });

      const { data } = response;
      added.push(...data.added);
      modified.push(...data.modified);
      removed.push(...data.removed);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }
    return { added, modified, removed, nextCursor: cursor };
  } catch (error) {
    console.error(`Error fetching transactions for access token ${accessToken}:`, error);
    // Return what we have so far, but don't update the cursor
    return { added, modified, removed, nextCursor: initialCursor };
  }
}

/**
 * Get spending insights from transactions
 * @param accessToken Plaid access token
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Spending analysis by category
 */
export async function syncTransactionsForItem(itemId: string, dbInstance: typeof db = db) {
  try {
    // 1. Get the item from the database
    const item = await dbInstance.query.plaidItems.findFirst({
      where: eq(plaidItems.itemId, itemId),
    });

    if (!item) {
      throw new Error(`Item with ID ${itemId} not found.`);
    }

    // Decrypt access token
    const accessToken = EncryptionService.decrypt(item.accessToken);

    // 2. Fetch all available accounts for the item
    const accountsResponse = await getPlaidClient().accountsGet({ access_token: accessToken });
    const accounts = accountsResponse.data.accounts;

    // 3. Upsert accounts into the database
    await dbInstance.insert(plaidAccounts)
      .values(accounts.map(acc => ({
        accountId: acc.account_id,
        itemId: item.itemId,
        userId: item.userId,
        name: acc.name,
        mask: acc.mask,
        officialName: acc.official_name,
        currentBalance: acc.balances.current?.toString(),
        availableBalance: acc.balances.available?.toString(),
        isoCurrencyCode: acc.balances.iso_currency_code,
        type: acc.type,
        subtype: acc.subtype,
        persistentAccountId: acc.persistent_account_id,
      })))
      .onConflictDoUpdate({
        target: plaidAccounts.accountId,
        set: {
          currentBalance: sql`excluded.current_balance`,
          availableBalance: sql`excluded.available_balance`,
          updatedAt: new Date(),
        }
      });

    // 4. Fetch transaction updates
    const { added, modified, removed, nextCursor } = await fetchTransactionUpdates(accessToken, item.transactionsCursor);

    // 5. Process updates
    if (removed.length > 0) {
      await dbInstance.delete(plaidTransactions).where(inArray(plaidTransactions.transactionId, removed.map(t => t.transaction_id)));
    }

    const transactionsToUpsert = [...added, ...modified];
    if (transactionsToUpsert.length > 0) {
      await dbInstance.insert(plaidTransactions)
        .values(transactionsToUpsert.map(t => ({
          transactionId: t.transaction_id,
          accountId: t.account_id,
          userId: item.userId,
          amount: t.amount.toString(),
          isoCurrencyCode: t.iso_currency_code,
          unofficialCurrencyCode: t.unofficial_currency_code,
          categoryPrimary: t.personal_finance_category?.primary,
          categoryDetailed: t.personal_finance_category?.detailed,
          categoryConfidence: t.personal_finance_category?.confidence_level,
          checkNumber: t.check_number,
          date: new Date(t.date),
          datetime: t.datetime ? new Date(t.datetime) : null,
          authorizedDate: t.authorized_date ? new Date(t.authorized_date) : null,
          authorizedDatetime: t.authorized_datetime ? new Date(t.authorized_datetime) : null,
          location: t.location,
          merchantName: t.merchant_name,
          paymentChannel: t.payment_channel,
          pending: t.pending,
          pendingTransactionId: t.pending_transaction_id,
          transactionCode: t.transaction_code,
          name: t.name,
          originalDescription: t.original_description,
          logoUrl: t.logo_url,
          website: t.website,
          counterparties: t.counterparties,
          paymentMeta: t.payment_meta,
          rawData: t,
        })))
        .onConflictDoUpdate({
          target: plaidTransactions.transactionId,
          set: {
            amount: sql`excluded.amount`,
            categoryPrimary: sql`excluded.category_primary`,
            categoryDetailed: sql`excluded.category_detailed`,
            pending: sql`excluded.pending`,
            merchantName: sql`excluded.merchant_name`,
            paymentChannel: sql`excluded.payment_channel`,
            updatedAt: new Date(),
            rawData: sql`excluded.raw_data`,
          }
        });
    }

    // 6. Update the cursor in the database
    await dbInstance.update(plaidItems)
      .set({ transactionsCursor: nextCursor, updatedAt: new Date() })
      .where(eq(plaidItems.itemId, itemId));

    return {
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    };

  } catch (error) {
    console.error(`Failed to sync transactions for item ${itemId}:`, error);
    throw new Error(`Failed to sync transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSpendingInsights(userId: string, startDate: string, endDate: string) {
  try {
    const userAccountIds = (await db.query.plaidAccounts.findMany({
      where: eq(plaidAccounts.userId, userId)
    })).map(acc => acc.accountId);

    if (userAccountIds.length === 0) {
      return {
        totalSpending: 0,
        categoryBreakdown: [],
        transactionCount: 0,
        dateRange: { startDate, endDate },
      };
    }

    const transactions = await db.query.plaidTransactions.findMany({
      where: and(
        inArray(plaidTransactions.accountId, userAccountIds),
        gte(plaidTransactions.date, new Date(startDate)),
        lte(plaidTransactions.date, new Date(endDate))
      )
    });

    // Group transactions by category and calculate totals
    const categoryTotals = new Map<string, number>();
    let totalSpending = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      if (amount > 0 && !tx.pending) { // Only count expenses (positive amounts)
        const category = tx.categoryPrimary || 'Uncategorized';
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
        totalSpending += amount;
      }
    }

    // Convert to array and sort by amount
    const insights = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalSpending) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalSpending,
      categoryBreakdown: insights,
      transactionCount: transactions.length,
      dateRange: { startDate, endDate },
    };
  } catch (error) {
    console.error('Error getting spending insights:', error);
    throw new Error(`Failed to get spending insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check account health (balance trends, warnings)
 * @param accessToken Plaid access token
 * @returns Account health assessment
 */
export async function checkAccountHealth(accessToken: string) {
  try {
    const { accounts } = await getAccountBalances(accessToken);

    const healthChecks = accounts.map(account => {
      const warnings: string[] = [];
      const balance = account.balances.current || 0;
      const available = account.balances.available || 0;

      // Check for low balance
      if (balance < 100 && account.type === 'depository') {
        warnings.push('Low balance warning');
      }

      // Check for negative balance
      if (balance < 0) {
        warnings.push('Negative balance');
      }

      // Check for over-limit on credit accounts
      if (account.type === 'credit' && account.balances.limit) {
        const utilization = (Math.abs(balance) / account.balances.limit) * 100;
        if (utilization > 90) {
          warnings.push('High credit utilization (>90%)');
        } else if (utilization > 70) {
          warnings.push('Moderate credit utilization (>70%)');
        }
      }

      return {
        accountId: account.account_id,
        accountName: account.name,
        accountType: account.type,
        balance,
        available,
        status: warnings.length === 0 ? 'healthy' : 'attention_needed',
        warnings,
      };
    });

    return {
      accounts: healthChecks,
      overallStatus: healthChecks.some(a => a.warnings.length > 0) ? 'attention_needed' : 'healthy',
      summary: {
        totalAccounts: accounts.length,
        accountsWithWarnings: healthChecks.filter(a => a.warnings.length > 0).length,
      },
    };
  } catch (error) {
    console.error('Error checking account health:', error);
    throw new Error(`Failed to check account health: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sync transactions (recommended over getTransactions)
 * @param accessToken Plaid access token
 * @param cursor Optional cursor for pagination
 * @returns Transaction updates with cursor for next call
 */
export async function syncTransactions(accessToken: string, cursor?: string) {
  try {
    const request: TransactionsSyncRequest = {
      access_token: accessToken,
      ...(cursor && { cursor }),
    };

    const response = await getPlaidClient().transactionsSync(request);
    return {
      added: response.data.added,
      modified: response.data.modified,
      removed: response.data.removed,
      nextCursor: response.data.next_cursor,
      hasMore: response.data.has_more,
    };
  } catch (error) {
    console.error('Error syncing transactions:', error);
    throw new Error(`Failed to sync transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get recurring transactions (subscriptions, bills)
 * @param accessToken Plaid access token
 * @returns Recurring transaction streams
 */
export async function getRecurringTransactions(accessToken: string) {
  try {
    const request: TransactionsRecurringGetRequest = {
      access_token: accessToken,
    };

    const response = await getPlaidClient().transactionsRecurringGet(request);
    return {
      inflowStreams: response.data.inflow_streams,
      outflowStreams: response.data.outflow_streams,
    };
  } catch (error) {
    console.error('Error getting recurring transactions:', error);
    throw new Error(`Failed to get recurring transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get account and routing numbers
 * @param accessToken Plaid access token
 * @returns Account numbers for ACH transfers
 */
export async function getAuth(accessToken: string) {
  try {
    const request: AuthGetRequest = {
      access_token: accessToken,
    };

    const response = await getPlaidClient().authGet(request);
    return {
      accounts: response.data.accounts,
      numbers: response.data.numbers,
    };
  } catch (error: any) {
    logPlaidError('authGet', error);
    throw new Error(`Failed to get auth data: ${getPlaidErrorMessage(error)}`);
  }
}

/**
 * Get investment holdings
 * @param accessToken Plaid access token
 * @returns Investment holdings and securities, or null if not supported by institution
 */
export async function getInvestmentHoldings(accessToken: string) {
  try {
    const request: InvestmentsHoldingsGetRequest = {
      access_token: accessToken,
    };

    const response = await getPlaidClient().investmentsHoldingsGet(request);
    return {
      accounts: response.data.accounts,
      holdings: response.data.holdings,
      securities: response.data.securities,
    };
  } catch (error: any) {
    if (isProductNotSupported(error)) {
      console.log('[Plaid] Institution does not support investments, skipping');
      return null;
    }
    logPlaidError('investmentsHoldingsGet', error);
    throw new Error(`Failed to get investment holdings: ${getPlaidErrorMessage(error)}`);
  }
}

/**
 * Get investment transactions
 * @param accessToken Plaid access token
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Investment transactions (buys, sells, dividends), or null if not supported
 */
export async function getInvestmentTransactions(accessToken: string, startDate: string, endDate: string) {
  try {
    const request: InvestmentsTransactionsGetRequest = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    };

    const response = await getPlaidClient().investmentsTransactionsGet(request);
    return {
      accounts: response.data.accounts,
      investmentTransactions: response.data.investment_transactions,
      securities: response.data.securities,
      totalInvestmentTransactions: response.data.total_investment_transactions,
    };
  } catch (error: any) {
    if (isProductNotSupported(error)) {
      console.log('[Plaid] Institution does not support investments, skipping');
      return null;
    }
    logPlaidError('investmentsTransactionsGet', error);
    throw new Error(`Failed to get investment transactions: ${getPlaidErrorMessage(error)}`);
  }
}

/**
 * Get liabilities (credit cards, loans, mortgages)
 * @param accessToken Plaid access token
 * @returns Liability details including payment schedules, or null if not supported
 */
export async function getLiabilities(accessToken: string) {
  try {
    const request: LiabilitiesGetRequest = {
      access_token: accessToken,
    };

    const response = await getPlaidClient().liabilitiesGet(request);
    return {
      accounts: response.data.accounts,
      liabilities: response.data.liabilities,
    };
  } catch (error: any) {
    if (isProductNotSupported(error)) {
      console.log('[Plaid] Institution does not support liabilities, skipping');
      return null;
    }
    logPlaidError('liabilitiesGet', error);
    throw new Error(`Failed to get liabilities: ${getPlaidErrorMessage(error)}`);
  }
}

/**
 * Get information about an item
 * @param accessToken Plaid access token
 * @returns Item information
 */
export async function getItem(accessToken: string) {
  try {
    const request: ItemGetRequest = {
      access_token: accessToken,
    };

    const response = await getPlaidClient().itemGet(request);
    return response.data.item;
  } catch (error) {
    console.error('Error getting item:', error);
    throw new Error(`Failed to get item: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Evaluate ACH payment risk using ML-powered predictions
 * Predicts likelihood of returns/bounces before initiating payments
 * @param accessToken Plaid access token
 * @param accountId Account to evaluate
 * @param amount Payment amount
 * @param userId User identifier for the payment
 * @returns Risk scores and recommendation
 */
export async function evaluatePaymentRisk(
  accessToken: string,
  accountId: string,
  amount: number,
  userId: string
) {
  try {
    const response = await getPlaidClient().signalEvaluate({
      access_token: accessToken,
      account_id: accountId,
      client_transaction_id: `txn-${Date.now()}`,
      amount: amount,
      user_present: true,
      client_user_id: userId,
      is_recurring: false,
    });

    const scores = response.data.scores;

    if (!scores) {
      throw new Error("No risk scores returned from Plaid");
    }

    return {
      scores: {
        customerInitiatedReturnRisk: scores.customer_initiated_return_risk?.score ?? 0,
        bankInitiatedReturnRisk: scores.bank_initiated_return_risk?.score ?? 0,
      },
      coreAttributes: response.data.core_attributes,
    };
  } catch (error: any) {
    logPlaidError("signalEvaluate", error);
    throw new Error(
      `Failed to evaluate payment risk: ${getPlaidErrorMessage(error)}`
    );
  }
}

/**
 * Helper: Map Plaid personal_finance_category to tax categories
 * @param category Plaid category object
 * @returns Tax category string
 */
export function mapToTaxCategory(
  category: { primary?: string; detailed?: string } | undefined
): string {
  if (!category?.primary) return "Other";

  const taxCategoryMap: Record<string, string> = {
    INCOME: "Income",
    TRANSFER_IN: "Income - Transfers",
    TRANSFER_OUT: "Expense - Transfers",
    LOAN_PAYMENTS: "Loan Payments",
    BANK_FEES: "Bank Fees & Charges",
    ENTERTAINMENT: "Entertainment",
    FOOD_AND_DRINK: "Meals & Entertainment",
    GENERAL_MERCHANDISE: "Office Supplies & General Merchandise",
    HOME_IMPROVEMENT: "Repairs & Maintenance",
    MEDICAL: "Medical & Healthcare",
    PERSONAL_CARE: "Personal Care",
    GENERAL_SERVICES: "Professional Services",
    GOVERNMENT_AND_NON_PROFIT: "Taxes & Government Fees",
    TRANSPORTATION: "Transportation & Vehicle",
    TRAVEL: "Travel",
    RENT_AND_UTILITIES: "Rent & Utilities",
  };

  return taxCategoryMap[category.primary] || "Other Business Expense";
}

/**
 * Helper: Detect spending anomalies using statistical analysis
 * @param transactions Array of transactions to analyze
 * @returns Array of anomalies detected
 */
export function detectSpendingAnomalies(
  transactions: Array<{ amount: number; category?: string; date: Date | string; name: string }>
): Array<{
  transaction: typeof transactions[number];
  reason: string;
  severity: "high" | "medium" | "low";
}> {
  const anomalies: Array<{
    transaction: typeof transactions[number];
    reason: string;
    severity: "high" | "medium" | "low";
  }> = [];

  // Calculate average transaction amount
  const amounts = transactions.map((t) => t.amount);
  const avg = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
  const stdDev = Math.sqrt(
    amounts.reduce((sum, amt) => sum + Math.pow(amt - avg, 2), 0) /
      amounts.length
  );

  // Detect outliers (2+ standard deviations from mean)
  for (const tx of transactions) {
    const zScore = Math.abs((tx.amount - avg) / stdDev);

    if (zScore > 3) {
      anomalies.push({
        transaction: tx,
        reason: `Unusually large transaction (${zScore.toFixed(
          1
        )}x above average)`,
        severity: "high",
      });
    } else if (zScore > 2) {
      anomalies.push({
        transaction: tx,
        reason: `Higher than typical spending`,
        severity: "medium",
      });
    }
  }

  // Detect duplicate/suspicious same-day transactions
  const dateMap = new Map<string, typeof transactions[number]>();
  for (const tx of transactions) {
    const dateKey = `${tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : tx.date}-${tx.amount}`;
    const existing = dateMap.get(dateKey);
    if (existing) {
      anomalies.push({
        transaction: tx,
        reason: "Potential duplicate transaction on same day",
        severity: "low",
      });
    }
    dateMap.set(dateKey, tx);
  }

  return anomalies;
}

/**
 * Helper: Calculate account health score (0-100)
 * @param accounts Array of accounts to evaluate
 * @param transactions Recent transactions for trend analysis
 * @returns Health score and trend
 */
export function calculateAccountHealthScore(
  accounts: Array<{
    type: string;
    balances: {
      current: number | null;
      available: number | null;
      limit?: number | null;
    };
  }>,
  transactions: Array<{ amount: number; date: Date | string }>
): {
  score: number;
  trend: "improving" | "stable" | "declining";
  factors: string[];
} {
  let score = 100;
  const factors: string[] = [];

  // Factor 1: Low balances (-20 points)
  const lowBalanceAccounts = accounts.filter(
    (acc) =>
      acc.type === "depository" &&
      (acc.balances.current || 0) < 100
  );
  if (lowBalanceAccounts.length > 0) {
    score -= 20;
    factors.push(`${lowBalanceAccounts.length} account(s) with low balance`);
  }

  // Factor 2: Negative balances (-30 points)
  const negativeAccounts = accounts.filter(
    (acc) => (acc.balances.current || 0) < 0
  );
  if (negativeAccounts.length > 0) {
    score -= 30;
    factors.push(`${negativeAccounts.length} account(s) overdrawn`);
  }

  // Factor 3: High credit utilization (-25 points)
  const highUtilization = accounts.filter((acc) => {
    if (acc.type !== "credit" || !acc.balances.limit) return false;
    const utilization =
      (Math.abs(acc.balances.current || 0) / acc.balances.limit) * 100;
    return utilization > 70;
  });
  if (highUtilization.length > 0) {
    score -= 25;
    factors.push(`${highUtilization.length} credit account(s) with high utilization`);
  }

  // Calculate trend from recent transactions
  const sortedTxns = [...transactions].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date : new Date(a.date);
    const dateB = b.date instanceof Date ? b.date : new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  const midpoint = Math.floor(sortedTxns.length / 2);
  const firstHalf = sortedTxns.slice(0, midpoint);
  const secondHalf = sortedTxns.slice(midpoint);

  const avgFirst = firstHalf.reduce((sum, t) => sum + t.amount, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, t) => sum + t.amount, 0) / secondHalf.length;

  let trend: "improving" | "stable" | "declining" = "stable";
  if (avgSecond < avgFirst * 0.9) {
    trend = "improving"; // Spending less
  } else if (avgSecond > avgFirst * 1.1) {
    trend = "declining"; // Spending more
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    trend,
    factors,
  };
}

/**
 * Helper: Calculate business metrics (runway, burn rate, etc.)
 * @param accounts Business accounts
 * @param transactions Recent transactions
 * @param monthsToProject Number of months to project forward
 * @returns Business financial metrics
 */
export function calculateBusinessMetrics(
  accounts: Array<{
    balances: { current: number | null };
  }>,
  transactions: Array<{ amount: number; date: Date | string }>,
  monthsToProject: number = 6
) {
  const currentBalance = accounts.reduce(
    (sum, acc) => sum + (acc.balances.current || 0),
    0
  );

  // Separate revenue (negative amounts) vs expenses (positive)
  const revenue = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const expenses = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = revenue - expenses;
  const monthlyBurnRate = expenses / 12; // Approximate monthly

  const runwayMonths =
    monthlyBurnRate > revenue / 12
      ? currentBalance / (monthlyBurnRate - revenue / 12)
      : Infinity;

  // Generate projections
  const projections = Array.from({ length: monthsToProject }, (_, i) => {
    const month = i + 1;
    const projectedBalance =
      currentBalance - monthlyBurnRate * month + (revenue / 12) * month;

    return {
      period: `Month ${month}`,
      projectedNet: Math.round(projectedBalance * 100) / 100,
      projectedRevenue: Math.round((revenue / 12) * month * 100) / 100,
      projectedExpenses: Math.round(monthlyBurnRate * month * 100) / 100,
      confidence: (month <= 3 ? "high" : month <= 6 ? "medium" : "low") as
        | "high"
        | "medium"
        | "low",
    };
  });

  return {
    currentBalance,
    revenue,
    expenses,
    netCashFlow,
    monthlyBurnRate,
    runwayMonths: Math.max(0, runwayMonths),
    projections,
  };
}

/**
 * Helper: Calculate investment performance metrics
 * @param holdings Current investment holdings
 * @param transactions Investment transactions for performance calculation
 * @returns Performance metrics including gains/losses
 */
export function calculateInvestmentPerformance(
  holdings: Array<{
    cost_basis: number | null;
    institution_value: number;
    quantity: number;
    institution_price: number;
  }>,
  transactions?: Array<{
    amount: number;
    date: string;
    type: string;
  }>
) {
  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.institution_value || h.quantity * h.institution_price),
    0
  );

  const totalCostBasis = holdings.reduce(
    (sum, h) => sum + (h.cost_basis || 0),
    0
  );

  const totalGainLoss = totalValue - totalCostBasis;
  const percentReturn =
    totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    totalCostBasis: Math.round(totalCostBasis * 100) / 100,
    totalGainLoss: Math.round(totalGainLoss * 100) / 100,
    percentReturn: Math.round(percentReturn * 100) / 100,
  };
}
