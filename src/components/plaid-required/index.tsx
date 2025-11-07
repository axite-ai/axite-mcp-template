"use client";

import React from "react";
import { usePlaidLink } from "react-plaid-link";
import { useWidgetProps } from "@/app/hooks/use-widget-props";

import { createPlaidLinkToken, exchangePlaidPublicToken } from "@/app/widgets/plaid-required/actions";

export default function PlaidRequired() {
  useWidgetProps(); // Required hook call for widget functionality
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [linkToken, setLinkToken] = React.useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setIsLoading(true);
      setSuccess(null);
      setError(null);
      try {
        const exchangeResult = await exchangePlaidPublicToken(
          public_token,
          metadata.institution || {}
        );
        if (!exchangeResult.success) {
          throw new Error(exchangeResult.error);
        }
        setSuccess(`Successfully connected ${metadata.institution?.name}! You can now use all financial features.`);
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : 'Failed to complete connection. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onExit: (err) => {
      if (err) {
        setError('Connection cancelled or failed. Please try again.');
      }
    },
  });

  const handleConnect = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createPlaidLinkToken();
      if (!result.success || !result.linkToken) {
        throw new Error(result.error || "Failed to create link token");
      }
      setLinkToken(result.linkToken);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to initialize connection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/30 text-white shadow-xl">
      <div>
        <div className="flex items-start mb-4">
          <svg className="w-6 h-6 text-green-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-1">Connect Your Bank Account</h2>
            <p className="text-sm text-gray-300">Link your financial accounts to access this feature</p>
          </div>
        </div>

        {error && <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-xs">{error}</div>}
        {success && <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 rounded text-green-300 text-xs">{success}</div>}

        <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold mb-3 text-sm">What You&apos;ll Get:</h3>
          <ul className="space-y-2">
            <li className="flex items-start text-xs text-gray-300">
              <svg className="w-4 h-4 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Real-time account balances</span>
            </li>
            <li className="flex items-start text-xs text-gray-300">
              <svg className="w-4 h-4 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Transaction history and insights</span>
            </li>
            <li className="flex items-start text-xs text-gray-300">
              <svg className="w-4 h-4 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>AI-powered spending analysis</span>
            </li>
            <li className="flex items-start text-xs text-gray-300">
              <svg className="w-4 h-4 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Account health monitoring</span>
            </li>
          </ul>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <svg className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-blue-200">
              Your data is encrypted and secured by Plaid, trusted by thousands of financial apps. We never see your login credentials.
            </p>
          </div>
        </div>

        <button
          id="connect-btn"
          onClick={handleConnect}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Initializing...
            </span>
          ) : 'Connect Bank Account'}
        </button>

        <p className="text-xs text-gray-500 text-center mt-2">
          Powered by Plaid
        </p>
      </div>
    </div>
  );
}
