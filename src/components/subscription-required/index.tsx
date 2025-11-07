"use client";

import React from "react";
import { useWidgetProps } from "@/app/hooks/use-widget-props";

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$9.99',
    interval: 'month',
    features: ['Up to 3 bank accounts', 'Transaction history', 'Spending insights', 'Email support']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19.99',
    interval: 'month',
    popular: true,
    trial: '14-day free trial',
    features: ['Up to 10 bank accounts', 'All Basic features', 'Account health monitoring', 'Advanced analytics', 'Priority support']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$49.99',
    interval: 'month',
    features: ['Unlimited bank accounts', 'All Pro features', 'Custom reporting', 'API access', 'Dedicated support']
  }
];

export default function SubscriptionRequired() {
  const toolOutput = useWidgetProps();
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const featureName = toolOutput?.featureName || 'this feature';

  const handleSelectPlan = (planId: string) => {
    if (isLoading) return;
    setSelectedPlan(planId);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.openai.callTool('create_checkout_session', {
        plan: selectedPlan
      });

      const parsedResult = JSON.parse(result.result);

      if (parsedResult.error) {
        throw new Error(parsedResult.error || 'Failed to create checkout session');
      }

      const checkoutUrl = parsedResult.checkoutUrl;

      if (checkoutUrl) {
        window.openai.openExternal({ href: checkoutUrl });
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: unknown) {
      console.error('Subscription error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/30 text-white shadow-xl">
      <div>
        <div className="flex items-start mb-4">
          <svg className="w-6 h-6 text-blue-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-1">Choose Your Plan</h2>
            <p className="text-sm text-gray-300">Upgrade to access {String(featureName)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-2 mb-3">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`plan-card ${plan.popular ? 'border-blue-400' : 'border-gray-600'} border rounded-lg p-3 cursor-pointer relative ${selectedPlan === plan.id ? 'selected' : ''}`}
              onClick={() => handleSelectPlan(plan.id)}
            >
              {plan.popular && <div className="absolute -top-2 right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Popular</div>}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-base">{plan.name}</h3>
                  {plan.trial && <p className="text-xs text-blue-400">{plan.trial}</p>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{plan.price}</div>
                  <div className="text-xs text-gray-400">/{plan.interval}</div>
                </div>
              </div>
              <ul className="space-y-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center text-xs text-gray-300">
                    <svg className="w-3 h-3 text-green-400 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          id="subscribe-btn"
          disabled={!selectedPlan || isLoading}
          onClick={handleSubscribe}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (selectedPlan ? `Subscribe to ${PLANS.find(p => p.id === selectedPlan)?.name}` : 'Select a plan to continue')}
        </button>

        <p className="text-xs text-gray-500 text-center mt-2">
          Secure checkout powered by Stripe
        </p>
      </div>
    </div>
  );
}
