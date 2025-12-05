"use client";

import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ShieldCheck } from "@openai/apps-sdk-ui/components/Icon";
import { useOpenExternal, useWidgetProps } from "@/app/hooks";

interface SecurityRequiredProps {
  message?: string;
  baseUrl?: string;
  featureName?: string;
  setupUrl?: string;
  [key: string]: unknown;
}

export default function SecurityRequired() {
  const toolOutput = useWidgetProps<SecurityRequiredProps>();
  const openExternal = useOpenExternal();

  if (!toolOutput) return null;

  const { featureName, setupUrl } = toolOutput;

  const handleSetup = () => {
    // Open in new window for security setup
    if (setupUrl) {
      openExternal(setupUrl);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="bg-surface-secondary p-4 rounded-full">
        <ShieldCheck className="w-8 h-8 text-primary" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-default">
          Passkey Required
        </h3>
        <p className="text-sm text-secondary mt-1">
          {featureName
            ? `To access ${featureName}, you need to create a passkey.`
            : "This feature requires passkey authentication for security."}
        </p>
      </div>

      <Button onClick={handleSetup} color="primary">
        Setup Security
      </Button>

      <p className="text-xs text-secondary">
        Opens in a new window to secure your account.
      </p>
    </div>
  );
}
