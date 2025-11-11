"use client";

import React from "react";
import { usePlaidLink } from "react-plaid-link";
import { useWidgetProps } from "@/app/hooks/use-widget-props";

import { createPlaidLinkToken, exchangePlaidPublicToken } from "@/app/widgets/plaid-required/actions";

interface WidgetProps extends Record<string, unknown> {
  baseUrl?: string;
  userId?: string;
  message?: string;
}

export default function PlaidRequired() {
  const props = useWidgetProps<WidgetProps>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [linkToken, setLinkToken] = React.useState<string | null>(null);
  const [plaidSdkError, setPlaidSdkError] = React.useState<string | null>(null);
  const [debugLogs, setDebugLogs] = React.useState<string[]>([]);

  // Helper to add debug logs
  const addLog = React.useCallback((message: string) => {
    console.log(`[PlaidRequired Widget] ${message}`);
    setDebugLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  }, []);

  // Detect CSP and sandbox restrictions
  React.useEffect(() => {
    addLog('Widget initialized in ChatGPT iframe');
    addLog(`Props received: ${JSON.stringify(props)}`);

    // Check if we're in an iframe
    if (window.self !== window.top) {
      addLog('Running inside iframe (expected in ChatGPT)');
    }

    // Check for CSP violations
    const cspHandler = (e: SecurityPolicyViolationEvent) => {
      addLog(`CSP VIOLATION: ${e.violatedDirective} - ${e.blockedURI}`);
      if (e.blockedURI.includes('plaid.com')) {
        setPlaidSdkError(`Plaid SDK blocked by CSP: ${e.violatedDirective}`);
      }
    };

    document.addEventListener('securitypolicyviolation', cspHandler as EventListener);

    // Monitor global errors
    const errorHandler = (e: ErrorEvent) => {
      addLog(`Global error: ${e.message} at ${e.filename}:${e.lineno}`);
      if (e.message.includes('plaid') || e.filename?.includes('plaid')) {
        setPlaidSdkError(`Plaid SDK error: ${e.message}`);
      }
    };

    window.addEventListener('error', errorHandler);

    return () => {
      document.removeEventListener('securitypolicyviolation', cspHandler as EventListener);
      window.removeEventListener('error', errorHandler);
    };
  }, [props, addLog]);

  const { open, ready, error: plaidHookError } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      addLog(`Plaid onSuccess callback - Institution: ${metadata.institution?.name}`);
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
        addLog(`Successfully connected bank: ${metadata.institution?.name}`);
        setSuccess(`Successfully connected ${metadata.institution?.name}! You can now use all financial features.`);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to complete connection';
        addLog(`Exchange token failed: ${errorMsg}`);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    onExit: (err) => {
      if (err) {
        addLog(`Plaid onExit with error: ${JSON.stringify(err)}`);
        setError('Connection cancelled or failed. Please try again.');
      } else {
        addLog('Plaid onExit - user cancelled');
      }
    },
  });

  // Monitor for Plaid SDK loading errors
  React.useEffect(() => {
    if (plaidHookError) {
      const errorMsg = plaidHookError instanceof Error ? plaidHookError.message : 'Unknown SDK error';
      addLog(`Plaid SDK hook error: ${errorMsg}`);
      setPlaidSdkError(`Plaid SDK failed to load: ${errorMsg}`);
    }
  }, [plaidHookError, addLog]);

  const handleConnect = async () => {
    if (isLoading) return;

    addLog('Connect button clicked');

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      addLog('Creating Plaid link token via server action (uses MCP session)...');
      const result = await createPlaidLinkToken();
      if (!result.success || !result.linkToken) {
        throw new Error(result.error || "Failed to create link token");
      }
      addLog(`Link token created successfully: ${result.linkToken.substring(0, 20)}...`);
      setLinkToken(result.linkToken);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize connection';
      addLog(`Link token creation failed: ${errorMsg}`);
      setError(errorMsg + '. Try the fallback link below.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (linkToken && ready) {
      addLog('Plaid Link ready, opening modal...');
      try {
        open();
        addLog('Plaid Link opened successfully');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        addLog(`Failed to open Plaid Link: ${errorMsg}`);
        setPlaidSdkError(`Failed to open Plaid: ${errorMsg}`);
      }
    } else if (linkToken && !ready) {
      addLog('Link token exists but Plaid SDK not ready yet...');
    }
  }, [linkToken, ready, open, addLog]);

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

        {/* Plaid SDK Error Warning */}
        {plaidSdkError && (
          <div className="mb-3 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-200 text-xs">
            <div className="font-semibold mb-1">⚠️ Plaid SDK Loading Issue</div>
            <div className="mb-2">{plaidSdkError}</div>
            <div className="text-yellow-300/80">This may be due to ChatGPT sandbox restrictions. Use the fallback link below instead.</div>
          </div>
        )}

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

        {/* Debug Logs Section */}
        {debugLogs.length > 0 && (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
              Debug Logs ({debugLogs.length})
            </summary>
            <div className="mt-2 p-2 bg-black/30 rounded border border-gray-700 max-h-40 overflow-y-auto">
              {debugLogs.map((log, i) => (
                <div key={i} className="font-mono text-gray-400 text-[10px] mb-1">
                  {log}
                </div>
              ))}
            </div>
          </details>
        )}

        <p className="text-xs text-gray-500 text-center mt-2">
          Powered by Plaid
        </p>
      </div>
    </div>
  );
}
