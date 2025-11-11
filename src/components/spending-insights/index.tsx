"use client";

import React from "react";
import { useWidgetProps } from "@/app/hooks/use-widget-props";
import PlaidConnectionPrompt from "@/src/components/plaid-connection-prompt";

interface Category {
  name: string;
  amount: number;
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(Math.abs(amount));
}

export default function SpendingInsights() {
  const toolOutput = useWidgetProps();

  // Check if bank connection is required
  if (toolOutput?.message === 'Bank connection required') {
    return <PlaidConnectionPrompt />;
  }

  if (!toolOutput || !toolOutput.categories) {
    return <p>No spending data available</p>;
  }

  const categories = toolOutput.categories || [];

  return (
    <div className="insights">
      {Array.isArray(categories) && categories.map((cat: Category) => (
        <div key={cat.name} className="category">
          <div className="category-name">{cat.name}</div>
          <div className="category-amount">{formatCurrency(cat.amount)}</div>
        </div>
      ))}
    </div>
  );
}
