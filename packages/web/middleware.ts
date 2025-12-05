import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  // Get the origin from the request
  const origin = request.headers.get("origin");

  // List of allowed origins (ChatGPT sandbox, Claude, etc.)
  const allowedOrigins = [
    /^https:\/\/.*\.oaiusercontent\.com$/,  // ChatGPT sandbox
    /^https:\/\/chatgpt\.com$/,
    /^https:\/\/chat\.openai\.com$/,
    /^https:\/\/.*\.claude\.ai$/,
    /^https:\/\/claude\.com$/,
  ];

  // Check if origin is allowed
  const isAllowedOrigin = origin && (
    allowedOrigins.some(pattern => pattern.test(origin)) ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );

  // Determine which origin to use in response
  // Be more permissive in development to allow for HMR and other Next.js dev features
  const allowOrigin = isAllowedOrigin
    ? origin
    : process.env.NODE_ENV === "development"
    ? "*"
    : "null";

  // Define Content Security Policy
  // TEMPLATE: Add your third-party service domains (e.g., payment processors, analytics) to these directives
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.claude.ai https://chat.openai.com https://challenges.cloudflare.com https://*.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data:",
    `frame-src 'self' https://*.claude.ai https://*.oaiusercontent.com https://chat.openai.com`,
    "connect-src 'self' https://*.claude.ai https://chat.openai.com",
    `base-uri 'self'`,
    "form-action 'self'",
    "frame-ancestors 'self' https://*.claude.ai https://*.oaiusercontent.com https://chat.openai.com",
  ].join("; ");

  // Handle preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Credentials": "true", // Required for cookies/auth
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, Next-Action, Next-Router-State-Tree, next-hmr-refresh",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Check passkey requirements for authenticated routes
  // NOTE: This is UX optimization only - real security is enforced at API/data layer
  // Edge runtime cannot validate sessions, so we only check for cookie existence
  const pathname = request.nextUrl.pathname;

  // Skip passkey check for auth routes, public routes, and static files
  const publicPaths = [
    "/login",
    "/auth-callback",
    "/setup-security",
    "/onboarding",
    "/recover",
    "/api/auth",
    "/_next",
    "/favicon.ico",
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  if (!isPublicPath) {
    // Cookie-based check (edge-compatible)
    // WARNING: This only checks cookie existence, NOT validity
    // Actual security is enforced at API layer (requireAuth) and data layer (server actions)
    const sessionCookie = getSessionCookie(request);

    if (sessionCookie) {
      // User appears to be authenticated based on cookie
      // We cannot check passkey status in edge runtime
      // The API layer (requireAuth) will enforce passkey when they make requests
      // This is just for UX - redirecting logged-in users to setup if needed

      // Note: We cannot verify passkey status here due to edge runtime limitations
      // The actual passkey enforcement happens at:
      // 1. MCP Tool layer (requireAuth helper)
      // 2. Server Action layer (direct checks)
    }
  }

  // Get the response
  const response = NextResponse.next();

  // Set CSP header
  response.headers.set("Content-Security-Policy", csp.replace(/\s{2,}/g, ' ').trim());

  // Set CORS headers for all requests
  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  if (isAllowedOrigin || process.env.NODE_ENV === 'development') {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Next-Action, Next-Router-State-Tree, next-hmr-refresh");

  // Expose headers that OAuth/MCP clients need
  response.headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, Location, Content-Type, Authorization");

  return response;
}

export const config = {
  matcher: [
    // Match all routes to handle CORS for server actions and API routes
    "/(.*)",
  ],
};
