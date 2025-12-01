"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import type { RecurringPaymentsContent } from "@/lib/types/tool-responses";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import { WidgetLoadingSkeleton } from "@/src/components/shared/widget-loading-skeleton";
import { useState } from "react";
import { EmptyMessage } from "@openai/apps-sdk-ui/components/EmptyMessage";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Select } from "@openai/apps-sdk-ui/components/Select";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { AnimateLayout } from "@openai/apps-sdk-ui/components/Transition";
import { cn } from "@/lib/utils/cn";
import { useDisplayMode } from "@/src/use-display-mode";
import { useMaxHeight } from "@/src/use-max-height";
import { formatCurrency } from "@/src/utils/format";
import { Expand } from "@openai/apps-sdk-ui/components/Icon";

interface RecurringPayment {
  streamId: string;
  merchant: string;
  amount: number;
  frequency: string;
  lastDate: string;
  nextDate: string | null;
  isActive: boolean;
  confidence: number;
}

interface ToolOutput extends RecurringPaymentsContent, Record<string, unknown> {}

export default function RecurringPaymentsWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();
  const toolMetadata = useOpenAiGlobal("toolResponseMetadata") as any;

  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"amount" | "date" | "merchant">("amount");

  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isFullscreen = displayMode === "fullscreen";

  // Show loading skeleton during initial load
  if (!toolOutput) {
    return <WidgetLoadingSkeleton />;
  }

  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  // Show empty state only if there's truly no data
  if (typeof toolOutput.monthlyTotal !== 'number') {
    return (
      <EmptyMessage>
        <EmptyMessage.Title>No recurring payments data available</EmptyMessage.Title>
      </EmptyMessage>
    );
  }

  const { monthlyTotal, subscriptionCount, upcomingPayments, highestSubscription } = toolOutput;
  const allStreams = (toolMetadata?.allStreams ?? upcomingPayments) as any[];

  // For now, show all streams (filtering by active/inactive not available in data)
  const filteredStreams = allStreams;

  // Sort streams
  const sortedStreams = [...filteredStreams].sort((a: any, b: any) => {
    if (sortBy === "amount") return b.amount - a.amount;
    if (sortBy === "date") return new Date(b.nextDate).getTime() - new Date(a.nextDate).getTime();
    return a.name.localeCompare(b.name);
  });

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
      {/* Fullscreen expand button */}
      {!isFullscreen && (
        <Button
          onClick={() => {
            if (typeof window !== "undefined" && window.openai) {
              window.openai.requestDisplayMode({ mode: "fullscreen" });
            }
          }}
          variant="ghost"
          color="secondary"
          size="sm"
          className="absolute top-4 right-4 z-20"
          aria-label="Expand to fullscreen"
        >
          <Expand className="h-4 w-4" />
        </Button>
      )}

      {/* Content */}
      <div className={cn("w-full h-full overflow-y-auto", isFullscreen ? "p-8" : "p-0")}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="heading-lg mb-2">Recurring Payments</h1>
          <p className="text-sm text-secondary">
            {subscriptionCount} subscriptions • {formatCurrency(monthlyTotal)}/month
          </p>
        </div>

        {/* Summary Cards - Only shown in fullscreen for detailed view */}
        {isFullscreen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface rounded-lg border border-subtle p-4">
              <div className="text-sm text-secondary mb-1">Active Subscriptions</div>
              <div className="text-2xl font-bold text-success">{subscriptionCount}</div>
              <div className="text-xs text-tertiary mt-1">
                {formatCurrency(monthlyTotal / subscriptionCount || 0)} avg/month
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-subtle p-4">
              <div className="text-sm text-secondary mb-1">Monthly Total</div>
              <div className="text-2xl font-bold text-info">{formatCurrency(monthlyTotal)}</div>
              <div className="text-xs text-tertiary mt-1">
                {formatCurrency(monthlyTotal * 12)}/year projected
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-subtle p-4">
              <div className="text-sm text-secondary mb-1">Highest Subscription</div>
              <div className="text-2xl font-bold text-discovery">
                {formatCurrency(highestSubscription?.amount ?? 0)}
              </div>
              <div className="text-xs text-tertiary mt-1 truncate">{highestSubscription?.name ?? 'N/A'}</div>
            </div>
          </div>
        )}

        {/* Filters - Only shown in fullscreen */}
        {isFullscreen && (
          <div className="flex gap-4 items-center mb-4">
            <div className="w-40">
              <Select
                value={filterStatus}
                onChange={(val: any) => setFilterStatus(val.value)}
                options={[
                  { value: "all", label: "All Payments" },
                  { value: "active", label: "Active Only" },
                  { value: "inactive", label: "Inactive Only" }
                ]}
                size="sm"
              />
            </div>

            <div className="w-40">
              <Select
                value={sortBy}
                onChange={(val: any) => setSortBy(val.value)}
                options={[
                  { value: "amount", label: "Sort by Amount" },
                  { value: "date", label: "Sort by Date" },
                  { value: "merchant", label: "Sort by Merchant" }
                ]}
                size="sm"
              />
            </div>
          </div>
        )}

        {/* Streams List */}
        <div className={cn("overflow-hidden", !isFullscreen && "rounded-xl border border-subtle")}>
          {(isFullscreen ? sortedStreams : sortedStreams.slice(0, 5)).map((stream: any, idx: number) => (
            <div
              key={stream.streamId || idx}
              className={cn(
                "p-3 hover:bg-surface-secondary/50 transition-colors flex items-center justify-between gap-4",
                idx !== 0 && "border-t border-subtle"
              )}
            >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-medium text-sm text-default truncate">{stream.name}</h3>
                    {stream.confidence && stream.confidence !== "high" && (
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                        stream.confidence === "medium" ? "bg-warning-soft text-warning" : "bg-surface-tertiary text-secondary"
                      )}>
                        {stream.confidence}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-secondary flex items-center gap-1.5">
                    <span className="capitalize">{stream.frequency}</span>
                    <span>•</span>
                    <span>Next: {new Date(stream.nextDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-default">
                    {formatCurrency(stream.amount)}
                  </div>
                </div>
            </div>
          ))}
        </div>

        {sortedStreams.length === 0 && (
          <EmptyMessage>
            <EmptyMessage.Title>No recurring payments found</EmptyMessage.Title>
            <EmptyMessage.Description>No payments match the current filters</EmptyMessage.Description>
          </EmptyMessage>
        )}
      </div>
    </div>
  );
}
