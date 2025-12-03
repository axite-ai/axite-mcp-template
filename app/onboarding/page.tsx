"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ShieldCheck } from "@openai/apps-sdk-ui/components/Icon";
import { checkSecurityStatus } from "./actions";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const callbackURL = searchParams.get("callbackURL") || "/";

  useEffect(() => {
    const init = async () => {
      try {
        const status = await checkSecurityStatus();
        if (status.hasSecurity) {
          window.location.href = callbackURL;
        } else {
          setChecking(false);
        }
      } catch (err) {
        console.error("Failed to check security status", err);
        setChecking(false);
      }
    };
    init();
  }, [callbackURL]);

  const handlePasskeySetup = async () => {
    setLoading(true);
    try {
      const { error } = await authClient.passkey.addPasskey({
        name: "My Passkey",
      });
      if (error) throw error;
      window.location.href = callbackURL;
    } catch (err) {
      console.error("Passkey setup failed", err);
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 heading-lg text-default">Secure Your Account</h2>
          <p className="mt-2 text-sm text-secondary">
            Create a passkey to secure your financial data with biometric authentication.
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-8 bg-surface border border-subtle rounded-lg">
            <ShieldCheck className="w-16 h-16 mx-auto text-primary mb-6" />
            <h3 className="text-xl font-medium text-default">Create Your Passkey</h3>
            <p className="text-sm text-secondary mt-3 mb-8">
              Sign in securely using your face, fingerprint, or device PIN.
              Passkeys are phishing-resistant and never leave your device.
            </p>
            <Button
              onClick={handlePasskeySetup}
              disabled={loading}
              loading={loading}
              color="primary"
              size="xl"
              block
            >
              <ShieldCheck className="w-5 h-5 mr-2" />
              Create Passkey
            </Button>
          </div>

          <p className="text-xs text-secondary mt-4">
            <ShieldCheck className="w-3 h-3 inline-block mr-1" />
            Required for accessing financial data and bank connections
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
