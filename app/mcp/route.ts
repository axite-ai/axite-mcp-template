/**
 * MCP Server Route Handler
 *
 * This is the core of your ChatGPT MCP application.
 * Register your tools here and define their behavior.
 *
 * TEMPLATE: Add your own tools following the patterns below
 */

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { withMcpAuth } from "better-auth/plugins";
import { auth } from "@/lib/auth";
import { baseURL } from "@/baseUrl";
import { logger } from "@/lib/services/logger-service";
import { requireAuth } from "@/lib/utils/mcp-auth-helpers";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/utils/mcp-response-helpers";
import { ItemsService } from "@/lib/services/items-service";
import { WeatherService } from "@/lib/services/weather-service";
import { FEATURES } from "@/lib/config/features";
import type {
  UserItemsResponse,
  ManageItemResponse,
  WeatherResponse,
  ROICalculatorResponse,
  ManageSubscriptionResponse,
} from "@/lib/types/tool-responses";
import Stripe from "stripe";

// Initialize Stripe (only if subscriptions enabled)
const stripe = FEATURES.SUBSCRIPTIONS
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-10-29.clover" as any,
    })
  : null;

// Helper to fetch HTML from Next.js pages (Vercel template pattern)
const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

// ============================================================================
// MCP HANDLER WITH OAUTH
// ============================================================================

const handler = withMcpAuth(auth, async (req: Request, session: any) => {
  // Log session details for debugging
  logger.debug("[MCP] Session received:", {
    hasSession: !!session,
    userId: session?.userId,
    scopes: session?.scopes,
  });

  return createMcpHandler(async (server) => {
    // ==========================================================================
    // WIDGET RESOURCES
    // ==========================================================================
    const widgets = [
      {
        id: "user-items",
        title: "User Items List",
        description: "Display and manage your items",
        path: "/widgets/user-items",
      },
      {
        id: "manage-item",
        title: "Manage Item",
        description: "Create, update, or delete an item",
        path: "/widgets/manage-item",
      },
      {
        id: "weather",
        title: "Weather Widget",
        description: "Current weather and forecast",
        path: "/widgets/weather",
      },
      {
        id: "roi-calculator",
        title: "ROI Calculator",
        description: "Calculate investment returns",
        path: "/widgets/roi-calculator",
      },
      {
        id: "subscription-required",
        title: "Subscription Required",
        description: "Choose a plan to unlock features",
        path: "/widgets/subscription-required",
      },
      {
        id: "manage-subscription",
        title: "Manage Subscription",
        description: "Update or cancel your subscription",
        path: "/widgets/manage-subscription",
      },
      {
        id: "login",
        title: "Login",
        description: "Sign in to your account",
        path: "/login",
      },
    ];

    for (const widget of widgets) {
      server.registerResource(
        widget.id,
        `ui://widget/${widget.id}.html`,
        {
          title: widget.title,
          description: widget.description,
          mimeType: "text/html+skybridge",
        },
        async () => {
          try {
            const html = await getAppsSdkCompatibleHtml(baseURL, widget.path);
            return {
              contents: [
                {
                  uri: `ui://widget/${widget.id}.html`,
                  mimeType: "text/html+skybridge",
                  text: html,
                },
              ],
            };
          } catch (error) {
            logger.error(`Failed to fetch widget: ${widget.id}`, error);
            throw error;
          }
        }
      );
    }

    // ==========================================================================
    // TOOL 1: GET USER ITEMS (Read-only, requires auth + subscription)
    // Demonstrates: Simple data fetching, database queries, widget rendering
    // ==========================================================================

    server.registerTool(
      "get_user_items",
      {
        title: "Get User Items",
        description:
          "Retrieve all items for the authenticated user. Shows how to fetch and display data.",
        inputSchema: {
          status: z
            .enum(["active", "archived", "deleted"])
            .optional()
            .describe("Filter by item status (default: active)"),
          limit: z
            .number()
            .optional()
            .describe("Maximum number of items to return (default: 50)"),
        },
        _meta: {
          "openai/outputTemplate": "ui://widget/user-items.html",
          "openai/toolInvocation/invoking": "Fetching your items...",
          "openai/toolInvocation/invoked": "Items loaded",
          "openai/widgetAccessible": true,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        securitySchemes: [{ type: "oauth2", scopes: ["items:read"] }],
      } as any,
      async ({ status = "active", limit = 50 }): Promise<UserItemsResponse> => {
        try {
          // Check authentication and subscription
          const authCheck = await requireAuth(session, "user items", {
            requireSubscription: true,
          });
          if (authCheck) return authCheck;

          // Fetch items from database
          const items = await ItemsService.getUserItems(session!.userId, {
            status: status as "active" | "archived" | "deleted",
            limit,
          });

          // Format response
          return createSuccessResponse(
            `Found ${items.length} ${status} item${items.length !== 1 ? "s" : ""}`,
            {
              items: items.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description || undefined,
                status: item.status,
                order: item.order,
                metadata: item.metadata as Record<string, unknown> | undefined,
                createdAt: item.createdAt.toISOString(),
                updatedAt: item.updatedAt.toISOString(),
              })),
              totalItems: items.length,
              displayedItems: items.length,
            }
          );
        } catch (error) {
          logger.error("get_user_items failed", { error });
          return createErrorResponse(
            error instanceof Error ? error.message : "Failed to fetch items"
          );
        }
      }
    );

    // ==========================================================================
    // TOOL 2: MANAGE ITEM (CRUD operations, requires auth + subscription)
    // Demonstrates: Create/Update/Delete operations, form handling, validation
    // ==========================================================================

    server.registerTool(
      "manage_item",
      {
        title: "Manage Item",
        description:
          "Create, update, or delete an item. Demonstrates CRUD operations with validation.",
        inputSchema: {
          action: z
            .enum(["create", "update", "delete", "archive"])
            .describe("Action to perform on the item"),
          itemId: z
            .string()
            .optional()
            .describe("Item ID (required for update/delete/archive)"),
          title: z.string().optional().describe("Item title (required for create)"),
          description: z.string().optional().describe("Item description"),
          metadata: z
            .record(z.unknown())
            .optional()
            .describe("Custom metadata as JSON object"),
          order: z.number().optional().describe("Display order"),
        },
        _meta: {
          "openai/outputTemplate": "ui://widget/manage-item.html",
          "openai/toolInvocation/invoking": "Processing your request...",
          "openai/toolInvocation/invoked": "Action completed",
          "openai/widgetAccessible": true,
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false, // Not permanently destructive (soft delete)
          openWorldHint: false,
        },
        securitySchemes: [{ type: "oauth2", scopes: ["items:write"] }],
      } as any,
      async (args: any): Promise<ManageItemResponse> => {
        const { action, itemId, title, description, metadata, order } = args;
        try {
          // Check authentication and subscription
          const authCheck = await requireAuth(session, "manage items", {
            requireSubscription: true,
          });
          if (authCheck) return authCheck;

          let result;
          let actionPerformed: "created" | "updated" | "deleted" | "archived";

          switch (action) {
            case "create":
              if (!title) {
                return createErrorResponse(
                  "Title is required to create an item"
                );
              }
              result = await ItemsService.createItem({
                userId: session!.userId,
                title,
                description,
                metadata,
                order,
              });
              actionPerformed = "created";
              break;

            case "update":
              if (!itemId) {
                return createErrorResponse(
                  "Item ID is required to update an item"
                );
              }
              result = await ItemsService.updateItem(itemId, session!.userId, {
                title,
                description,
                metadata,
                order,
              });
              actionPerformed = "updated";
              break;

            case "archive":
              if (!itemId) {
                return createErrorResponse(
                  "Item ID is required to archive an item"
                );
              }
              result = await ItemsService.archiveItem(itemId, session!.userId);
              actionPerformed = "archived";
              break;

            case "delete":
              if (!itemId) {
                return createErrorResponse(
                  "Item ID is required to delete an item"
                );
              }
              result = await ItemsService.deleteItem(itemId, session!.userId);
              actionPerformed = "deleted";
              break;

            default:
              return createErrorResponse("Invalid action");
          }

          return createSuccessResponse(
            `Item ${actionPerformed} successfully`,
            {
              item: {
                id: result.id,
                title: result.title,
                description: result.description || undefined,
                status: result.status,
                order: result.order,
                metadata: result.metadata as Record<string, unknown> | undefined,
                createdAt: result.createdAt.toISOString(),
                updatedAt: result.updatedAt.toISOString(),
              },
              action: actionPerformed,
              message: `Item ${actionPerformed} successfully`,
            }
          );
        } catch (error) {
          logger.error("manage_item failed", { error, action, itemId });
          return createErrorResponse(
            error instanceof Error ? error.message : "Failed to manage item"
          );
        }
      }
    );

    // ==========================================================================
    // TOOL 3: GET WEATHER (Free tier, external API integration)
    // Demonstrates: External API calls, caching, error handling, free access
    // ==========================================================================

    server.registerTool(
      "get_weather",
      {
        title: "Get Weather",
        description:
          "Get current weather and 3-day forecast for any location. Demonstrates external API integration. Free to use!",
        inputSchema: {
          location: z
            .string()
            .describe("City name, zip code, or coordinates (e.g., 'New York', '10001')"),
        },
        _meta: {
          "openai/outputTemplate": "ui://widget/weather.html",
          "openai/toolInvocation/invoking": "Fetching weather data...",
          "openai/toolInvocation/invoked": "Weather loaded",
          "openai/widgetAccessible": true,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true, // Calls external API
        },
        securitySchemes: [], // No auth required - free tier
      } as any,
      async (args: any): Promise<WeatherResponse> => {
        const { location } = args;
        try {
          // No auth required for free tier tools
          // TEMPLATE: You can add requireAuth with requireSubscription: false
          // to require login but not subscription

          const weatherData = await WeatherService.getWeather(location);

          return createSuccessResponse(
            `Current temperature in ${weatherData.location}: ${weatherData.temperature}°F, ${weatherData.condition}`,
            {
              location: weatherData.location,
              current: {
                temperature: weatherData.temperature,
                condition: weatherData.condition,
                humidity: weatherData.humidity,
                windSpeed: weatherData.windSpeed,
                feelsLike: weatherData.feelsLike,
              },
              forecast: weatherData.forecast,
              lastUpdated: new Date().toISOString(),
            }
          );
        } catch (error) {
          logger.error("get_weather failed", { error, location });
          return createErrorResponse(
            error instanceof Error
              ? error.message
              : "Failed to fetch weather data"
          ) as unknown as WeatherResponse;
        }
      }
    );

    // ==========================================================================
    // TOOL 4: CALCULATE ROI (Free tier, calculations/forms)
    // Demonstrates: Calculations, form-based tools, charts, free access
    // ==========================================================================

    server.registerTool(
      "calculate_roi",
      {
        title: "Calculate ROI",
        description:
          "Calculate investment returns over time with compound interest. Shows year-by-year breakdown. Free to use!",
        inputSchema: {
          initialInvestment: z
            .number()
            .positive()
            .describe("Initial investment amount in dollars"),
          years: z
            .number()
            .int()
            .positive()
            .max(50)
            .describe("Number of years to project"),
          annualReturn: z
            .number()
            .min(-100)
            .max(100)
            .describe("Expected annual return as percentage (e.g., 7 for 7%)"),
        },
        _meta: {
          "openai/outputTemplate": "ui://widget/roi-calculator.html",
          "openai/toolInvocation/invoking": "Calculating returns...",
          "openai/toolInvocation/invoked": "Calculation complete",
          "openai/widgetAccessible": true,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
        securitySchemes: [], // No auth required - free tier
      } as any,
      async (args: any): Promise<ROICalculatorResponse> => {
        const { initialInvestment, years, annualReturn } = args;
        try {
          // Calculate year-by-year returns
          const yearByYear = [];
          let currentValue = initialInvestment;

          for (let year = 1; year <= years; year++) {
            const gain = currentValue * (annualReturn / 100);
            currentValue += gain;

            yearByYear.push({
              year,
              value: Math.round(currentValue * 100) / 100,
              gain: Math.round(gain * 100) / 100,
            });
          }

          const finalValue = currentValue;
          const totalGain = finalValue - initialInvestment;
          const totalReturn = ((totalGain / initialInvestment) * 100);

          return createSuccessResponse(
            `After ${years} years at ${annualReturn}% annual return, $${initialInvestment.toLocaleString()} would grow to $${finalValue.toLocaleString()} (${totalReturn.toFixed(1)}% total return)`,
            {
              inputs: {
                initialInvestment,
                years,
                annualReturn,
              },
              results: {
                finalValue: Math.round(finalValue * 100) / 100,
                totalGain: Math.round(totalGain * 100) / 100,
                totalReturn: Math.round(totalReturn * 100) / 100,
                yearByYear,
              },
              calculatedAt: new Date().toISOString(),
            }
          );
        } catch (error) {
          logger.error("calculate_roi failed", { error });
          return createErrorResponse(
            "Failed to calculate ROI"
          ) as unknown as ROICalculatorResponse;
        }
      }
    );

    // ==========================================================================
    // TOOL 5: MANAGE SUBSCRIPTION (Requires auth, optional based on feature flag)
    // Demonstrates: Stripe integration, billing portal, subscription management
    // ==========================================================================

    if (FEATURES.SUBSCRIPTIONS && stripe) {
      server.registerTool(
        "manage_subscription",
        {
          title: "Manage Subscription",
          description:
            "View your current subscription and access the billing portal to update payment methods or cancel.",
          inputSchema: {},
          _meta: {
            "openai/outputTemplate": "ui://widget/manage-subscription.html",
            "openai/toolInvocation/invoking": "Loading subscription details...",
            "openai/toolInvocation/invoked": "Subscription loaded",
            "openai/widgetAccessible": true,
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
          securitySchemes: [{ type: "oauth2", scopes: ["subscription:read"] }],
        } as any,
        async (): Promise<ManageSubscriptionResponse> => {
          try {
            // Check authentication (no subscription required to view subscription!)
            const authCheck = await requireAuth(session, "subscription management", {
              requireSubscription: false,
            });
            if (authCheck) return authCheck;

            // Get user's Stripe customer ID
            const userRecord = await auth.api.getSession({
              headers: req.headers,
            });

            // Cast to any to access stripeCustomerId added by plugin
            const user = userRecord?.user as any;

            if (!user?.stripeCustomerId) {
              return createErrorResponse(
                "No Stripe customer found. Please contact support."
              );
            }

            // Create billing portal session
            const portalSession = await stripe!.billingPortal.sessions.create({
              customer: user.stripeCustomerId,
              return_url: `${baseURL}/settings`,
            });

            // Get subscription info (if exists)
            const subscriptions = await stripe!.subscriptions.list({
              customer: user.stripeCustomerId,
              limit: 1,
            });

            const subscription = subscriptions.data[0] || null;

            return createSuccessResponse(
              subscription
                ? `You're subscribed to the ${subscription.items.data[0]?.price.metadata?.plan || "current"} plan`
                : "No active subscription",
              {
                subscription: subscription
                  ? {
                      plan:
                        subscription.items.data[0]?.price.metadata?.plan || "unknown",
                      status: subscription.status,
                      periodStart: new Date(
                        ((subscription as any).current_period_start) * 1000
                      ).toISOString(),
                      periodEnd: new Date(
                        ((subscription as any).current_period_end) * 1000
                      ).toISOString(),
                      cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    }
                  : null,
                portalUrl: portalSession.url,
                message: "Click below to manage your subscription",
              }
            );
          } catch (error) {
            logger.error("manage_subscription failed", { error });
            return createErrorResponse(
              "Failed to load subscription details"
            );
          }
        }
      );
    }

    // ==========================================================================
    // TEMPLATE: Add your own tools here
    // ==========================================================================

    /*
    server.registerTool(
      "your_tool_name",
      {
        title: "Your Tool Title",
        description: "What your tool does",
        inputSchema: {
          param: z.string().describe("Parameter description"),
        },
        _meta: {
          "openai/outputTemplate": "ui://widget/your-widget.html",
          "openai/toolInvocation/invoking": "Processing...",
          "openai/toolInvocation/invoked": "Done!",
          "openai/widgetAccessible": true,
        },
        annotations: {
          readOnlyHint: true, // Does it modify data?
          destructiveHint: false, // Is it destructive?
          openWorldHint: false, // Does it call external APIs?
        },
        securitySchemes: [{ type: "oauth2", scopes: ["your:scope"] }],
      } as any,
      async ({ param }) => {
        try {
          // Your tool logic here
          const authCheck = await requireAuth(session, "your feature");
          if (authCheck) return authCheck;

          // Do something...

          return createSuccessResponse("Success!", { data: "result" });
        } catch (error) {
          return createErrorResponse("Failed");
        }
      }
    );
    */
  }) as unknown as Promise<Response>;
});

export const POST = handler;
