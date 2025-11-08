import { NextRequest } from "next/server";
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

const handler = oAuthDiscoveryMetadata(auth);

export const GET = async (request: NextRequest) => {
  console.log("[OAuth Discovery] OpenID configuration requested", {
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
    console.log("[OAuth Discovery] OpenID configuration response:", {
      status: response.status,
      issuer: body.issuer,
      scopes_supported: body.scopes_supported,
      response_types_supported: body.response_types_supported,
      token_endpoint_auth_methods_supported: body.token_endpoint_auth_methods_supported,
    });
  } catch (e) {
    console.error("[OAuth Discovery] Failed to parse response:", e);
  }

  return response;
};
