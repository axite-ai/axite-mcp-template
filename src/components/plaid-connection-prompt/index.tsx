"use client";

import React from "react";
import { useWidgetProps } from "@/app/hooks/use-widget-props";

/**
 * PlaidConnectionPrompt - A reusable component for prompting bank connection
 * This is a simpler inline version that can be embedded in other widgets
 */
export default function PlaidConnectionPrompt() {
  const toolOutput = useWidgetProps();

  const handleConnect = () => {
    // Get the authenticated connect URL directly from the tool output
    // This URL already includes a one-time auth token
    const connectUrl: string = (toolOutput?.connectUrl as string | undefined) ||
                                (toolOutput?.baseUrl ? `${toolOutput.baseUrl}/connect-bank` : 'https://dev.askmymoney.ai/connect-bank');

    console.log('[Plaid Connect] Opening link:', connectUrl);

    // Open the authenticated link
    if (typeof window !== 'undefined' && window.openai) {
      window.openai.openExternal({ href: connectUrl });
    } else {
      window.location.href = connectUrl;
    }
  };

  return (
    <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/30 text-white shadow-xl">
      <div className="flex items-start mb-3">
        <svg className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <div className="flex-1">
          <h3 className="text-base font-bold mb-1">Connect Your Bank Account</h3>
          <p className="text-xs text-gray-300">Link your financial accounts to access this feature</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
        <ul className="space-y-2">
          <li className="flex items-start text-xs text-gray-300">
            <svg className="w-3 h-3 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Real-time account balances</span>
          </li>
          <li className="flex items-start text-xs text-gray-300">
            <svg className="w-3 h-3 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Transaction history & insights</span>
          </li>
          <li className="flex items-start text-xs text-gray-300">
            <svg className="w-3 h-3 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>AI-powered spending analysis</span>
          </li>
        </ul>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 mb-3">
        <div className="flex items-start">
          <svg className="w-3 h-3 text-blue-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-blue-200">
            Secured by Plaid. We never see your credentials.
          </p>
        </div>
      </div>

      <button
        onClick={handleConnect}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all shadow-lg text-sm"
      >
        Connect Bank Account
      </button>

      <p className="text-xs text-gray-500 text-center mt-2">
        Powered by Plaid
      </p>
    </div>
  );
}

