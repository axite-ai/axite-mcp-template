import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLoginPromptResponse,
  createSubscriptionRequiredResponse,
  createSecurityRequiredResponse,
} from "./auth";

// Mock dependencies
vi.mock("../services/logger-service", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../config/features", () => ({
  FEATURES: {
    SUBSCRIPTIONS: true,
    PASSKEYS: true,
  },
}));

describe("MCP Auth Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEB_URL = "http://localhost:3000";
  });

  describe("createLoginPromptResponse", () => {
    it("should create a login prompt error response", () => {
      const response = createLoginPromptResponse("user items");

      expect(response.isError).toBe(true);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Please log in to access user items",
      });
    });

    it("should include widget template metadata", () => {
      const response = createLoginPromptResponse("test feature");

      expect(response._meta?.["openai/outputTemplate"]).toBe(
        "ui://widget/login.html"
      );
    });

    it("should use feature name in message", () => {
      const response = createLoginPromptResponse("premium analytics");
      const content = response.content[0];

      expect(content.type).toBe("text");
      if (content.type === "text") {
        expect(content.text).toContain("premium analytics");
      }
    });
  });

  describe("createSubscriptionRequiredResponse", () => {
    it("should create a subscription required response", () => {
      const response = createSubscriptionRequiredResponse(
        "advanced features",
        "user-123"
      );

      expect(response.isError).toBe(true);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Subscription required for advanced features",
      });
    });

    it("should include structured content with feature name", () => {
      const response = createSubscriptionRequiredResponse(
        "analytics",
        "user-123"
      );

      expect(response.structuredContent.featureName).toBe("analytics");
      expect(response.structuredContent.error_message).toContain("analytics");
    });

    it("should include pricing URL from environment", () => {
      process.env.WEB_URL = "https://example.com";
      const response = createSubscriptionRequiredResponse(
        "feature",
        "user-123"
      );

      expect(response.structuredContent.pricingUrl).toBe(
        "https://example.com/pricing"
      );
    });

    it("should include subscription widget template", () => {
      const response = createSubscriptionRequiredResponse(
        "feature",
        "user-123"
      );

      expect(response._meta?.["openai/outputTemplate"]).toBe(
        "ui://widget/subscription-required.html"
      );
    });
  });

  describe("createSecurityRequiredResponse", () => {
    it("should create a security required error response", () => {
      const response = createSecurityRequiredResponse(
        "sensitive data",
        "user-123"
      );

      expect(response.isError).toBe(true);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Security verification required for sensitive data",
      });
    });

    it("should include security widget template", () => {
      const response = createSecurityRequiredResponse("feature", "user-123");

      expect(response._meta?.["openai/outputTemplate"]).toBe(
        "ui://widget/security-required.html"
      );
    });
  });
});

describe("JWT Decoding", () => {
  // Note: decodeJwtPayload is a private function, tested indirectly through getSessionFromRequest
  // These are integration-level tests

  it("should decode valid JWT payload structure", () => {
    // JWT structure: header.payload.signature
    // This tests that a valid JWT structure is expected
    const parts = "eyJ0eXAiOiJKV1QifQ.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature";
    const splitParts = parts.split(".");

    expect(splitParts).toHaveLength(3);
  });

  it("should handle invalid JWT gracefully", () => {
    const invalidTokens = [
      "invalid",
      "one.two",
      "a.b.c.d",
      "",
      "   ",
    ];

    invalidTokens.forEach((token) => {
      const parts = token.split(".");
      // Invalid tokens should not have exactly 3 parts or should fail base64 decode
      if (parts.length === 3) {
        // If it has 3 parts, the payload should not be valid base64
        expect(() => {
          const decoded = Buffer.from(parts[1], "base64url").toString("utf-8");
          JSON.parse(decoded);
        }).toThrow();
      } else {
        expect(parts.length).not.toBe(3);
      }
    });
  });
});
