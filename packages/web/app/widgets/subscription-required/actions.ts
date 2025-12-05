"use server";

import { baseURL } from "@/baseUrl";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

type UpgradeResult =
  | { success: true; checkoutUrl: string }
  | { success: false; error: string };

// Plan to Stripe Price ID mapping
const PLAN_PRICE_IDS: Record<string, string> = {
  basic: process.env.STRIPE_BASIC_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
};

export async function upgradeSubscription(userId: string, plan: string): Promise<UpgradeResult> {
  try {
    // Validate inputs
    if (!userId) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    const planLower = plan.toLowerCase();
    const priceId = PLAN_PRICE_IDS[planLower];

    if (!priceId) {
      console.error("[Subscription Action] Invalid plan:", plan);
      return {
        success: false,
        error: `Invalid plan: ${plan}`,
      };
    }

    console.log("[Subscription Action] Creating checkout session:", {
      userId,
      plan: planLower,
      priceId,
    });

    // Initialize Stripe client
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-10-29.clover",
    });

    // Get user's Stripe customer ID from database
    // Better Auth stores this in the user table when createCustomerOnSignUp is true
    let stripeCustomerId: string | null = null;

    const userResult = await db
      .select({
        stripeCustomerId: user.stripeCustomerId,
        email: user.email,
        name: user.name,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const userData = userResult[0];
    stripeCustomerId = userData.stripeCustomerId;

    // If no customer ID exists, create one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.name,
        metadata: {
          userId,
        },
      });

      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await db
        .update(user)
        .set({ stripeCustomerId: stripeCustomerId })
        .where(eq(user.id, userId));

      console.log("[Subscription Action] Created Stripe customer:", stripeCustomerId);
    }

    // CRITICAL: Pre-create subscription record in database with status "incomplete"
    // This is required for Better Auth webhooks to work - they need the subscriptionId
    const ctx = await auth.$context;
    const subscription = await ctx.adapter.create({
      model: "subscription",
      data: {
        plan: planLower,
        stripeCustomerId: stripeCustomerId,
        status: "incomplete",
        referenceId: userId,
        seats: 1,
      },
    });

    console.log("[Subscription Action] Created incomplete subscription:", {
      subscriptionId: subscription.id,
      plan: planLower,
      referenceId: userId,
    });

    // Create Stripe checkout session
    // CRITICAL: Must include subscriptionId metadata for Better Auth webhooks to work
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseURL}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseURL}/pricing`,
      client_reference_id: userId, // CRITICAL: Fallback for referenceId lookup
      metadata: {
        referenceId: userId,
        subscriptionId: subscription.id, // CRITICAL: Database subscription ID (NOT Stripe subscription ID)
        plan: planLower,
      },
      subscription_data: {
        metadata: {
          referenceId: userId, // CRITICAL: Better Auth webhooks look for referenceId here
          plan: planLower, // CRITICAL: Better Auth webhooks look for plan here
        },
        trial_period_days: planLower === 'pro' ? 14 : undefined,
      },
    });

    console.log("[Subscription Action] Checkout session created:", {
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

    if (!checkoutSession.url) {
      return {
        success: false,
        error: "No checkout URL returned from Stripe",
      };
    }

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
    };
  } catch (error) {
    console.error("[Subscription Action] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start subscription",
    };
  }
}
