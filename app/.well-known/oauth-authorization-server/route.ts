import { NextRequest } from "next/server";
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

const handler = oAuthDiscoveryMetadata(auth);

export const GET = async (request: NextRequest) => {
  console.log("[OAuth Discovery] Authorization server metadata requested", {
    path: request.nextUrl?.pathname,
    query: Object.fromEntries(request.nextUrl?.searchParams ?? []),
    userAgent: request.headers.get('user-agent'),
    origin: request.headers.get('origin'),
  });

  const response = await handler(request);

  // Log the response for debugging
  try {
    const cloned = response.clone();
    const body = await cloned.json();
    console.log("[OAuth Discovery] Authorization server metadata response:", {
      status: response.status,
      issuer: body.issuer,
      authorization_endpoint: body.authorization_endpoint,
      token_endpoint: body.token_endpoint,
      registration_endpoint: body.registration_endpoint,
      scopes_supported: body.scopes_supported,
      grant_types_supported: body.grant_types_supported,
      code_challenge_methods_supported: body.code_challenge_methods_supported,
    });
  } catch (e) {
    console.error("[OAuth Discovery] Failed to parse response:", e);
  }

  return response;
};
