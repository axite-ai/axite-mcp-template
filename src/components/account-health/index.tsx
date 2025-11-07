"use client";

import React from "react";
import { useWidgetProps } from "@/app/hooks/use-widget-props";

interface HealthAccount {
  account_id: string;
  name: string;
  warnings: string[];
}

interface ToolOutput {
  accounts?: HealthAccount[];
  featureName?: string;
}

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

function InteractivePricing({ toolOutput }: { toolOutput: ToolOutput }) {
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const featureName = toolOutput?.featureName || 'account health check';

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
    <div className="subscription-prompt">
      <div className="header" style={{ marginBottom: '12px' }}>
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px 0' }}>Choose Your Plan</h3>
          <p className="subtitle" style={{ margin: 0 }}>Upgrade to access {featureName}</p>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px', color: '#fca5a5', fontSize: '12px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}
            data-plan={plan.id}
            style={{
              border: `1px solid ${selectedPlan === plan.id ? '#3b82f6' : (plan.popular ? '#60a5fa' : '#4b5563')}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '8px',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s',
              background: selectedPlan === plan.id ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)' : 'transparent'
            }}
            onClick={() => handleSelectPlan(plan.id)}
          >
            {plan.popular && <div style={{ position: 'absolute', top: '-8px', right: '8px', background: '#3b82f6', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '12px' }}>Popular</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{plan.name}</h4>
                {plan.trial && <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#60a5fa' }}>{plan.trial}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{plan.price}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>/{plan.interval}</div>
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {plan.features.map(feature => (
                <li key={feature} style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: '#d1d5db', marginBottom: '4px' }}>
                  <svg style={{ width: '12px', height: '12px', color: '#34d399', marginRight: '6px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button id="subscribe-btn" disabled={!selectedPlan || isLoading} onClick={handleSubscribe} style={{ width: '100%', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', color: 'white', border: 'none', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', opacity: !selectedPlan || isLoading ? 0.5 : 1 }}>
        {isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px', marginRight: '8px' }} viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (selectedPlan ? `Subscribe to ${PLANS.find(p => p.id === selectedPlan)?.name}` : 'Select a plan to continue')}
      </button>

      <p className="footer-text" style={{ marginTop: '8px' }}>Secure checkout powered by Stripe</p>
    </div>
  );
}

export default function AccountHealth() {
  const toolOutput = useWidgetProps();

  if (!toolOutput) {
    return <p>No health data available</p>;
  }

  if (toolOutput.error_message === 'Subscription required' || toolOutput.featureName) {
    return <InteractivePricing toolOutput={toolOutput} />;
  }

  if (!toolOutput.accounts) {
    return <p>No health data available</p>;
  }

  const statusClass = toolOutput.overallStatus === 'healthy' ? 'status-good' : 'status-warning';

  return (
    <div>
      <div className="health-summary">
        <div className={`status ${statusClass}`}>
          Overall Health: {(toolOutput.overallStatus || 'N/A').toString().toUpperCase()}
        </div>
      </div>
      {Array.isArray(toolOutput.accounts) && toolOutput.accounts.some((a: HealthAccount) => a.warnings.length > 0) ? (
        <div className="issues">
          {toolOutput.accounts.flatMap((a: HealthAccount) => a.warnings.map((w: string) => (
            <div key={`${a.account_id}-${w}`} className="issue">
              <div className="issue-title">{a.name}</div>
              <div>{w}</div>
            </div>
          )))}
        </div>
      ) : <p>No issues detected</p>}
    </div>
  );
}
