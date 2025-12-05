/**
 * Get Weather Tool
 *
 * Fetches current weather and forecast for a location.
 * Demonstrates: External API integration, caching, free tier access
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { WeatherService } from "../../services/weather-service";
import { createSuccessResponse, createErrorResponse } from "@axite/shared";
import type { McpContext } from "../server";
import type { WeatherResponse } from "@axite/shared";

/**
 * Register the get_weather tool
 */
export function registerGetWeatherTool(server: McpServer, _context: McpContext): void {
  server.tool(
    "get_weather",
    "Get current weather and 3-day forecast for any location. Demonstrates external API integration. Free to use!",
    {
      location: z
        .string()
        .describe("City name, zip code, or coordinates (e.g., 'New York', '10001')"),
    },
    async ({ location }): Promise<WeatherResponse> => {
      try {
        // No auth required for free tier tools
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
          },
          {
            "openai/outputTemplate": "ui://widget/weather.html",
            "openai/toolInvocation/invoked": "Weather loaded",
          }
        );
      } catch (error) {
        logger.error("get_weather failed", { error, location });
        return createErrorResponse(
          error instanceof Error ? error.message : "Failed to fetch weather data"
        ) as unknown as WeatherResponse;
      }
    }
  );
}
