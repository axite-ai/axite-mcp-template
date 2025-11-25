"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import { useWidgetState } from "@/src/use-widget-state";
import { useDisplayMode } from "@/src/use-display-mode";
import { useMaxHeight } from "@/src/use-max-height";
import { useTheme } from "@/src/use-theme";
import { formatCurrency } from "@/src/utils/format";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import { cn } from "@/lib/utils/cn";
import type { AccountOverviewContent } from "@/lib/types/tool-responses";

interface Account {
  account_id: string;
  name: string;
  type: string;
  subtype?: string;
  mask: string | null;
  balances: {
    current: number | null;
    available: number | null;
    iso_currency_code: string;
  };
}

interface Projection {
  month: number;
  projectedBalance: number;
  confidence: "high" | "medium" | "low";
}

interface ToolOutput extends Record<string, unknown> {
  structuredContent?: AccountOverviewContent;
}

interface BalancesUIState extends Record<string, unknown> {
  expandedAccountIds: string[];
}

function getAccountIcon(type: string, subtype?: string) {
  const iconType = (subtype || type).toLowerCase();

  if (iconType.includes("checking")) return "💳";
  if (iconType.includes("savings")) return "🏦";
  if (iconType.includes("credit")) return "💎";
  if (iconType.includes("investment") || iconType.includes("brokerage"))
    return "📈";
  if (iconType.includes("loan") || iconType.includes("mortgage")) return "🏠";
  return "💰";
}

function getAccountColor(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("checking")) return "from-blue-500 to-blue-600";
  if (lower.includes("savings")) return "from-emerald-500 to-emerald-600";
  if (lower.includes("credit")) return "from-purple-500 to-purple-600";
  if (lower.includes("investment")) return "from-amber-500 to-amber-600";
  if (lower.includes("loan")) return "from-red-500 to-red-600";
  return "from-gray-500 to-gray-600";
}

function getHealthColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getTrendIcon(trend: string) {
  if (trend === "improving") return <TrendingUp className="w-4 h-4 text-green-600" />;
  if (trend === "declining") return <TrendingDown className="w-4 h-4 text-red-600" />;
  return null;
}

interface AccountCardProps {
  account: Account;
  isExpanded: boolean;
  onToggle: () => void;
  isDark: boolean;
}

function AccountCard({ account, isExpanded, onToggle, isDark }: AccountCardProps) {
  const hasAvailable =
    account.balances.available !== null &&
    account.balances.available !== account.balances.current;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-all",
        isDark
          ? "bg-gray-800 border-white/10 hover:border-white/20"
          : "bg-white border-black/10 hover:border-black/20",
        "shadow-[0px_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0px_6px_14px_rgba(0,0,0,0.1)]"
      )}
    >
      {/* Gradient accent */}
      <div
        className={cn(
          "absolute inset-0 opacity-5 bg-gradient-to-br",
          getAccountColor(account.type)
        )}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl bg-gradient-to-br",
                getAccountColor(account.type)
              )}
            >
              {getAccountIcon(account.type, account.subtype)}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={cn(
                  "font-medium text-base truncate",
                  isDark ? "text-white" : "text-black"
                )}
              >
                {account.name}
              </h3>
              <p
                className={cn(
                  "text-sm mt-0.5",
                  isDark ? "text-white/60" : "text-black/60"
                )}
              >
                {account.type}
                {account.mask && ` • ****${account.mask}`}
              </p>
            </div>
          </div>

          {hasAvailable && (
            <button
              onClick={onToggle}
              className={cn(
                "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                isDark
                  ? "hover:bg-white/10 text-white/70"
                  : "hover:bg-black/5 text-black/70"
              )}
              aria-label={isExpanded ? "Show less" : "Show more"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Current Balance */}
        {account.balances.current !== null && (
          <div className="mb-3">
            <div
              className={cn(
                "text-xs font-medium mb-1",
                isDark ? "text-white/50" : "text-black/50"
              )}
            >
              Current Balance
            </div>
            <div
              className={cn(
                "text-2xl font-semibold",
                isDark ? "text-white" : "text-black"
              )}
            >
              {formatCurrency(
                account.balances.current,
                account.balances.iso_currency_code
              )}
            </div>
          </div>
        )}

        {/* Available Balance (expandable) */}
        <AnimatePresence initial={false}>
          {hasAvailable && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "pt-3 mt-3 border-t",
                  isDark ? "border-white/10" : "border-black/10"
                )}
              >
                <div
                  className={cn(
                    "text-xs font-medium mb-1",
                    isDark ? "text-white/50" : "text-black/50"
                  )}
                >
                  Available Balance
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold",
                    isDark ? "text-emerald-400" : "text-emerald-600"
                  )}
                >
                  {formatCurrency(
                    account.balances.available!,
                    account.balances.iso_currency_code
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function AccountBalances() {
  const toolOutput = useWidgetProps<ToolOutput>();
  const toolMetadata = useOpenAiGlobal("toolResponseMetadata") as any;
  const [uiState, setUiState] = useWidgetState<BalancesUIState>({
    expandedAccountIds: [],
  });

  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const theme = useTheme();
  const isFullscreen = displayMode === "fullscreen";
  const isDark = theme === "dark";

  const toggleAccountExpanded = (accountId: string) => {
    setUiState(prevState => {
      const currentlyExpanded = new Set(prevState.expandedAccountIds);
      if (currentlyExpanded.has(accountId)) {
        currentlyExpanded.delete(accountId);
      } else {
        currentlyExpanded.add(accountId);
      }
      return { ...prevState, expandedAccountIds: Array.from(currentlyExpanded) };
    });
  };

  // Check for auth requirements
  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-8 text-center text-black/60 dark:text-white/60">
        <p>No account data available</p>
      </div>
    );
  }

  const { summary, accounts } = toolOutput.structuredContent;
  const projections = (toolMetadata?.projections ?? toolOutput.structuredContent.projections ?? []) as Projection[];

  // No data check
  if (!accounts || accounts.length === 0) {
    return (
      <div className="p-8 text-center text-black/60 dark:text-white/60">
        <p>No accounts found</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "antialiased w-full relative",
        isDark ? "bg-gray-900" : "bg-gray-50",
        !isFullscreen && "overflow-hidden"
      )}
      style={{
        maxHeight: maxHeight ?? undefined,
        height: isFullscreen ? maxHeight ?? undefined : undefined,
      }}
    >
      {/* Fullscreen expand button */}
      {!isFullscreen && (
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.openai) {
              window.openai.requestDisplayMode({ mode: "fullscreen" });
            }
          }}
          className={cn(
            "absolute top-4 right-4 z-20 p-2 rounded-full shadow-lg transition-all",
            isDark
              ? "bg-gray-800 text-white hover:bg-gray-700"
              : "bg-white text-black hover:bg-gray-100",
            "ring-1",
            isDark ? "ring-white/10" : "ring-black/5"
          )}
          aria-label="Expand to fullscreen"
        >
          <Maximize2 strokeWidth={1.5} className="h-4 w-4" />
        </button>
      )}

      {/* Content */}
      <div
        className={cn(
          "w-full h-full overflow-y-auto",
          isFullscreen ? "p-8" : "p-5"
        )}
      >
        {/* Header */}
        <div className="mb-6">
          <h1
            className={cn(
              "text-2xl font-semibold mb-2",
              isDark ? "text-white" : "text-black"
            )}
          >
            Financial Overview
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p
                className={cn(
                  "text-sm",
                  isDark ? "text-white/60" : "text-black/60"
                )}
              >
                Total Balance
              </p>
              <p
                className={cn(
                  "text-3xl font-semibold mt-1",
                  isDark ? "text-white" : "text-black"
                )}
              >
                {formatCurrency(summary.totalBalance)}
              </p>
              <p className={cn("text-xs mt-1", isDark ? "text-white/50" : "text-black/50")}>
                {summary.accountCount} {summary.accountCount === 1 ? "account" : "accounts"}
              </p>
            </div>
            <div>
              <p className={cn("text-sm", isDark ? "text-white/60" : "text-black/60")}>
                Health Score
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className={cn("text-3xl font-semibold", getHealthColor(summary.healthScore))}>
                  {summary.healthScore}
                </p>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
            </div>
            <div>
              <p className={cn("text-sm", isDark ? "text-white/60" : "text-black/60")}>
                Trend
              </p>
              <div className="flex items-center gap-2 mt-2">
                {getTrendIcon(summary.trend)}
                <span className={cn("text-lg font-medium capitalize", isDark ? "text-white" : "text-black")}>
                  {summary.trend}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Projections */}
        {projections && projections.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border" style={{
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
          }}>
            <h2 className={cn("text-sm font-medium mb-3", isDark ? "text-white/70" : "text-black/70")}>
              Cash Flow Projection
            </h2>
            <div className="space-y-2">
              {projections.map((proj) => (
                <div key={proj.month} className="flex items-center gap-3">
                  <span className={cn("text-xs w-16", isDark ? "text-white/60" : "text-black/60")}>
                    Month {proj.month}
                  </span>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full",
                        proj.confidence === "high" ? "bg-green-500" :
                        proj.confidence === "medium" ? "bg-yellow-500" : "bg-gray-400"
                      )}
                      style={{ width: `${Math.min(100, (proj.projectedBalance / summary.totalBalance) * 100)}%` }}
                    />
                  </div>
                  <span className={cn("text-xs w-24 text-right", isDark ? "text-white" : "text-black")}>
                    {formatCurrency(proj.projectedBalance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account Grid */}
        <div
          className={cn(
            "grid gap-4",
            isFullscreen
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1"
          )}
        >
          <AnimatePresence mode="popLayout">
            {accounts.map((account) => {
              // Map from new AccountOverviewContent format to widget Account interface
              const mappedAccount: Account = {
                account_id: account.id,
                name: account.name,
                type: account.type,
                subtype: account.subtype,
                mask: null,
                balances: {
                  current: account.balance,
                  available: account.available,
                  iso_currency_code: account.currencyCode
                }
              };
              return (
                <AccountCard
                  key={account.id}
                  account={mappedAccount}
                  isExpanded={uiState.expandedAccountIds.includes(account.id)}
                  onToggle={() => toggleAccountExpanded(account.id)}
                  isDark={isDark}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
