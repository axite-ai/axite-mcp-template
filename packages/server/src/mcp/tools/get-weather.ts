/**
 * Get Weather Tool
 *
 * Fetches current weather and forecast for a location.
 * Demonstrates: External API integration, caching, free tier access, tool annotations
 *
 * MCP Best Practices implemented:
 * - Tool naming with {service}_ prefix placeholder
 * - All four tool annotations (note: openWorldHint is true for external API)
 * - Strict Zod schema validation
 * - Actionable error messages
 *
 * See: docs/mcp-builder/reference/mcp_best_practices.md
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { WeatherService } from "../../services/weather-service";
import { createSuccessResponse, createErrorResponse, ResponseFormat } from "@axite/shared";
import type { McpContext } from "../server";
import type { WeatherResponse } from "@axite/shared";

// MCP Best Practice: Define input schema with .strict() and descriptive constraints
const GetWeatherInputSchema = z
  .object({
    location: z
      .string()
      .min(1, "Location cannot be empty")
      .max(100, "Location must be 100 characters or less")
      .describe("City name, zip code, or coordinates (e.g., 'New York', '10001', '40.7,-74.0')"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
  })
  .strict(); // MCP Best Practice: Use .strict() to reject unknown parameters

/**
 * Register the get_weather tool
 *
 * TODO: Replace {service} with your app name (e.g., myapp_get_weather)
 */
export function registerGetWeatherTool(server: McpServer, _context: McpContext): void {
  server.tool(
    // MCP Best Practice: Tool names use {service}_action_resource format
    // TODO: Replace {service} with your app name
    "{service}_get_weather",
    `Get current weather and 3-day forecast for any location.

Fetches real-time weather data from an external API with caching for performance.
Free to use - no authentication required.

Args:
  - location: City name, zip code, or coordinates (e.g., 'New York', '10001')
  - response_format: Output format - 'markdown' or 'json' (default: markdown)

Returns current conditions (temperature, humidity, wind) and 3-day forecast.`,
    {
      location: GetWeatherInputSchema.shape.location,
      response_format: GetWeatherInputSchema.shape.response_format,
    },
    // MCP Best Practice: Tool annotations (when SDK supports them)
    // readOnlyHint: true      - This tool only reads data
    // destructiveHint: false  - Never modifies anything
    // idempotentHint: true    - Same location returns same weather (cached)
    // openWorldHint: true     - Calls external weather API
    async (rawParams: Record<string, unknown>): Promise<WeatherResponse> => {
      // Validate and parse input
      const params = GetWeatherInputSchema.parse(rawParams);
      const { location, response_format } = params;

      try {
        // No auth required for free tier tools
        const weatherData = await WeatherService.getWeather(location);

        // MCP Best Practice: Format response based on requested format
        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          textContent = formatAsMarkdown(weatherData);
        } else {
          textContent = `Current weather for ${weatherData.location}: ${weatherData.temperature}°F, ${weatherData.condition}`;
        }

        return createSuccessResponse(
          textContent,
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
          },
          {
            "openai/outputTemplate": "ui://widget/weather.html",
            "openai/toolInvocation/invoked": "Weather loaded",
          }
        );
      } catch (error) {
        logger.error("get_weather failed", { error, location });
        // MCP Best Practice: Actionable error messages
        return createErrorResponse(
          error instanceof Error
            ? `Failed to fetch weather for '${location}': ${error.message}. Please check the location name and try again.`
            : `Failed to fetch weather for '${location}'. Please verify the location and try again.`
        ) as unknown as WeatherResponse;
      }
    }
  );
}

/**
 * Format weather data as human-readable markdown
 */
function formatAsMarkdown(weather: {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  forecast?: Array<{ day: string; high: number; low: number; condition: string }>;
}): string {
  const lines: string[] = [
    `# Weather for ${weather.location}`,
    "",
    "## Current Conditions",
    `- **Temperature**: ${weather.temperature}°F (feels like ${weather.feelsLike}°F)`,
    `- **Condition**: ${weather.condition}`,
    `- **Humidity**: ${weather.humidity}%`,
    `- **Wind**: ${weather.windSpeed} mph`,
    "",
  ];

  if (weather.forecast && weather.forecast.length > 0) {
    lines.push("## 3-Day Forecast");
    for (const day of weather.forecast) {
      lines.push(`- **${day.day}**: ${day.condition}, High ${day.high}°F / Low ${day.low}°F`);
    }
  }

  return lines.join("\n");
}
