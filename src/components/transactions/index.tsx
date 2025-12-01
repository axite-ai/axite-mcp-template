"use client";

import React, { useMemo } from "react";
import {
  Expand,
  Search,
  Filter,
  Calendar,
  ArrowDown,
  ArrowUp,
  DollarCircle,
} from "@openai/apps-sdk-ui/components/Icon";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Input } from "@openai/apps-sdk-ui/components/Input";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Select } from "@openai/apps-sdk-ui/components/Select";
import { EmptyMessage } from "@openai/apps-sdk-ui/components/EmptyMessage";
import { AnimateLayout, AnimateLayoutGroup } from "@openai/apps-sdk-ui/components/Transition";
import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import { useWidgetState } from "@/src/use-widget-state";
import { useDisplayMode } from "@/src/use-display-mode";
import { useMaxHeight } from "@/src/use-max-height";
import { formatCurrency, formatDate } from "@/src/utils/format";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import { WidgetLoadingSkeleton } from "@/src/components/shared/widget-loading-skeleton";
import { cn } from "@/lib/utils/cn";
import type { Transaction } from "plaid";

interface TransactionWithEnrichment extends Transaction {
  // All fields from Plaid Transaction type are available
}

interface ToolOutputData extends Record<string, unknown> {
  totalTransactions?: number;
  displayedTransactions?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  metadata?: {
    categoryBreakdown: Array<{
      category: string;
      count: number;
      total: number;
    }>;
    topMerchants: Array<{
      merchantId: string;
      name: string;
      count: number;
      total: number;
    }>;
    summary: {
      totalSpending: number;
      totalIncome: number;
      netCashFlow: number;
      pendingCount: number;
      averageTransaction: number;
    };
  };
}

interface ToolMetadata {
  transactions: TransactionWithEnrichment[];
}

interface TransactionsUIState extends Record<string, unknown> {
  selectedCategory: string | null;
  searchQuery: string;
  showPendingOnly: boolean;
  expandedTx: string | null;
  showAllDates: boolean;
  expandedDateGroups: string[];
}

// Category mapping to SDK colors/badges
const CATEGORY_STYLES: Record<string, { color: "success" | "warning" | "danger" | "info" | "discovery" | "secondary"; icon: string }> = {
  FOOD_AND_DRINK: { color: "warning", icon: "🍔" },
  GENERAL_MERCHANDISE: { color: "info", icon: "🛍️" },
  TRANSPORTATION: { color: "discovery", icon: "🚗" },
  TRANSFER_IN: { color: "success", icon: "💰" },
  TRANSFER_OUT: { color: "danger", icon: "💸" },
  ENTERTAINMENT: { color: "discovery", icon: "🎬" },
  TRAVEL: { color: "info", icon: "✈️" },
  GENERAL_SERVICES: { color: "secondary", icon: "⚙️" },
  RENT_AND_UTILITIES: { color: "warning", icon: "🏠" },
  HOME_IMPROVEMENT: { color: "info", icon: "🔨" },
  MEDICAL: { color: "danger", icon: "🏥" },
  BANK_FEES: { color: "secondary", icon: "🏦" },
  LOAN_PAYMENTS: { color: "discovery", icon: "💳" },
  INCOME: { color: "success", icon: "💵" },
  UNCATEGORIZED: { color: "secondary", icon: "❓" },
};

const PAYMENT_CHANNEL_ICONS: Record<string, string> = {
  online: "🌐",
  "in store": "🏪",
  other: "💳",
};

function formatCategoryName(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export default function Transactions() {
  const toolOutput = useWidgetProps<ToolOutputData>();
  const toolMetadata = useOpenAiGlobal("toolResponseMetadata") as ToolMetadata | null;
  const [uiState, setUiState] = useWidgetState<TransactionsUIState>({
    selectedCategory: null,
    searchQuery: "",
    showPendingOnly: false,
    expandedTx: null,
    showAllDates: false,
    expandedDateGroups: [],
  });

  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isFullscreen = displayMode === "fullscreen";

  // Max visible transactions per date group in inline mode
  const MAX_VISIBLE_INLINE = 3;
  // Max visible date groups in inline mode
  const MAX_DATE_GROUPS_INLINE = 3;

  const transactions = toolMetadata?.transactions || [];
  const metadata = toolOutput?.metadata;

  const expandedDateGroupsSet = useMemo(() => new Set(uiState.expandedDateGroups), [uiState.expandedDateGroups]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (uiState.selectedCategory) {
      filtered = filtered.filter(
        (tx) => tx.personal_finance_category?.primary === uiState.selectedCategory
      );
    }

    if (uiState.searchQuery) {
      const query = uiState.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          (tx.merchant_name?.toLowerCase() || "").includes(query) ||
          (tx.name?.toLowerCase() || "").includes(query) ||
          (tx.personal_finance_category?.detailed?.toLowerCase() || "").includes(query)
      );
    }

    if (uiState.showPendingOnly) {
      filtered = filtered.filter((tx) => tx.pending);
    }

    return filtered;
  }, [transactions, uiState.selectedCategory, uiState.searchQuery, uiState.showPendingOnly]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, TransactionWithEnrichment[]> = {};
    filteredTransactions.forEach((tx) => {
      const date = tx.authorized_date || tx.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  // Show loading skeleton during initial load
  if (!toolOutput) {
    return <WidgetLoadingSkeleton className="min-h-[400px]" />;
  }

  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  // Show empty state only if there's truly no data
  if (!toolMetadata?.transactions || toolMetadata.transactions.length === 0) {
    return (
      <EmptyMessage>
        <EmptyMessage.Title>No transactions available</EmptyMessage.Title>
      </EmptyMessage>
    );
  }

  return (
    <div
      className={cn(
        "antialiased w-full relative bg-transparent text-default",
        !isFullscreen && "overflow-hidden"
      )}
      style={{
        maxHeight: maxHeight ?? undefined,
        height: isFullscreen ? maxHeight ?? undefined : undefined,
      }}
    >
      {!isFullscreen && (
        <Button
          onClick={() => window.openai?.requestDisplayMode({ mode: "fullscreen" })}
          variant="ghost"
          color="secondary"
          size="sm"
          className="absolute top-4 right-4 z-20"
          aria-label="Expand to fullscreen"
        >
          <Expand className="h-4 w-4" />
        </Button>
      )}

      <div className={cn("w-full h-full overflow-y-auto", isFullscreen ? "p-8" : "p-0")}>
        {/* Header - Only show full header in fullscreen */}
        <div className="mb-6">
          <h1 className="heading-lg mb-2">
            Transactions
          </h1>
          {toolOutput?.dateRange && (
            <p className="text-sm text-secondary">
              {`${formatDate(toolOutput.dateRange.start)} - ${formatDate(toolOutput.dateRange.end)}`}
            </p>
          )}
        </div>

        {/* Summary Cards - Only show in fullscreen */}
        {isFullscreen && metadata && (
          <div className="grid gap-4 mb-6 grid-cols-2 md:grid-cols-4">
            <div className="rounded-2xl border-none bg-success-soft p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-success-surface text-success-soft">
                  <ArrowUp className="h-4 w-4" />
                </div>
                <div className="text-xs font-medium text-success-soft uppercase tracking-wide">
                  Income
                </div>
              </div>
              <div className="text-xl font-bold text-success-soft">
                {formatCurrency(metadata.summary.totalIncome)}
              </div>
            </div>

            <div className="rounded-2xl border-none bg-danger-soft p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-danger-surface text-danger-soft">
                  <ArrowDown className="h-4 w-4" />
                </div>
                <div className="text-xs font-medium text-danger-soft uppercase tracking-wide">
                  Spending
                </div>
              </div>
              <div className="text-xl font-bold text-danger-soft">
                {formatCurrency(metadata.summary.totalSpending)}
              </div>
            </div>

            <div className="rounded-2xl border-none bg-info-soft p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-info-surface text-info-soft">
                  <DollarCircle className="h-4 w-4" />
                </div>
                <div className="text-xs font-medium text-info-soft uppercase tracking-wide">
                  Net Flow
                </div>
              </div>
              <div
                className={`text-xl font-bold ${metadata.summary.netCashFlow >= 0 ? "text-success-soft" : "text-danger-soft"}`}
              >
                {metadata.summary.netCashFlow >= 0 ? "+" : ""}
                {formatCurrency(metadata.summary.netCashFlow)}
              </div>
            </div>

            <div className="rounded-2xl border-none bg-discovery-soft p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-discovery-surface text-discovery-soft">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="text-xs font-medium text-discovery-soft uppercase tracking-wide">
                  Pending
                </div>
              </div>
              <div className="text-xl font-bold text-discovery-soft">
                {metadata.summary.pendingCount}
              </div>
            </div>
          </div>
        )}

        {/* Filters - Only show in fullscreen */}
        {isFullscreen && metadata && (
          <div className="mb-6 space-y-3">
            <Input
              placeholder="Search..."
              value={uiState.searchQuery}
              onChange={(e) => setUiState(s => ({ ...s, searchQuery: e.target.value }))}
              startAdornment={<Search className="text-tertiary" />}
              size="md"
              className="w-full"
            />

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Select
                value={uiState.selectedCategory || ""}
                onChange={(val: any) => setUiState(s => ({...s, selectedCategory: val?.value || null}))}
                options={[
                  { value: "", label: "All Categories" },
                  ...metadata.categoryBreakdown.map((cat) => ({
                    value: cat.category,
                    label: formatCategoryName(cat.category)
                  }))
                ]}
                placeholder="Category"
                size="sm"
                variant="outline"
                triggerClassName="min-w-[140px]"
              />

              <Button
                variant={uiState.showPendingOnly ? "solid" : "outline"}
                color={uiState.showPendingOnly ? "warning" : "secondary"}
                onClick={() => setUiState(s => ({...s, showPendingOnly: !s.showPendingOnly}))}
                size="sm"
                className="whitespace-nowrap"
              >
                {uiState.showPendingOnly ? "Pending Only" : "Pending"}
              </Button>
            </div>
          </div>
        )}

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <EmptyMessage>
            <EmptyMessage.Title>No transactions match your filters</EmptyMessage.Title>
          </EmptyMessage>
        ) : (
          <div className="space-y-6">
            {(isFullscreen || uiState.showAllDates
              ? groupedTransactions
              : groupedTransactions.slice(0, MAX_DATE_GROUPS_INLINE)
            ).map(([date, txs], groupIndex) => (
              <div key={date}>
                <div className="mb-2 px-1">
                  <h3 className="text-xs font-medium text-secondary uppercase tracking-wide">
                    {formatDate(date)}
                  </h3>
                </div>

                <div className={cn(
                  "rounded-xl overflow-hidden bg-surface",
                  // Only show border in fullscreen to match minimal style for inline
                  isFullscreen && "border border-subtle shadow-sm"
                )}>
                  <AnimateLayoutGroup>
                    {(isFullscreen || expandedDateGroupsSet.has(date) ? txs : txs.slice(0, MAX_VISIBLE_INLINE)).map((tx, index) => {
                      const isExpanded = uiState.expandedTx === tx.transaction_id;
                      const merchantName = tx.merchant_name || tx.name || "Unknown";
                      const category = tx.personal_finance_category?.primary || "UNCATEGORIZED";
                      const categoryDetailed =
                        tx.personal_finance_category?.detailed || "Uncategorized";
                      const logo = tx.logo_url || tx.counterparties?.[0]?.logo_url;

                      return (
                        <div
                          key={tx.transaction_id}
                          className={cn(
                            "cursor-pointer hover:bg-surface-secondary/50 transition-colors",
                            // In inline mode, no internal borders for cleaner look
                            (isFullscreen && index !== 0) && "border-t border-subtle",
                            // In inline mode, add subtle spacing between items instead of border
                            (!isFullscreen) && "mb-2 last:mb-0 rounded-lg"
                          )}
                          onClick={() => setUiState(s => ({...s, expandedTx: isExpanded ? null : tx.transaction_id}))}
                        >
                          <div className={cn("p-3 flex items-center justify-between gap-3", !isFullscreen && "bg-surface-secondary/30 rounded-lg")}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-lg flex-shrink-0 border border-subtle overflow-hidden">
                                {logo ? (
                                  <img src={logo} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  merchantName.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-sm text-default truncate">
                                    {merchantName}
                                  </h3>
                                  {tx.pending && (
                                    <span className="text-[10px] font-bold uppercase text-warning bg-warning-soft px-1.5 py-0.5 rounded-full">
                                      Pending
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-secondary truncate">
                                  {formatCategoryName(category)}
                                </p>
                              </div>
                            </div>

                            <div className={cn(
                              "text-sm font-semibold flex-shrink-0",
                              tx.amount < 0 ? "text-success" : "text-default"
                            )}>
                              {tx.amount < 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount), tx.iso_currency_code || "USD")}
                            </div>
                          </div>

                          <AnimateLayout>
                            {isExpanded && (
                              <div key={`${tx.transaction_id}-details`} className="px-4 pb-4 pt-1 bg-surface-secondary/20">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="block text-secondary mb-0.5">Category</span>
                                    <span className="text-default font-medium">{formatCategoryName(categoryDetailed)}</span>
                                  </div>
                                  {tx.payment_channel && (
                                    <div>
                                      <span className="block text-secondary mb-0.5">Payment Method</span>
                                      <span className="text-default capitalize">{tx.payment_channel}</span>
                                    </div>
                                  )}
                                  {tx.original_description && (
                                    <div className="col-span-2">
                                      <span className="block text-secondary mb-0.5">Statement Descriptor</span>
                                      <span className="text-default font-mono text-[11px]">{tx.original_description}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </AnimateLayout>
                        </div>
                      );
                    })}
                  </AnimateLayoutGroup>
                </div>

                {!isFullscreen && !expandedDateGroupsSet.has(date) && txs.length > MAX_VISIBLE_INLINE && (
                  <Button
                    variant="ghost"
                    color="secondary"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setUiState(s => ({ ...s, expandedDateGroups: [...s.expandedDateGroups, date]}));
                    }}
                  >
                    View {txs.length - MAX_VISIBLE_INLINE} more
                  </Button>
                )}
              </div>
            ))}

            {!isFullscreen && !uiState.showAllDates && groupedTransactions.length > MAX_DATE_GROUPS_INLINE && (
              <Button
                variant="outline"
                color="secondary"
                className="w-full"
                onClick={() => window.openai?.requestDisplayMode({ mode: "fullscreen" })}
              >
                View more history
              </Button>
            )}
          </div>
        )}

        {isFullscreen && (
          <div className="mt-6 text-center text-sm text-secondary">
            Showing {filteredTransactions.length} of {toolOutput?.totalTransactions ?? transactions.length} transactions
          </div>
        )}
      </div>
    </div>
  );
}
