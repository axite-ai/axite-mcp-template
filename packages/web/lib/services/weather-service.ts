/**
 * Weather Service
 *
 * Demonstrates external API integration with caching and error handling
 * TEMPLATE: Use this as a reference for integrating third-party APIs
 *
 * Uses wttr.in - a free weather API that doesn't require an API key
 * Alternative: OpenWeatherMap (requires API key)
 */

import { logger } from "./logger-service";
import { redis } from "@/lib/db/redis";

export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  forecast?: {
    day: string;
    high: number;
    low: number;
    condition: string;
  }[];
}

export class WeatherService {
  private static CACHE_TTL = 1800; // 30 minutes cache
  private static CACHE_PREFIX = "weather:";

  /**
   * Get weather data for a location
   *
   * @param location - City name, zip code, or coordinates
   * @returns Weather data with current conditions and 3-day forecast
   */
  static async getWeather(location: string): Promise<WeatherData> {
    try {
      logger.info("Fetching weather", { location });

      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${location.toLowerCase()}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.info("Weather data found in cache", { location });
        return JSON.parse(cached);
      }

      // Fetch from wttr.in API
      const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Axite-MCP-Template/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse wttr.in response
      const weatherData = this.parseWttrResponse(data, location);

      // Cache the result
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(weatherData));

      logger.info("Weather data fetched and cached", { location });
      return weatherData;
    } catch (error) {
      logger.error("Failed to fetch weather", { error, location });
      throw new Error(
        `Unable to fetch weather for ${location}. ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse wttr.in API response into our standardized format
   */
  private static parseWttrResponse(data: any, location: string): WeatherData {
    const current = data.current_condition?.[0];
    const weather = data.weather;

    if (!current || !weather) {
      throw new Error("Invalid weather data received");
    }

    // Parse forecast (next 3 days)
    const forecast = weather.slice(0, 3).map((day: any) => ({
      day: new Date(day.date).toLocaleDateString("en-US", { weekday: "short" }),
      high: parseInt(day.maxtempF),
      low: parseInt(day.mintempF),
      condition: day.hourly?.[0]?.weatherDesc?.[0]?.value || "Unknown",
    }));

    return {
      location: data.nearest_area?.[0]?.areaName?.[0]?.value || location,
      temperature: parseInt(current.temp_F),
      condition: current.weatherDesc?.[0]?.value || "Unknown",
      humidity: parseInt(current.humidity),
      windSpeed: parseInt(current.windspeedMiles),
      feelsLike: parseInt(current.FeelsLikeF),
      forecast,
    };
  }

  /**
   * Clear weather cache for a location
   */
  static async clearCache(location: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${location.toLowerCase()}`;
      await redis.del(cacheKey);
      logger.info("Weather cache cleared", { location });
    } catch (error) {
      logger.error("Failed to clear weather cache", { error, location });
      throw error;
    }
  }

  /**
   * Get multiple locations weather data
   * Useful for dashboard views
   */
  static async getMultipleLocations(locations: string[]): Promise<WeatherData[]> {
    try {
      logger.info("Fetching weather for multiple locations", {
        count: locations.length,
      });

      const promises = locations.map((location) => this.getWeather(location));
      const results = await Promise.allSettled(promises);

      const weatherData: WeatherData[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          weatherData.push(result.value);
        } else {
          logger.warn("Failed to fetch weather for location", {
            location: locations[index],
            error: result.reason,
          });
        }
      });

      return weatherData;
    } catch (error) {
      logger.error("Failed to fetch multiple weather locations", { error });
      throw error;
    }
  }
}

// TEMPLATE: Alternative implementation using OpenWeatherMap
// Uncomment and configure if you prefer OpenWeatherMap
/*
export class OpenWeatherMapService {
  private static API_KEY = process.env.OPENWEATHERMAP_API_KEY;
  private static BASE_URL = "https://api.openweathermap.org/data/2.5";

  static async getWeather(location: string): Promise<WeatherData> {
    if (!this.API_KEY) {
      throw new Error("OpenWeatherMap API key not configured");
    }

    const url = `${this.BASE_URL}/weather?q=${encodeURIComponent(location)}&appid=${this.API_KEY}&units=imperial`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      location: data.name,
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
      feelsLike: Math.round(data.main.feels_like),
    };
  }
}
*/
