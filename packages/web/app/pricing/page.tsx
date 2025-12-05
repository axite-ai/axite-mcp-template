"use client";

import { useState, useEffect } from "react";

interface Subscription {
  stripeSubscriptionId?: string;
  plan?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
}

interface UpgradeRequestBody {
  plan: string;
  successUrl: string;
  cancelUrl: string;
  subscriptionId?: string;
}

// TEMPLATE: Customize these subscription plans for your application
// Define subscription plans based on your auth config
const PLANS = [
  {
    name: "Basic",
    planId: "basic",
    price: "$9.99",
    priceMonthly: 9.99,
    interval: "month",
    description: "Perfect for getting started",
    features: [
      "Core feature 1",
      "Core feature 2",
      "Core feature 3",
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
    trial: false,
  },
  {
    name: "Pro",
    planId: "pro",
    price: "$19.99",
    priceMonthly: 19.99,
    interval: "month",
    description: "Advanced features for power users",
    features: [
      "All Basic features",
      "Advanced feature 1",
      "Advanced feature 2",
      "Advanced feature 3",
      "14-day free trial",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
    trial: true,
  },
  {
    name: "Enterprise",
    planId: "enterprise",
    price: "$49.99",
    priceMonthly: 49.99,
    interval: "month",
    description: "Everything you need for your organization",
    features: [
      "All Pro features",
      "Custom reporting",
      "API access",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Get Started",
    popular: false,
    trial: false,
  },
] as const;

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Fetch current subscription status
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const response = await fetch("/api/auth/subscription/list", {
          credentials: "include",
        });

        if (response.status === 401) {
          // User is not authenticated
          setIsAuthenticated(false);
          setLoadingSubscription(false);
          return;
        }

        if (response.ok) {
          setIsAuthenticated(true);
          const data = await response.json();
          // data should be an array of subscriptions
          if (Array.isArray(data) && data.length > 0) {
            setCurrentSubscription(data[0]); // Get the first active subscription
          }
        }
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
      } finally {
        setLoadingSubscription(false);
      }
    }

    fetchSubscription();
  }, []);

  // Note: Auto-checkout removed - users from ChatGPT go directly to Stripe checkout
  // This page is now only for direct web visitors

  const handleSubscribe = async (planId: string) => {
    setIsLoading(planId);
    setError(null);

    try {
      // Get current origin for success/cancel URLs
      const baseUrl = window.location.origin;

      // Prepare request body
      const requestBody: UpgradeRequestBody = {
        plan: planId,
        successUrl: `${baseUrl}/pricing/success`,
        cancelUrl: `${baseUrl}/pricing`,
      };

      // If user has an existing subscription, include the subscription ID for upgrade
      if (currentSubscription?.stripeSubscriptionId) {
        requestBody.subscriptionId = currentSubscription.stripeSubscriptionId;
      }

      // Call Better Auth's subscription upgrade endpoint
      const response = await fetch("/api/auth/subscription/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important: include session cookie
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to create checkout session");
      }

      const data = await response.json();

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error("Subscription error:", err);
      setError(err instanceof Error ? err.message : "Failed to start subscription");
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get started and unlock powerful features with AI-powered insights
          </p>
        </div>

        {/* Authentication Required Message */}
        {!loadingSubscription && isAuthenticated === false && (
          <div className="mb-8 max-w-2xl mx-auto bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-6">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-yellow-400 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                  Sign In Required
                </h3>
                <p className="text-gray-300 mb-4">
                  To subscribe to a plan, please sign in to your account first.
                </p>
                <a
                  href="/login"
                  className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-2 px-6 rounded-lg transition-all"
                >
                  Sign In
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Current Subscription Status */}
        {!loadingSubscription && currentSubscription && (
          <div className="mb-8 max-w-2xl mx-auto bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 font-semibold">
                  Current Plan: {currentSubscription.plan ? currentSubscription.plan.charAt(0).toUpperCase() + currentSubscription.plan.slice(1) : 'Unknown'}
                </p>
                <p className="text-gray-400 text-sm">
                  Status: {currentSubscription.status === 'active' ? '✓ Active' : currentSubscription.status}
                  {currentSubscription.cancelAtPeriodEnd && ' (Cancels at period end)'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-8 max-w-2xl mx-auto bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {PLANS.map((plan) => (
            <div
              key={plan.planId}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-500"
                  : "bg-gray-800/50 border border-gray-700"
              } backdrop-blur-sm transition-transform hover:scale-105`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <div className="mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-400">/{plan.interval}</span>
                </div>
                {plan.trial && (
                  <p className="text-sm text-blue-400">14-day free trial included</p>
                )}
              </div>

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0"
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
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(plan.planId)}
                disabled={isAuthenticated === false || isLoading !== null || (currentSubscription?.plan === plan.planId && currentSubscription?.status === 'active')}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                  currentSubscription?.plan === plan.planId && currentSubscription?.status === 'active'
                    ? "bg-green-600 cursor-default"
                    : plan.popular
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    : "bg-gray-700 hover:bg-gray-600"
                } ${
                  isLoading === plan.planId || isAuthenticated === false
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isAuthenticated === false ? (
                  "Sign In to Subscribe"
                ) : currentSubscription?.plan === plan.planId && currentSubscription?.status === 'active' ? (
                  "Current Plan ✓"
                ) : isLoading === plan.planId ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2"
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
                    Processing...
                  </span>
                ) : (
                  plan.cta
                )}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="text-center text-gray-400 text-sm">
          <p className="mb-2">
            All plans include 256-bit encryption and secure data handling
          </p>
          <p>
            Have questions?{" "}
            <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com'}`} className="text-blue-400 hover:text-blue-300">
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
