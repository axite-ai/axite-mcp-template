"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import type { ExpenseCategorizationContent } from "@/lib/types/tool-responses";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import { useState } from "react";

interface ExpenseSuggestion {
  transaction_id: string;
  merchant: string;
  amount: number;
  date: string;
  plaidCategory?: string;
  plaidDetailed?: string;
  suggestedTaxCategory: string;
  confidence: number;
  needsReview: boolean;
}

interface ToolOutput extends Record<string, unknown> {
  structuredContent?: ExpenseCategorizationContent;
}

export default function ExpenseCategorizerWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();
  const toolMetadata = useOpenAiGlobal("toolResponseMetadata") as any;

  const [filterReview, setFilterReview] = useState<"all" | "needs_review" | "high_confidence">(
    "all"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No expense data available</p>
      </div>
    );
  }

  const { categorized, needsReview, taxCategories, totalAmount } = toolOutput.structuredContent;
  const allSuggestions = (toolMetadata?.allSuggestions ?? []) as ExpenseSuggestion[];
  const confidenceDistribution = toolMetadata?.confidenceDistribution as {
    high: number;
    medium: number;
    low: number;
  };

  // Filter suggestions
  const filteredSuggestions = allSuggestions.filter((s) => {
    if (filterReview === "needs_review" && !s.needsReview) return false;
    if (filterReview === "high_confidence" && s.confidence < 0.8) return false;
    if (selectedCategory !== "all" && s.suggestedTaxCategory !== selectedCategory) return false;
    return true;
  });

  const taxCategoryList = Object.keys(taxCategories);

  return (
    <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-white to-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Expense Categorizer</h1>
        <div className="text-sm text-gray-600">${totalAmount.toFixed(2)} total expenses</div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Auto-Categorized</div>
          <div className="text-2xl font-bold text-green-600">{categorized}</div>
          <div className="text-xs text-gray-500 mt-1">High confidence</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Needs Review</div>
          <div className="text-2xl font-bold text-yellow-600">{needsReview}</div>
          <div className="text-xs text-gray-500 mt-1">Manual check required</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Tax Categories</div>
          <div className="text-2xl font-bold text-blue-600">{taxCategoryList.length}</div>
          <div className="text-xs text-gray-500 mt-1">Distinct categories</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Expenses</div>
          <div className="text-2xl font-bold text-gray-800">{allSuggestions.length}</div>
          <div className="text-xs text-gray-500 mt-1">Transactions reviewed</div>
        </div>
      </div>

      {/* Confidence Distribution */}
      {confidenceDistribution && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Confidence Distribution</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-600">High (≥80%)</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${(confidenceDistribution.high / allSuggestions.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-gray-800">
                {confidenceDistribution.high}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-600">Medium (60-80%)</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-yellow-500"
                  style={{
                    width: `${(confidenceDistribution.medium / allSuggestions.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-gray-800">
                {confidenceDistribution.medium}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-600">Low (&lt;60%)</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{
                    width: `${(confidenceDistribution.low / allSuggestions.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-gray-800">
                {confidenceDistribution.low}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tax Category Breakdown */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Tax Category Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {taxCategoryList.map((category) => (
            <div
              key={category}
              className="border border-gray-200 rounded-lg p-3 hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() =>
                setSelectedCategory(selectedCategory === category ? "all" : category)
              }
            >
              <div className="text-sm font-medium text-gray-800">{category}</div>
              <div className="text-xl font-bold text-blue-600 mt-1">
                ${taxCategories[category].toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={filterReview}
          onChange={(e) => setFilterReview(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Suggestions</option>
          <option value="needs_review">Needs Review</option>
          <option value="high_confidence">High Confidence</option>
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Categories</option>
          {taxCategoryList.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <div className="text-sm text-gray-600">
          Showing {filteredSuggestions.length} of {allSuggestions.length} expenses
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-2">
        {filteredSuggestions.map((suggestion) => (
          <div
            key={suggestion.transaction_id}
            className={`bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow ${
              suggestion.needsReview ? "border-l-4 border-yellow-500" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">{suggestion.merchant}</h3>
                  {suggestion.needsReview && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      Review
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {new Date(suggestion.date).toLocaleDateString()}
                </div>
                {suggestion.plaidCategory && (
                  <div className="text-xs text-gray-500 mt-1">
                    Plaid: {suggestion.plaidCategory}
                    {suggestion.plaidDetailed && ` → ${suggestion.plaidDetailed}`}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-gray-800">
                  ${suggestion.amount.toFixed(2)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {suggestion.suggestedTaxCategory}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(suggestion.confidence * 100).toFixed(0)}% confidence
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredSuggestions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No expenses found with the current filters
        </div>
      )}
    </div>
  );
}
