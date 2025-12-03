"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Alert } from "@openai/apps-sdk-ui/components/Alert";
import { ShieldCheck } from "@openai/apps-sdk-ui/components/Icon";
import { checkRecoveryEligibility, completeAccountRecovery } from "./actions";

function RecoverContent() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "confirm" | "complete">("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Check if user just completed Google OAuth and needs recovery finalization
  useEffect(() => {
    const finalize = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("finalize") === "true") {
        setStep("complete");
        setLoading(true);
        try {
          const result = await completeAccountRecovery();
          if (result.success) {
            setSuccess(result.message);
            // Redirect to passkey enrollment, preserving the original callback URL
            const callbackURL = params.get("callbackURL") || "/";
            setTimeout(() => {
              router.push(`/onboarding?callbackURL=${encodeURIComponent(callbackURL)}`);
            }, 2000);
          } else {
            setError(result.error);
            setLoading(false);
          }
        } catch (err) {
          setError("An unexpected error occurred");
          setLoading(false);
        }
      }
    };
    finalize();
  }, [router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await checkRecoveryEligibility(email);
      if (result.success) {
        setStep("confirm");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRecovery = async () => {
    setError("");
    setLoading(true);

    try {
      // Preserve the original callback URL through the recovery flow
      const params = new URLSearchParams(window.location.search);
      const originalCallback = params.get("callbackURL") || "/";

      // Redirect to Google OAuth with recovery callback, preserving the original destination
      const recoveryCallback = `${window.location.origin}/recover?finalize=true&callbackURL=${encodeURIComponent(originalCallback)}`;

      await authClient.signIn.social({
        provider: "google",
        callbackURL: recoveryCallback,
        newUserCallbackURL: "/", // New users shouldn't be here
        fetchOptions: {
          // Force fresh login (no silent SSO)
          onRequest: (options) => {
            if (options.body instanceof URLSearchParams) {
              options.body.append("prompt", "login");
            }
            return options;
          },
        },
      });
    } catch (err) {
      console.error("Google recovery error:", err);
      setError(err instanceof Error ? err.message : "Failed to initiate recovery");
      setLoading(false);
    }
  };

  // Step 1: Email input
  if (step === "email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center heading-lg text-default">
              Recover Your Account
            </h2>
            <p className="mt-2 text-center text-sm text-secondary">
              Enter your email address to begin account recovery
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleEmailSubmit}>
            {error && <Alert color="danger" description={error} />}

            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-subtle placeholder-secondary text-default focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              color="primary"
              size="xl"
              block
            >
              Continue
            </Button>

            <div className="text-center">
              <a
                href="/login"
                className="text-sm text-primary hover:text-primary-dark underline"
              >
                ← Back to login
              </a>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Confirm nuclear-option recovery
  if (step === "confirm") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center heading-lg text-default">
              Confirm Account Recovery
            </h2>
            <p className="mt-2 text-center text-sm text-secondary">
              Please read carefully before proceeding
            </p>
          </div>

          <div className="mt-8 space-y-6">
            {error && <Alert color="danger" description={error} />}

            <div className="bg-surface-secondary border border-subtle rounded-lg p-6 space-y-4">
              <div className="flex items-start">
                <ShieldCheck className="w-6 h-6 text-primary mr-3 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-default mb-2">What will happen:</h3>
                  <ul className="text-sm text-secondary space-y-2 list-disc list-inside">
                    <li>All your existing sessions will be invalidated</li>
                    <li>All your existing passkeys will be deleted</li>
                    <li>You'll need to create a new passkey</li>
                    <li>This action will be logged for security purposes</li>
                  </ul>
                </div>
              </div>
            </div>

            <Alert
              color="warning"
              description="This is a security-critical operation. You will be required to sign in with Google and create a new passkey."
            />

            <div className="space-y-3">
              <Button
                onClick={handleGoogleRecovery}
                disabled={loading}
                loading={loading}
                color="primary"
                size="xl"
                block
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Recover with Google
              </Button>

              <Button
                onClick={() => setStep("email")}
                disabled={loading}
                color="secondary"
                size="xl"
                block
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Recovery complete
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {success ? (
          <>
            <div className="bg-surface-secondary p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="mt-6 heading-lg text-default">Recovery Complete</h2>
              <p className="mt-2 text-sm text-secondary">{success}</p>
              <p className="mt-4 text-sm text-secondary">
                Redirecting to passkey setup...
              </p>
            </div>
          </>
        ) : (
          <>
            {error && <Alert color="danger" description={error} />}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-secondary">Completing recovery...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function RecoverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <RecoverContent />
    </Suspense>
  );
}
