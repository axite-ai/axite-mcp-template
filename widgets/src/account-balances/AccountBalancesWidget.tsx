import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, DollarSign } from 'lucide-react';
import { useWidgetProps } from '../shared/use-widget-props';

interface Account {
  account_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype: string;
  balances: {
    available?: number | null;
    current?: number | null;
    limit?: number | null;
  };
}

interface AccountBalancesData {
  accounts: Account[];
  totalBalance: number;
  lastUpdated: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getAccountIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'credit':
      return <DollarSign className="w-5 h-5" />;
    case 'depository':
      return <Wallet className="w-5 h-5" />;
    case 'investment':
      return <TrendingUp className="w-5 h-5" />;
    default:
      return <Wallet className="w-5 h-5" />;
  }
}

function AccountCard({ account, index }: { account: Account; index: number }) {
  const balance = account.balances.current ?? account.balances.available;
  const isCredit = account.type.toLowerCase() === 'credit';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-xl p-5 border border-gray-200 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            {getAccountIcon(account.type)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {account.name || account.official_name || 'Account'}
            </h3>
            <p className="text-sm text-gray-500 capitalize">
              {account.subtype.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <span className="text-sm text-gray-600">
            {isCredit ? 'Balance' : 'Current Balance'}
          </span>
          <span className="text-2xl font-bold text-gray-900">
            {formatCurrency(balance)}
          </span>
        </div>

        {account.balances.available !== null &&
          account.balances.available !== balance && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Available</span>
              <span className="text-gray-700 font-medium">
                {formatCurrency(account.balances.available)}
              </span>
            </div>
          )}

        {isCredit && account.balances.limit && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Credit Limit</span>
            <span className="text-gray-700 font-medium">
              {formatCurrency(account.balances.limit)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function AccountBalancesWidget() {
  const data = useWidgetProps<AccountBalancesData>({
    accounts: [],
    totalBalance: 0,
    lastUpdated: new Date().toISOString(),
  });

  const { accounts, totalBalance } = data;

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Account Balances
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Total Balance</span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(totalBalance)}
              </span>
            </div>
            <span className="text-sm text-gray-400">•</span>
            <span className="text-sm text-gray-500">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Account Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account, index) => (
            <AccountCard
              key={account.account_id}
              account={account}
              index={index}
            />
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No accounts found</p>
          </div>
        )}
      </div>
    </div>
  );
}
