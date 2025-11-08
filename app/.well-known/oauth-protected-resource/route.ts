import { NextRequest, NextResponse } from "next/server";
import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

const handler = oAuthProtectedResourceMetadata(auth);

export const GET = async (request: NextRequest) => {
  console.log("[OAuth Discovery] Protected resource metadata requested", {
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
    console.log("[OAuth Discovery] Protected resource metadata response:", {
      status: response.status,
      resource: body.resource,
      authorization_servers: body.authorization_servers,
      scopes_supported: body.scopes_supported,
      bearer_methods_supported: body.bearer_methods_supported,
    });
  } catch (e) {
    console.error("[OAuth Discovery] Failed to parse response:", e);
  }

  return response;
};
