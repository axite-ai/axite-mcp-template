"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Alert } from "@openai/apps-sdk-ui/components/Alert";
import { ShieldCheck } from "@openai/apps-sdk-ui/components/Icon";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    console.log("Login page loaded. OAuth Parameters:", {
      client_id: searchParams.get("client_id"),
      response_type: searchParams.get("response_type"),
      redirect_uri: searchParams.get("redirect_uri"),
      state: searchParams.get("state"),
      scope: searchParams.get("scope"),
      code_challenge: searchParams.get("code_challenge"),
      code_challenge_method: searchParams.get("code_challenge_method"),
      resource: searchParams.get("resource"),
    });

    // Passkey Conditional UI
    const initPasskey = async () => {
      if (!window.PublicKeyCredential?.isConditionalMediationAvailable) {
        return;
      }
      const available = await window.PublicKeyCredential.isConditionalMediationAvailable();
      if (available) {
        authClient.signIn.passkey({ autoFill: true });
      }
    };
    initPasskey();
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);

    try {
      // Determine the final destination
      // If we have a client_id (MCP flow), redirect back to authorize endpoint
      // Otherwise go to home
      const finalRedirect = searchParams.has("client_id")
        ? `/api/auth/mcp/authorize?${searchParams.toString()}`
        : "/";

      // Redirect to onboarding first to ensure security setup
      const onboardingURL = `/onboarding?callbackURL=${encodeURIComponent(finalRedirect)}`;

      console.log("[Login] Starting Google OAuth flow with callback:", onboardingURL);

      await authClient.signIn.social({
        provider: "google",
        callbackURL: onboardingURL,
        newUserCallbackURL: onboardingURL,
      });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const callbackURL = searchParams.has("client_id")
        ? `/api/auth/mcp/authorize?${searchParams.toString()}`
        : "/";

      const { error } = await authClient.signIn.passkey({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = callbackURL;
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error("Passkey sign-in error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  // Build the recovery URL with callback preservation
  const finalRedirect = searchParams.has("client_id")
    ? `/api/auth/mcp/authorize?${searchParams.toString()}`
    : "/";
  const recoveryURL = `/recover?callbackURL=${encodeURIComponent(finalRedirect)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center heading-lg text-default">
            Welcome to AskMyMoney
          </h2>
          <p className="mt-2 text-center text-sm text-secondary">
            Sign in with your passkey to continue
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <Alert
              color="danger"
              description={error}
            />
          )}

          <div className="space-y-4">
            {/* Primary CTA: Sign in with Passkey */}
            <Button
              onClick={handlePasskeySignIn}
              disabled={loading}
              loading={loading}
              color="primary"
              size="xl"
              block
            >
              <ShieldCheck className="w-5 h-5 mr-2" />
              Sign in with Passkey
            </Button>

            {/* Recovery + Signup links */}
            <div className="text-center space-y-2">
              <p className="text-sm text-secondary">
                Trouble signing in?{" "}
                <a
                  href={recoveryURL}
                  className="text-primary hover:text-primary-dark underline font-medium"
                >
                  Recover with Google →
                </a>
              </p>

              <p className="text-sm text-secondary">
                Don't have an account?{" "}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="text-primary hover:text-primary-dark underline font-medium"
                >
                  Continue with Google →
                </button>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-secondary">
              <ShieldCheck className="w-4 h-4 inline-block mr-1 align-text-bottom" />
              Passkey-based authentication for maximum security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
