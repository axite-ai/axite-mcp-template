"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import type { BusinessCashFlowContent } from "@/lib/types/tool-responses";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import { useState } from "react";

interface CashFlowProjection {
  month: number;
  monthLabel: string;
  projectedBalance: number;
  confidence: string;
}

interface ToolOutput extends Record<string, unknown> {
  structuredContent?: BusinessCashFlowContent;
}

export default function BusinessCashFlowWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();
  const toolMetadata = useOpenAiGlobal("toolResponseMetadata") as any;

  const [showDetails, setShowDetails] = useState(false);

  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No cash flow data available</p>
      </div>
    );
  }

  const { runway, currentPeriod, projections: contentProjections, healthStatus } = toolOutput.structuredContent;
  const projections = (toolMetadata?.projections ?? contentProjections ?? []) as CashFlowProjection[];

  const isHealthy = healthStatus === "positive";
  const runwayMonths = runway.months === Infinity ? "∞" : runway.months.toFixed(1);

  return (
    <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-white to-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Business Cash Flow</h1>
        <div className={`text-lg font-semibold ${isHealthy ? "text-green-600" : "text-red-600"}`}>
          {isHealthy ? "Positive" : "Negative"} Cash Flow
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Revenue</div>
          <div className="text-2xl font-bold text-green-600">
            +${currentPeriod.revenue.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Current period</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Expenses</div>
          <div className="text-2xl font-bold text-red-600">
            -${currentPeriod.expenses.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Current period</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Net Cash Flow</div>
          <div className={`text-2xl font-bold ${currentPeriod.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {currentPeriod.net >= 0 ? '+' : ''}${currentPeriod.net.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Current period</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Runway</div>
          <div className="text-2xl font-bold text-purple-600">{runwayMonths}</div>
          <div className="text-xs text-gray-500 mt-1">months remaining</div>
        </div>
      </div>

      {/* Burn Rate */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">Burn Rate</div>
            <div className="text-3xl font-bold text-gray-800">
              ${currentPeriod.burnRate.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Per month</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Runway Status</div>
            <div className={`text-xl font-semibold ${
              runway.confidence === "high" ? "text-green-600" :
              runway.confidence === "medium" ? "text-yellow-600" : "text-red-600"
            }`}>
              {runway.confidence}
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${isHealthy ? "bg-green-500" : "bg-red-500"}`}
            style={{
              width: `${Math.min(100, Math.abs((currentPeriod.net / currentPeriod.revenue) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Projections */}
      {projections && projections.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Cash Flow Projections</h2>
            <span className="text-xs text-gray-500">Based on current trends</span>
          </div>
          <div className="space-y-2">
            {projections.map((proj: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-600">{proj.period}</div>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${
                      proj.projectedNet > 0
                        ? "bg-green-500"
                        : proj.projectedNet > -1000
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.abs((proj.projectedNet / currentPeriod.revenue) * 100)
                      )}%`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-sm font-medium text-gray-800">
                    {proj.projectedNet >= 0 ? '+' : ''}${proj.projectedNet.toFixed(0)}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    proj.confidence === "high"
                      ? "bg-green-100 text-green-700"
                      : proj.confidence === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {proj.confidence}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
