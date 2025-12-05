import { NextRequest } from "next/server";
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

const handler = oAuthDiscoveryMetadata(auth);

export const GET = async (request: NextRequest) => {
  console.log("[Auth] OpenID configuration requested", {
    path: request.nextUrl?.pathname,
    query: Object.fromEntries(request.nextUrl?.searchParams ?? []),
  });
  return handler(request);
};
