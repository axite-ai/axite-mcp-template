"use client";

import React from "react";
import {
  CreditCard,
  Check,
  ShieldCheck,
  Trending,
  DollarCircle,
  BarChart,
} from "@openai/apps-sdk-ui/components/Icon";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { AnimateLayout } from "@openai/apps-sdk-ui/components/Transition";
import { useWidgetProps } from "@/src/use-widget-props";
import { useOpenAiGlobal } from "@/src/use-openai-global";
import { useWidgetState } from "@/src/use-widget-state";
import { cn } from "@/lib/utils/cn";
import { useDisplayMode } from "@/src/use-display-mode";
import { useMaxHeight } from "@/src/use-max-height";

interface WidgetProps extends Record<string, unknown> {
  baseUrl?: string;
  message?: string;
}

interface PlaidRequiredMetadata {
  userId?: string;
  mcpToken?: string;
}

interface PlaidRequiredUIState extends Record<string, unknown> {
  successMessage: string | null;
  errorMessage: string | null;
}

const features = [
  { icon: DollarCircle, text: "Real-time account balances" },
  { icon: BarChart, text: "Transaction history & insights" },
  { icon: Trending, text: "AI-powered spending analysis" },
  { icon: Check, text: "Account health monitoring" },
];

export default function PlaidRequired() {
  const toolOutput = useWidgetProps<WidgetProps>();
  const toolMetadata = useOpenAiGlobal(
    "toolResponseMetadata"
  ) as PlaidRequiredMetadata | null;
  const [uiState, setUiState] = useWidgetState<PlaidRequiredUIState>({
    successMessage: null,
    errorMessage: null,
  });

  const mcpToken = toolMetadata?.mcpToken;

  const handleConnect = () => {
    const baseUrl = toolOutput?.baseUrl || window.location.origin;
    console.log("[PlaidRequired Widget] Opening /connect-bank with MCP token");

    if (!mcpToken) {
      console.error("[PlaidRequired Widget] No MCP token in props");
      setUiState({
        successMessage: null,
        errorMessage: "Authentication token not available. Please try again.",
      });
      return;
    }

    const connectUrl = `${baseUrl}/connect-bank?token=${encodeURIComponent(
      mcpToken
    )}`;

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      connectUrl,
      "plaid-connect",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup || popup.closed) {
      console.error(
        "[PlaidRequired Widget] Popup blocked - please allow popups"
      );
      setUiState({
        successMessage: null,
        errorMessage: "Popup blocked. Please allow popups and try again.",
      });
    } else {
      console.log("[PlaidRequired Widget] Popup opened successfully");
    }
  };

  const displayMode = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";
  const maxHeight = useMaxHeight();

  return (
    <div
      className={cn(
        "antialiased w-full relative bg-transparent text-default flex flex-col items-center justify-center",
        !isFullscreen && "overflow-hidden"
      )}
      style={{
        maxHeight: maxHeight ?? undefined,
        height: isFullscreen ? maxHeight ?? undefined : 400,
        minHeight: isFullscreen ? undefined : 400,
      }}
    >
      <AnimateLayout>
        <div
          key="plaid-required-content"
          className={cn(
            "w-full max-w-md mx-auto text-center flex flex-col items-center",
            isFullscreen && "items-start text-left max-w-2xl"
          )}
        >
          {/* Header */}
          <div
            className={cn(
              "mb-6 flex flex-col items-center",
              isFullscreen && "flex-row items-start gap-6"
            )}
          >
            <div className="p-4 rounded-2xl flex items-center justify-center shrink-0 bg-success-soft mb-4">
              <CreditCard strokeWidth={1.5} className="h-8 w-8 text-success" />
            </div>
            <div className="flex-1">
              <h2 className="heading-xl mb-2 text-default">
                Connect Your Bank Account
              </h2>
              <p className="text-md text-secondary max-w-sm mx-auto">
                Link your financial accounts to access this feature
              </p>
            </div>
          </div>

          {/* Status Messages */}
          {uiState?.successMessage && (
            <div className="w-full mb-4 p-3 border rounded-xl text-sm bg-success-soft border-success-surface text-success">
              {uiState.successMessage}
            </div>
          )}
          {uiState?.errorMessage && (
            <div className="w-full mb-4 p-3 border rounded-xl text-sm bg-danger-soft border-danger-surface text-danger">
              {uiState.errorMessage}
            </div>
          )}

          {isFullscreen && (
            <div className="w-full space-y-6 mb-8">
              {/* Features List */}
              <div className="rounded-xl p-5 bg-surface-secondary border border-subtle">
                <h3 className="font-semibold mb-4 text-sm text-default">
                  What You'll Get:
                </h3>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center text-sm text-secondary"
                    >
                      <div className="p-1.5 rounded-lg mr-3 shrink-0 bg-success-soft">
                        <feature.icon
                          strokeWidth={1.5}
                          className="h-4 w-4 text-success"
                        />
                      </div>
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Notice */}
              <div className="border rounded-xl p-4 bg-info-soft border-info-surface">
                <div className="flex items-start">
                  <ShieldCheck
                    strokeWidth={1.5}
                    className="h-4 w-4 mr-2 shrink-0 mt-0.5 text-info"
                  />
                  <p className="text-xs text-info">
                    Your data is encrypted and secured by Plaid, trusted by
                    thousands of financial apps. We never see your login
                    credentials.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Connect Button */}
          <div className="w-full max-w-xs mx-auto">
            <Button
              id="connect-btn"
              onClick={handleConnect}
              color="primary"
              size="xl"
              block
            >
              Connect Bank Account
            </Button>

            {/* Footer Notes */}
            <div className="mt-4 text-center space-y-1">
              <p className="text-xs text-secondary">
                Opens in a new window for secure authentication
              </p>
              <p className="text-xs text-tertiary">Powered by Plaid</p>
            </div>
          </div>
        </div>
      </AnimateLayout>
    </div>
  );
}
