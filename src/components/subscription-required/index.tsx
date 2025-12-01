"use client";

import React, { useState } from "react";
import {
  Lock,
  Check,
  Sparkle,
} from "@openai/apps-sdk-ui/components/Icon";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Alert } from "@openai/apps-sdk-ui/components/Alert";
import { RadioGroup } from "@openai/apps-sdk-ui/components/RadioGroup";
import { AnimateLayout } from "@openai/apps-sdk-ui/components/Transition";
import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import { useDisplayMode } from "@/src/use-display-mode";
import { useMaxHeight } from "@/src/use-max-height";
import { upgradeSubscription } from "@/app/widgets/subscription-required/actions";
import { cn } from "@/lib/utils/cn";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: "$9.99",
    interval: "month",
    features: [
      "Up to 3 financial accounts",
      "Transaction history",
      "Spending insights",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    interval: "month",
    popular: true,
    trial: "14-day free trial",
    features: [
      "Up to 10 financial accounts",
      "All Basic features",
      "Account health monitoring",
      "Advanced analytics",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$49.99",
    interval: "month",
    features: [
      "Unlimited financial accounts",
      "All Pro features",
      "Custom reporting",
      "API access",
      "Dedicated support",
    ],
  },
];

interface SubscriptionRequiredProps extends Record<string, unknown> {
  featureName?: string;
  error_message?: string;
  pricingUrl?: string;
}

interface SubscriptionRequiredMetadata {
  userId?: string;
}

export default function SubscriptionRequired() {
  const toolOutput = useWidgetProps<SubscriptionRequiredProps>();
  const toolMetadata = useOpenAiGlobal("toolResponseMetadata") as SubscriptionRequiredMetadata | null;
  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isFullscreen = displayMode === "fullscreen";

  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    console.log("[SubscriptionRequired] Plan selection changed:", selectedPlan);
  }, [selectedPlan]);

  const featureName = toolOutput?.featureName || "this feature";
  const userId = toolMetadata?.userId;

  const handleSubscribe = async () => {
    if (!selectedPlan || isLoading) return;

    if (!userId) {
      setError("Authentication error. Please refresh and try again.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await upgradeSubscription(userId, selectedPlan);

      if (!result.success) {
        throw new Error(result.error || "Failed to create checkout session");
      }

      if (!result.checkoutUrl) {
        throw new Error("No checkout URL returned from server");
      }

      // Redirect to Stripe (button stays disabled)
      if (typeof window !== "undefined" && window.openai?.openExternal) {
        window.openai.openExternal({ href: result.checkoutUrl });
      } else {
        window.location.href = result.checkoutUrl;
      }

      // Note: Button stays disabled after redirect. User will close the Stripe page
      // and retry their original request in ChatGPT, which will now work.
    } catch (error: unknown) {
      console.error("Subscription error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to start subscription. Please try again."
      );
      setIsLoading(false);
    }
  };

  const selectedPlanDetails = PLANS.find((p) => p.id === selectedPlan);

  return (
    <div
      className={cn(
        "antialiased w-full bg-surface text-default flex flex-col",
        !isFullscreen && "overflow-hidden"
      )}
      style={{
        maxHeight: maxHeight ?? undefined,
        height: isFullscreen ? "100%" : 400,
        minHeight: isFullscreen ? "100vh" : 400,
      }}
    >
      <div
        className={cn(
          "w-full h-full mx-auto flex-1 flex flex-col overflow-y-auto",
          isFullscreen ? "p-6 md:p-8 max-w-3xl" : "p-6 max-w-md"
        )}
      >
        {/* Header Section */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-info-surface text-info border border-info-surface">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Subscription Required
            </span>
          </div>
          <h1 className="heading-xl mb-3">Unlock {featureName}</h1>
          <p className="text-secondary text-md max-w-lg mx-auto">
            Choose the plan that fits your financial journey. Upgrade anytime to
            access advanced features and higher limits.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 w-full">
            <Alert variant="soft" color="danger" description={error} />
          </div>
        )}

        {/* Plan Selection - Radio Group */}
        {isFullscreen && (
          <RadioGroup
            value={selectedPlan}
            onChange={setSelectedPlan}
            className="flex flex-col gap-4 mb-8 w-full"
            aria-label="Select a subscription plan"
          >
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <RadioGroup.Item
                  key={plan.id}
                  value={plan.id}
                  className={cn(
                    "group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-xl border transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isSelected
                      ? "border-primary bg-surface-secondary shadow-sm"
                      : "border-default bg-surface hover:border-subtle hover:bg-surface-secondary"
                  )}
                >
                  {/* Custom Radio Indicator */}
                  <div className="mt-1 sm:mt-0 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-default group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary transition-colors">
                    <div className="h-2 w-2 rounded-full bg-surface opacity-0 group-data-[state=checked]:opacity-100 transition-opacity" />
                  </div>

                  {/* Card Content */}
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        {plan.popular && (
                          <Badge
                            color="discovery"
                            size="sm"
                            pill
                            className="gap-1 shadow-sm"
                          >
                            <Sparkle className="h-3 w-3" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      <div className="text-left sm:text-right flex items-baseline gap-1">
                        <span className="text-xl font-bold">{plan.price}</span>
                        <span className="text-secondary text-sm">
                          /{plan.interval}
                        </span>
                      </div>
                    </div>

                    {plan.trial && (
                      <div className="mb-3">
                        <span className="text-xs font-medium text-info bg-info-surface px-2 py-0.5 rounded-full border border-info-surface">
                          {plan.trial}
                        </span>
                      </div>
                    )}

                    <AnimateLayout>
                      {isSelected && (
                        <div
                          key="features"
                          className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 pt-3 border-t border-subtle/50"
                        >
                          {plan.features.map((feature, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm text-secondary"
                            >
                              <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                              <span className="leading-tight">{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </AnimateLayout>

                    {/* Summary for unselected items (mobile/compact view mainly) */}
                    {!isSelected && (
                      <p className="text-sm text-tertiary mt-1 line-clamp-1">
                        {plan.features.slice(0, 3).join(" • ")}...
                      </p>
                    )}
                  </div>
                </RadioGroup.Item>
              );
            })}
          </RadioGroup>
        )}

        {/* Sticky Footer Action */}
        <div
          className={cn(
            "mt-auto pt-6 w-full",
            isFullscreen && "border-t border-subtle"
          )}
        >
          <Button
            size="xl"
            variant="solid"
            color="primary"
            block
            onClick={handleSubscribe}
            loading={isLoading}
            disabled={!selectedPlan || isLoading}
            className="mb-4 font-semibold shadow-sm"
          >
            {isLoading
              ? "Processing..."
              : selectedPlanDetails?.trial
              ? `Start ${selectedPlanDetails.trial}`
              : `Subscribe to ${selectedPlanDetails?.name || "Plan"}`}
          </Button>

          <p className="text-center text-xs text-tertiary">
            Secure payment via Stripe. You can cancel anytime from your account
            settings.
          </p>
        </div>
      </div>
    </div>
  );
}
