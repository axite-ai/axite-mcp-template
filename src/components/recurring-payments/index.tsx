"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import type { RecurringPaymentsContent } from "@/lib/types/tool-responses";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import { useState } from "react";

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

interface ToolOutput extends Record<string, unknown> {
  structuredContent?: RecurringPaymentsContent;
}

export default function RecurringPaymentsWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();
  const toolMetadata = useOpenAiGlobal("toolResponseMetadata") as any;

  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"amount" | "date" | "merchant">("amount");

  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No recurring payments data available</p>
      </div>
    );
  }

  const { monthlyTotal, subscriptionCount, upcomingPayments, highestSubscription } = toolOutput.structuredContent;
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
    <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-white to-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Recurring Payments</h1>
        <div className="text-sm text-gray-600">
          {subscriptionCount} subscriptions • ${monthlyTotal.toFixed(2)}/month
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Active Subscriptions</div>
          <div className="text-2xl font-bold text-green-600">{subscriptionCount}</div>
          <div className="text-xs text-gray-500 mt-1">
            ${(monthlyTotal / subscriptionCount || 0).toFixed(2)} avg/month
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Monthly Total</div>
          <div className="text-2xl font-bold text-blue-600">${monthlyTotal.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">
            ${(monthlyTotal * 12).toFixed(2)}/year projected
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Highest Subscription</div>
          <div className="text-2xl font-bold text-purple-600">
            ${highestSubscription?.amount.toFixed(2) ?? '0.00'}
          </div>
          <div className="text-xs text-gray-500 mt-1">{highestSubscription?.name ?? 'N/A'}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Payments</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="amount">Sort by Amount</option>
          <option value="date">Sort by Date</option>
          <option value="merchant">Sort by Merchant</option>
        </select>
      </div>

      {/* Streams List */}
      <div className="space-y-3">
        {sortedStreams.map((stream: any, idx: number) => (
          <div
            key={idx}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">{stream.name}</h3>
                  {stream.confidence && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      stream.confidence === "high" ? "bg-green-100 text-green-700" :
                      stream.confidence === "medium" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {stream.confidence}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">{stream.frequency}</div>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-gray-800">
                  ${stream.amount.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">per payment</div>
              </div>
            </div>

            <div className="mt-3 text-sm">
              <span className="text-gray-600">Next payment:</span>{" "}
              <span className="text-gray-800">
                {new Date(stream.nextDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {sortedStreams.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No recurring payments found with the current filters
        </div>
      )}
    </div>
  );
}
