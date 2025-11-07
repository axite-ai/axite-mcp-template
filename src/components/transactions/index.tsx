"use client";

import React from "react";
import { useWidgetProps } from "@/app/hooks/use-widget-props";

interface Transaction {
  transaction_id: string;
  name: string | null;
  date: string;
  amount: number;
  iso_currency_code: string;
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(Math.abs(amount));
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export default function Transactions() {
  const toolOutput = useWidgetProps();

  if (!toolOutput || !toolOutput.transactions) {
    return <p>No transactions available</p>;
  }

  const transactions = toolOutput.transactions || [];

  return (
    <div className="transaction-list">
      {Array.isArray(transactions) && transactions.map((tx: Transaction) => (
        <div key={tx.transaction_id} className="transaction">
          <div className="transaction-info">
            <div className="transaction-name">{tx.name || 'Unknown'}</div>
            <div className="transaction-date">{formatDate(tx.date)}</div>
          </div>
          <div className={`transaction-amount ${tx.amount < 0 ? 'amount-negative' : 'amount-positive'}`}>
            {tx.amount < 0 ? '-' : '+'}{formatCurrency(tx.amount, tx.iso_currency_code)}
          </div>
        </div>
      ))}
    </div>
  );
}
