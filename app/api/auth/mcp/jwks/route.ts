import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * JWKS Endpoint for MCP OAuth Clients
 *
 * Proxies requests to the JWT plugin's JWKS endpoint at /api/auth/jwks.
 * This is necessary because the MCP plugin advertises the JWKS endpoint at
 * /api/auth/mcp/jwks in the OAuth discovery metadata, but the JWT plugin
 * serves it at /api/auth/jwks.
 */
export const GET = async (request: NextRequest) => {
  console.log("[MCP JWKS] Request received", {
    path: request.nextUrl?.pathname,
    userAgent: request.headers.get('user-agent'),
    origin: request.headers.get('origin'),
  });

  try {
    // Create a new request object for the /jwks path
    const jwksRequest = new Request(request.url.replace('/api/auth/mcp/jwks', '/api/auth/jwks'), {
      method: 'GET',
      headers: request.headers,
    });

    // Use Better Auth's internal handler to process the JWKS request
    const response = await auth.handler(jwksRequest);

    if (!response.ok) {
      console.error("[MCP JWKS] Failed to get JWKS from auth handler", {
        status: response.status,
        statusText: response.statusText,
      });
      return response;
    }

    const jwks = await response.json();

    console.log("[MCP JWKS] Successfully retrieved JWKS", {
      keyCount: jwks.keys?.length || 0,
    });

    return NextResponse.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error("[MCP JWKS] Error retrieving JWKS:", error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
