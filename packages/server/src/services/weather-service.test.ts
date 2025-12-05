import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WeatherService, type WeatherData } from "./weather-service";

// Mock dependencies
vi.mock("./logger-service", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../db/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}));

// Import mocks after setup
const { redis } = await import("../db/redis");

// Sample wttr.in API response
const sampleWttrResponse = {
  current_condition: [
    {
      temp_F: "72",
      weatherDesc: [{ value: "Partly cloudy" }],
      humidity: "65",
      windspeedMiles: "10",
      FeelsLikeF: "74",
    },
  ],
  weather: [
    {
      date: "2025-01-15",
      maxtempF: "78",
      mintempF: "62",
      hourly: [{ weatherDesc: [{ value: "Sunny" }] }],
    },
    {
      date: "2025-01-16",
      maxtempF: "75",
      mintempF: "60",
      hourly: [{ weatherDesc: [{ value: "Cloudy" }] }],
    },
    {
      date: "2025-01-17",
      maxtempF: "73",
      mintempF: "58",
      hourly: [{ weatherDesc: [{ value: "Rain" }] }],
    },
  ],
  nearest_area: [{ areaName: [{ value: "New York" }] }],
};

describe("WeatherService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getWeather", () => {
    it("should return cached data if available", async () => {
      const cachedData: WeatherData = {
        location: "New York",
        temperature: 72,
        condition: "Sunny",
        humidity: 50,
        windSpeed: 5,
        feelsLike: 74,
        forecast: [],
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

      const result = await WeatherService.getWeather("New York");

      expect(result).toEqual(cachedData);
      expect(redis.get).toHaveBeenCalledWith("weather:new york");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should fetch from API when cache is empty", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleWttrResponse),
      } as Response);

      const result = await WeatherService.getWeather("New York");

      expect(result.location).toBe("New York");
      expect(result.temperature).toBe(72);
      expect(result.condition).toBe("Partly cloudy");
      expect(result.humidity).toBe(65);
      expect(result.windSpeed).toBe(10);
      expect(result.feelsLike).toBe(74);
      expect(result.forecast).toHaveLength(3);
    });

    it("should cache fetched data", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleWttrResponse),
      } as Response);

      await WeatherService.getWeather("New York");

      expect(redis.setex).toHaveBeenCalledWith(
        "weather:new york",
        1800, // 30 minutes
        expect.any(String)
      );
    });

    it("should throw error on API failure", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(WeatherService.getWeather("InvalidLocation")).rejects.toThrow(
        "Unable to fetch weather"
      );
    });

    it("should handle invalid API response", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}), // Missing required fields
      } as Response);

      await expect(WeatherService.getWeather("New York")).rejects.toThrow(
        "Invalid weather data received"
      );
    });

    it("should normalize location for cache key", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleWttrResponse),
      } as Response);

      await WeatherService.getWeather("NEW YORK");

      expect(redis.get).toHaveBeenCalledWith("weather:new york");
    });
  });

  describe("clearCache", () => {
    it("should delete cache for location", async () => {
      vi.mocked(redis.del).mockResolvedValue(1);

      await WeatherService.clearCache("New York");

      expect(redis.del).toHaveBeenCalledWith("weather:new york");
    });

    it("should normalize location for cache key", async () => {
      vi.mocked(redis.del).mockResolvedValue(1);

      await WeatherService.clearCache("NEW YORK");

      expect(redis.del).toHaveBeenCalledWith("weather:new york");
    });
  });

  describe("getMultipleLocations", () => {
    it("should fetch weather for multiple locations", async () => {
      const locations = ["New York", "Los Angeles"];
      const cachedData: WeatherData = {
        location: "New York",
        temperature: 72,
        condition: "Sunny",
        humidity: 50,
        windSpeed: 5,
        feelsLike: 74,
        forecast: [],
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

      const results = await WeatherService.getMultipleLocations(locations);

      expect(results).toHaveLength(2);
      expect(redis.get).toHaveBeenCalledTimes(2);
    });

    it("should handle partial failures", async () => {
      vi.mocked(redis.get)
        .mockResolvedValueOnce(
          JSON.stringify({
            location: "New York",
            temperature: 72,
            condition: "Sunny",
            humidity: 50,
            windSpeed: 5,
            feelsLike: 74,
            forecast: [],
          })
        )
        .mockResolvedValueOnce(null);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      const results = await WeatherService.getMultipleLocations([
        "New York",
        "InvalidLocation",
      ]);

      // Should still return successful results
      expect(results).toHaveLength(1);
      expect(results[0].location).toBe("New York");
    });
  });

  describe("parseWttrResponse", () => {
    it("should correctly parse forecast data", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleWttrResponse),
      } as Response);

      const result = await WeatherService.getWeather("New York");

      expect(result.forecast).toHaveLength(3);
      expect(result.forecast?.[0]).toHaveProperty("day");
      expect(result.forecast?.[0]).toHaveProperty("high", 78);
      expect(result.forecast?.[0]).toHaveProperty("low", 62);
      expect(result.forecast?.[0]).toHaveProperty("condition", "Sunny");
    });
  });
});
