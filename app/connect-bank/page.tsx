'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePlaidLink } from 'react-plaid-link';
import { createPlaidLinkToken, exchangePlaidPublicToken } from './actions';

interface PlaidLinkPageProps {
  linkToken: string | null;
  error: string | null;
  institutionName?: string;
}

export default function ConnectBankPage() {
  const searchParams = useSearchParams();
  const [pageData, setPageData] = useState<PlaidLinkPageProps>({
    linkToken: null,
    error: null,
  });
  const [isExchanging, setIsExchanging] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Initialize the page - fetch Plaid link token
    const initializePage = async () => {
      try {
        console.log('[Connect Bank] Fetching Plaid link token...');
        const linkTokenResult = await createPlaidLinkToken();

        if (!linkTokenResult.success) {
          // If authentication error, provide helpful message
          if (linkTokenResult.error.includes('Authentication required')) {
            throw new Error(
              'Please sign in first. Return to ChatGPT and authenticate.'
            );
          }
          throw new Error(linkTokenResult.error);
        }

        setPageData({ linkToken: linkTokenResult.linkToken, error: null });
      } catch (error) {
        setPageData({
          linkToken: null,
          error: error instanceof Error ? error.message : 'Failed to load'
        });
      }
    };

    initializePage();
  }, []);

  const { open, ready } = usePlaidLink({
    token: pageData.linkToken || '',
    onSuccess: async (public_token, metadata) => {
      console.log('Plaid Link success:', metadata);
      setIsExchanging(true);

      try {
        const result = await exchangePlaidPublicToken(public_token, metadata);

        if (!result.success) {
          throw new Error(result.error);
        }

        setIsSuccess(true);
        setPageData((prev) => ({
          ...prev,
          institutionName: result.institutionName || undefined,
        }));
      } catch (error) {
        setPageData((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to connect bank',
        }));
      } finally {
        setIsExchanging(false);
      }
    },
    onExit: (err, metadata) => {
      console.log('Plaid Link exit:', err, metadata);
      if (err != null) {
        setPageData((prev) => ({
          ...prev,
          error: err.display_message || err.error_message || 'Connection failed',
        }));
      }
    },
  });

  const handleConnect = () => {
    if (ready) {
      open();
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-green-500/30">
          <div className="text-center">
            <div className="mb-6">
              <svg
                className="w-20 h-20 text-green-400 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Bank Connected!
            </h1>
            <p className="text-gray-300 mb-6">
              {pageData.institutionName
                ? `${pageData.institutionName} has been securely connected to your account.`
                : 'Your bank account has been securely connected.'}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              You can now return to ChatGPT and ask about your account balances,
              transactions, and spending insights.
            </p>
            <a
              href="https://chatgpt.com"
              className="inline-block bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg"
            >
              Return to ChatGPT
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (pageData.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-red-500/30">
          <div className="text-center">
            <div className="mb-6">
              <svg
                className="w-20 h-20 text-red-400 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Unable to Connect
            </h1>
            <p className="text-red-300 mb-6">{pageData.error}</p>
            <a
              href="https://chatgpt.com"
              className="inline-block bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
            >
              Return to ChatGPT
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isExchanging) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-blue-500/30">
          <div className="text-center">
            <div className="mb-6">
              <svg
                className="animate-spin h-20 w-20 text-blue-400 mx-auto"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Connecting Your Bank...
            </h2>
            <p className="text-gray-400">Please wait while we securely connect your account.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-green-500/30">
        <div className="flex items-start mb-6">
          <svg
            className="w-8 h-8 text-green-400 mr-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Connect Your Bank Account
            </h1>
            <p className="text-gray-300 text-sm">
              Securely link your bank to access your financial data
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <p className="text-sm font-semibold text-white mb-3">
            Why connect your bank?
          </p>
          <ul className="space-y-2">
            {[
              'Real-time account balances and transactions',
              'Automated spending insights and analytics',
              'Bank-level security and encryption',
            ].map((benefit, i) => (
              <li key={i} className="flex items-center text-sm text-gray-300">
                <svg
                  className="w-4 h-4 text-green-400 mr-2 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={!ready}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ready ? 'Connect Bank Account' : 'Loading...'}
        </button>

        {/* Security notice */}
        <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-blue-300">
              Your credentials are encrypted and never stored. We use Plaid, a
              trusted financial data provider used by millions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
