"use server";

import { headers } from "next/headers";
import { createLinkToken, exchangePublicToken } from "@/lib/services/plaid-service";
import { auth } from "@/lib/auth";
import { UserService } from "@/lib/services/user-service";

interface PlaidInstitution {
  id?: string;
  name?: string;
}

export async function createPlaidLinkToken() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { link_token } = await createLinkToken(session.user.id);
    return { success: true, linkToken: link_token };
  } catch (error) {
    console.error("Error creating Plaid link token:", error);
    return { success: false, error: "Failed to create Plaid link token" };
  }
}

export async function exchangePlaidPublicToken(publicToken: string, institution: PlaidInstitution) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { accessToken, itemId } = await exchangePublicToken(publicToken);
    await UserService.savePlaidItem(session.user.id, itemId, accessToken, institution.id, institution.name);
    return { success: true };
  } catch (error) {
    console.error("Error exchanging Plaid public token:", error);
    return { success: false, error: "Failed to exchange Plaid public token" };
  }
}
