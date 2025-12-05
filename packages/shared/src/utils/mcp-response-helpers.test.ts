import { describe, it, expect } from "vitest";
import {
  createErrorResponse,
  createSuccessResponse,
  createAuthChallengeResponse,
} from "./mcp-response-helpers";

describe("MCP Response Helpers", () => {
  describe("createErrorResponse", () => {
    it("should create an error response with message", () => {
      const response = createErrorResponse("Something went wrong");

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Something went wrong",
      });
      expect(response.structuredContent).toEqual({
        message: "Something went wrong",
      });
    });

    it("should include default metadata", () => {
      const response = createErrorResponse("Error occurred");

      expect(response._meta).toEqual({
        "openai/toolInvocation/invoked": "Error occurred",
      });
    });

    it("should merge custom metadata", () => {
      const response = createErrorResponse("Error occurred", {
        "openai/widgetDescription": "Custom description",
      });

      expect(response._meta).toEqual({
        "openai/toolInvocation/invoked": "Error occurred",
        "openai/widgetDescription": "Custom description",
      });
    });

    it("should allow custom metadata to override defaults", () => {
      const response = createErrorResponse("Error occurred", {
        "openai/toolInvocation/invoked": "Custom invoked message",
      });

      expect(response._meta?.["openai/toolInvocation/invoked"]).toBe(
        "Custom invoked message"
      );
    });
  });

  describe("createSuccessResponse", () => {
    it("should create a success response with text and structured content", () => {
      const response = createSuccessResponse("Found 5 items", {
        items: ["a", "b", "c", "d", "e"],
        count: 5,
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Found 5 items",
      });
      expect(response.structuredContent).toEqual({
        items: ["a", "b", "c", "d", "e"],
        count: 5,
      });
    });

    it("should not include isError field for success responses", () => {
      const response = createSuccessResponse("Success", { data: true });

      expect(response).not.toHaveProperty("isError");
    });

    it("should include metadata when provided", () => {
      const response = createSuccessResponse(
        "Success",
        { data: true },
        {
          "openai/outputTemplate": "ui://widget/test.html",
          "openai/widgetAccessible": true,
        }
      );

      expect(response._meta).toEqual({
        "openai/outputTemplate": "ui://widget/test.html",
        "openai/widgetAccessible": true,
      });
    });

    it("should not include _meta when not provided", () => {
      const response = createSuccessResponse("Success", { data: true });

      expect(response).not.toHaveProperty("_meta");
    });

    it("should handle complex structured content", () => {
      const structuredContent = {
        items: [
          { id: "1", name: "Item 1", nested: { value: 42 } },
          { id: "2", name: "Item 2", nested: { value: 84 } },
        ],
        metadata: {
          page: 1,
          totalPages: 10,
        },
      };

      const response = createSuccessResponse("Complex data", structuredContent);

      expect(response.structuredContent).toEqual(structuredContent);
    });
  });

  describe("createAuthChallengeResponse", () => {
    it("should create an auth challenge response", () => {
      const response = createAuthChallengeResponse(
        "https://example.com/.well-known/oauth-protected-resource"
      );

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Authentication required",
      });
      expect(response.structuredContent).toEqual({
        error: "insufficient_scope",
      });
    });

    it("should include WWW-Authenticate header in metadata", () => {
      const resourceUrl =
        "https://example.com/.well-known/oauth-protected-resource";
      const response = createAuthChallengeResponse(resourceUrl);

      expect(response._meta?.["mcp/www_authenticate"]).toBe(
        `Bearer resource_metadata="${resourceUrl}", error="insufficient_scope", error_description="Authentication required"`
      );
    });

    it("should use custom error description", () => {
      const resourceUrl = "https://example.com/.well-known/oauth";
      const response = createAuthChallengeResponse(
        resourceUrl,
        "Please log in to continue"
      );

      expect(response.content[0]).toEqual({
        type: "text",
        text: "Please log in to continue",
      });
      expect(response._meta?.["mcp/www_authenticate"]).toContain(
        'error_description="Please log in to continue"'
      );
    });
  });
});
