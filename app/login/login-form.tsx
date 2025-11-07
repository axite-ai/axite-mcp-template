"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

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
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const name = formData.get("name") as string;

      console.log("Submitting form data:", {
        email,
        password: password ? "***" : undefined,
        name,
        showSignup
      });

      const endpoint = showSignup ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";

      // Build the request body
      const body: Record<string, string> = {
        email,
        password,
      };

      // Add name for signup (required by Better Auth)
      if (showSignup) {
        body.name = name || email.split("@")[0]; // Default to email prefix if no name
      }

      // Don't pass callbackURL to Better Auth - we'll handle the OAuth redirect manually
      // This prevents Better Auth from redirecting directly to ChatGPT without going through /authorize

      console.log("Sending request to:", endpoint, "with body:", { ...body, password: "***" });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        credentials: "include",
        redirect: "manual", // Don't follow redirects automatically - prevents CORS errors
      });

      console.log("Response status:", response.status, "type:", response.type);

      // Check if this is an OAuth flow (has client_id parameter)
      const isOAuthFlow = searchParams.has("client_id");
      const oauthAuthorizeUrl = isOAuthFlow
        ? `/api/auth/mcp/authorize?${searchParams.toString()}`
        : null;

      // Handle opaque redirects (status 0, type 'opaqueredirect')
      // This happens when redirect: 'manual' is set and server returns a 3xx redirect
      if (response.type === "opaqueredirect") {
        console.log("Opaque redirect detected - Better Auth tried to redirect");
        // Since we didn't pass callbackURL, Better Auth shouldn't be redirecting
        // This likely means there was an error or unexpected behavior
        // Proceed to handle OAuth flow manually
        if (oauthAuthorizeUrl) {
          console.log("Redirecting to OAuth authorize:", oauthAuthorizeUrl);
          window.location.href = oauthAuthorizeUrl;
        } else {
          window.location.reload();
        }
        return;
      }

      // Handle explicit redirects (3xx status codes)
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl) {
          console.log("Server redirect to:", redirectUrl);
          window.location.href = redirectUrl;
          return;
        }
      }

      // For non-redirect responses, parse JSON
      const data = await response.json().catch(() => ({}));
      console.log("Response data:", data);

      if (!response.ok) {
        throw new Error(data.message || `${showSignup ? "Sign up" : "Sign in"} failed`);
      }

      // Handle successful authentication
      console.log("Authentication successful!");

      if (oauthAuthorizeUrl) {
        // OAuth flow - redirect to authorization endpoint
        console.log("Redirecting to OAuth authorize:", oauthAuthorizeUrl);
        window.location.href = oauthAuthorizeUrl;
      } else if (data.url) {
        // Better Auth provided a redirect URL
        console.log("Redirecting to:", data.url);
        window.location.href = data.url;
      } else {
        // Regular sign in - redirect to home
        console.log("Redirecting to home");
        router.push("/");
      }
    } catch (err) {
      console.error("Form submission error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {showSignup ? "Create your account" : "Sign in to your account"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Continue to AskMyMoney
          </p>
        </div>

        <form
          ref={formRef}
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            {showSignup && (
              <div>
                <label htmlFor="name" className="sr-only">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Full name (optional)"
                  disabled={loading}
                />
              </div>
            )}
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${showSignup ? '' : 'rounded-t-md'} focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                placeholder="Email address"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={showSignup ? "new-password" : "current-password"}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                disabled={loading}
                minLength={8}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                showSignup ? "Sign up" : "Sign in"
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setShowSignup(!showSignup);
                setError("");
                // Reset the form when switching modes
                formRef.current?.reset();
              }}
              className="text-sm text-indigo-600 hover:text-indigo-500"
              disabled={loading}
            >
              {showSignup
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">
                Connect your financial accounts securely
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
