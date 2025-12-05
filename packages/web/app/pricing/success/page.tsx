"use client";

export default function SubscriptionSuccessPage() {
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
          Subscription Confirmed! 🎉
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Your payment was successful. You now have access to all premium features!
        </p>

        {/* Next Steps */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 mb-8">
          <div className="flex items-start text-left">
            <svg
              className="w-6 h-6 text-blue-400 mr-3 flex-shrink-0 mt-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-2">
                Next Step: Start Using Your Features
              </h3>
              <p className="text-gray-300 mb-4">
                Return to <strong>ChatGPT</strong> to start using your new plan features.
                All MCP tools in your subscription tier are now available.
              </p>
              <p className="text-sm text-gray-400">
                Simply go back to your ChatGPT conversation and try out the available tools -
                you now have full access to your plan features.
              </p>
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="space-y-3 text-sm text-gray-400 mb-8">
          <div className="flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Subscription activated</span>
          </div>
          <div className="flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Return to ChatGPT to use your features</span>
          </div>
          <div className="flex items-center justify-center text-gray-500">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Explore your new capabilities</span>
          </div>
        </div>

        {/* Return to ChatGPT Button */}
        <button
          onClick={() => window.close()}
          className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
        >
          Return to ChatGPT
        </button>
      </div>
    </div>
  );
}
