import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Coffee,
  Car,
  Home,
  Heart,
  Utensils,
  TrendingDown,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import { useWidgetProps } from '../shared/use-widget-props';

interface Transaction {
  transaction_id: string;
  name: string;
  amount: number;
  date: string;
  category: string[];
  merchant_name?: string;
  pending: boolean;
}

interface TransactionsData {
  transactions: Transaction[];
  totalTransactions: number;
  dateRange: {
    start: string;
    end: string;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(amount));
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function getCategoryIcon(category: string[]) {
  const cat = category[0]?.toLowerCase() || '';

  if (cat.includes('food') || cat.includes('restaurant'))
    return <Utensils className="w-5 h-5" />;
  if (cat.includes('shop') || cat.includes('retail'))
    return <ShoppingCart className="w-5 h-5" />;
  if (cat.includes('coffee') || cat.includes('cafe'))
    return <Coffee className="w-5 h-5" />;
  if (cat.includes('transportation') || cat.includes('auto'))
    return <Car className="w-5 h-5" />;
  if (cat.includes('home') || cat.includes('rent'))
    return <Home className="w-5 h-5" />;
  if (cat.includes('health') || cat.includes('medical'))
    return <Heart className="w-5 h-5" />;

  return <Receipt className="w-5 h-5" />;
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDebit = transaction.amount > 0;

  return (
    <motion.div
      layout
      onClick={() => setIsExpanded(!isExpanded)}
      className="bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <div className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isDebit ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
        }`}>
          {getCategoryIcon(transaction.category)}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">
            {transaction.merchant_name || transaction.name}
          </h4>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{formatDate(transaction.date)}</span>
            {transaction.category[0] && (
              <>
                <span>•</span>
                <span className="capitalize">
                  {transaction.category[0].replace('_', ' ')}
                </span>
              </>
            )}
            {transaction.pending && (
              <>
                <span>•</span>
                <span className="text-yellow-600 font-medium">Pending</span>
              </>
            )}
          </div>
        </div>

        <div className={`text-right ${
          isDebit ? 'text-red-600' : 'text-green-600'
        }`}>
          <div className="font-semibold flex items-center gap-1">
            {isDebit ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )}
            {formatCurrency(transaction.amount)}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 bg-gray-50 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Transaction ID</span>
                <span className="text-gray-900 font-mono text-xs">
                  {transaction.transaction_id.slice(0, 16)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Full Name</span>
                <span className="text-gray-900">{transaction.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Categories</span>
                <span className="text-gray-900">
                  {transaction.category.join(', ')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function TransactionsWidget() {
  const data = useWidgetProps<TransactionsData>({
    transactions: [],
    totalTransactions: 0,
    dateRange: {
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
  });

  const { transactions, dateRange } = data;

  // Group transactions by date
  const groupedTransactions = transactions.reduce((acc, transaction) => {
    const date = transaction.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const dates = Object.keys(groupedTransactions).sort((a, b) =>
    b.localeCompare(a)
  );

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6 sticky top-0 z-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Transactions
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>
              {new Date(dateRange.start).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span>—</span>
            <span>
              {new Date(dateRange.end).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="text-gray-400">•</span>
            <span>{transactions.length} transactions</span>
          </div>
        </div>

        {/* Transaction List */}
        <div>
          {dates.map((date) => (
            <div key={date}>
              <div className="px-6 py-3 bg-gray-100 sticky top-[104px] z-5">
                <h3 className="font-semibold text-gray-700">
                  {formatDate(date)}
                </h3>
              </div>
              {groupedTransactions[date].map((transaction) => (
                <TransactionRow
                  key={transaction.transaction_id}
                  transaction={transaction}
                />
              ))}
            </div>
          ))}
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
