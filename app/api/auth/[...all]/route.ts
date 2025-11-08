import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  console.log("[Better Auth] GET request:", {
    path: url.pathname,
    searchParams: Object.fromEntries(url.searchParams),
  });
  return auth.handler(request);
};

export const POST = async (request: NextRequest) => {
  const url = new URL(request.url);
  console.log("[Better Auth] POST request:", {
    path: url.pathname,
  });
  return auth.handler(request);
};
