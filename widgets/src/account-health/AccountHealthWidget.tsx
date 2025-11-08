import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useWidgetProps } from '../shared/use-widget-props';

interface AccountHealth {
  account_id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  balance: number;
  warnings: string[];
}

interface AccountHealthData {
  accounts: AccountHealth[];
  overallStatus: 'healthy' | 'attention_needed';
  summary: {
    totalAccounts: number;
    accountsWithWarnings: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    case 'critical':
      return <XCircle className="w-5 h-5 text-red-600" />;
    default:
      return <CheckCircle className="w-5 h-5 text-gray-400" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'bg-green-50 border-green-200';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200';
    case 'critical':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

function AccountHealthCard({
  account,
  index,
}: {
  account: AccountHealth;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`rounded-xl p-5 border ${getStatusColor(account.status)}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <Wallet className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{account.name}</h3>
            <p className="text-sm text-gray-600">
              {formatCurrency(account.balance)}
            </p>
          </div>
        </div>
        {getStatusIcon(account.status)}
      </div>

      {account.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Warnings:</h4>
          <ul className="space-y-1">
            {account.warnings.map((warning, idx) => (
              <li
                key={idx}
                className="text-sm text-gray-600 flex items-start gap-2"
              >
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {account.warnings.length === 0 && (
        <div className="text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>All checks passed</span>
        </div>
      )}
    </motion.div>
  );
}

export function AccountHealthWidget() {
  const data = useWidgetProps<AccountHealthData>({
    accounts: [],
    overallStatus: 'healthy',
    summary: {
      totalAccounts: 0,
      accountsWithWarnings: 0,
    },
  });

  const { accounts, overallStatus, summary } = data;

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8" />
            Account Health
          </h1>
          <div className="flex items-center gap-4">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                overallStatus === 'healthy'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {overallStatus === 'healthy' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  All Systems Healthy
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Attention Needed
                </>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {summary.totalAccounts} account
              {summary.totalAccounts !== 1 ? 's' : ''} checked
            </span>
            {summary.accountsWithWarnings > 0 && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-yellow-700">
                  {summary.accountsWithWarnings} with warnings
                </span>
              </>
            )}
          </div>
        </div>

        {/* Account Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account, index) => (
            <AccountHealthCard
              key={account.account_id}
              account={account}
              index={index}
            />
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No account health data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
