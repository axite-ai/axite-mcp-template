"use client";

import { useEffect, useState } from "react";

export default function SubscriptionSuccessPage() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Close the window after countdown
          window.close();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-green-500/20 p-6">
            <svg
              className="w-16 h-16 text-green-400"
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
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          Subscription Confirmed!
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Check your email for confirmation and next steps.
        </p>

        {/* Email Icon */}
        <div className="bg-gray-800/50 rounded-lg p-8 mb-8">
          <div className="flex justify-center mb-4">
            <svg
              className="w-16 h-16 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-300 text-lg">
            We&apos;ve sent you a confirmation email with instructions on how to connect your bank account and start using AskMyMoney.
          </p>
        </div>

        {/* Redirect Info */}
        <p className="text-gray-400 mb-6">
          This window will close in <span className="text-blue-400 font-semibold">{countdown}</span> seconds...
        </p>

        {/* Manual Close Button */}
        <button
          onClick={() => window.close()}
          className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
