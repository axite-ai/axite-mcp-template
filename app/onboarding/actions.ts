"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { passkey } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function checkSecurityStatus() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) {
    return { authenticated: false };
  }

  // Check if user has passkeys
  const userPasskeys = await db.select().from(passkey).where(eq(passkey.userId, session.user.id));
  const hasPasskey = userPasskeys.length > 0;

  return {
    authenticated: true,
    hasSecurity: hasPasskey,
  };
}
