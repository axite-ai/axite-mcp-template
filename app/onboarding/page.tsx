"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ShieldCheck, Lock } from "@openai/apps-sdk-ui/components/Icon";
import { checkSecurityStatus } from "./actions";

function OnboardingContent() {
  const router = useRouter();
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

  const handle2FASetup = () => {
    router.push(`/setup-2fa?callbackURL=${encodeURIComponent(callbackURL)}`);
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
            To continue, please enable a secure authentication method.
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-6 bg-surface border border-subtle rounded-lg">
            <ShieldCheck className="w-12 h-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-medium text-default">Passkey (Recommended)</h3>
            <p className="text-sm text-secondary mt-2 mb-6">
              Sign in securely using your face, fingerprint, or device PIN.
            </p>
            <Button
              onClick={handlePasskeySetup}
              disabled={loading}
              loading={loading}
              color="primary"
              block
            >
              Enable Passkey
            </Button>
          </div>

          <div className="relative flex justify-center text-sm py-2">
            <span className="px-2 bg-surface text-secondary">Or</span>
          </div>

          <div className="p-6 bg-surface border border-subtle rounded-lg">
            <Lock className="w-12 h-12 mx-auto text-secondary mb-4" />
            <h3 className="text-lg font-medium text-default">Authenticator App</h3>
            <p className="text-sm text-secondary mt-2 mb-6">
              Use an app like Google Authenticator or Authy.
            </p>
            <Button
              onClick={handle2FASetup}
              disabled={loading}
              color="secondary"
              block
            >
              Setup 2FA
            </Button>
          </div>
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
