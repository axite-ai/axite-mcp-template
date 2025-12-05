import { describe, it, expect } from "vitest";
import {
  createTextContent,
  createImageContent,
  createResourceContent,
  createMCPResponse,
} from "./mcp-responses";

describe("MCP Response Type Helpers", () => {
  describe("createTextContent", () => {
    it("should create text content with type literal", () => {
      const content = createTextContent("Hello, world!");

      expect(content).toEqual({
        type: "text",
        text: "Hello, world!",
      });
      // Verify type literal is exactly "text"
      expect(content.type).toBe("text");
    });

    it("should include metadata when provided", () => {
      const content = createTextContent("Hello", { priority: "high" });

      expect(content).toEqual({
        type: "text",
        text: "Hello",
        _meta: { priority: "high" },
      });
    });

    it("should not include _meta when not provided", () => {
      const content = createTextContent("No meta");

      expect(content).not.toHaveProperty("_meta");
    });
  });

  describe("createImageContent", () => {
    it("should create image content with type literal", () => {
      const base64Data = "iVBORw0KGgo...";
      const content = createImageContent(base64Data, "image/png");

      expect(content).toEqual({
        type: "image",
        data: base64Data,
        mimeType: "image/png",
      });
      expect(content.type).toBe("image");
    });

    it("should support different mime types", () => {
      const jpegContent = createImageContent("data", "image/jpeg");
      const webpContent = createImageContent("data", "image/webp");
      const gifContent = createImageContent("data", "image/gif");

      expect(jpegContent.type).toBe("image");
      expect(webpContent.type).toBe("image");
      expect(gifContent.type).toBe("image");
    });

    it("should include metadata when provided", () => {
      const content = createImageContent("data", "image/png", {
        width: 800,
        height: 600,
      });

      expect(content._meta).toEqual({ width: 800, height: 600 });
    });
  });

  describe("createResourceContent", () => {
    it("should create resource content with text", () => {
      const content = createResourceContent("file://example.txt", {
        text: "File content here",
        mimeType: "text/plain",
      });

      expect(content).toEqual({
        type: "resource",
        resource: {
          uri: "file://example.txt",
          text: "File content here",
          mimeType: "text/plain",
        },
      });
      expect(content.type).toBe("resource");
    });

    it("should create resource content with blob", () => {
      const content = createResourceContent("file://binary.bin", {
        blob: "base64encodeddata",
        mimeType: "application/octet-stream",
      });

      expect(content).toEqual({
        type: "resource",
        resource: {
          uri: "file://binary.bin",
          blob: "base64encodeddata",
          mimeType: "application/octet-stream",
        },
      });
    });

    it("should work without mimeType", () => {
      const content = createResourceContent("file://test.txt", {
        text: "Content",
      });

      expect(content.type).toBe("resource");
      if (content.type === "resource") {
        expect(content.resource.uri).toBe("file://test.txt");
      }
    });

    it("should include metadata when provided", () => {
      const content = createResourceContent(
        "file://test.txt",
        { text: "Content" },
        { size: 1024 }
      );

      expect(content._meta).toEqual({ size: 1024 });
    });
  });

  describe("createMCPResponse", () => {
    it("should create a minimal response with just content", () => {
      const response = createMCPResponse([createTextContent("Hello")]);

      expect(response).toEqual({
        content: [{ type: "text", text: "Hello" }],
      });
    });

    it("should include structured content when provided", () => {
      const response = createMCPResponse([createTextContent("Data")], {
        structuredContent: { items: [], count: 0 },
      });

      expect(response).toEqual({
        content: [{ type: "text", text: "Data" }],
        structuredContent: { items: [], count: 0 },
      });
    });

    it("should include metadata when provided", () => {
      const response = createMCPResponse([createTextContent("Data")], {
        _meta: {
          "openai/outputTemplate": "ui://widget/test.html",
        },
      });

      expect(response._meta).toEqual({
        "openai/outputTemplate": "ui://widget/test.html",
      });
    });

    it("should include isError when provided", () => {
      const response = createMCPResponse([createTextContent("Error")], {
        isError: true,
      });

      expect(response.isError).toBe(true);
    });

    it("should handle complex responses with all options", () => {
      const response = createMCPResponse(
        [
          createTextContent("Complex response"),
          createImageContent("imagedata", "image/png"),
        ],
        {
          structuredContent: {
            status: "success",
            data: { nested: { value: 42 } },
          },
          _meta: {
            "openai/widgetAccessible": true,
            "openai/widgetDescription": "Test widget",
          },
          isError: false,
        }
      );

      expect(response.content).toHaveLength(2);
      expect(response.structuredContent).toEqual({
        status: "success",
        data: { nested: { value: 42 } },
      });
      expect(response._meta).toEqual({
        "openai/widgetAccessible": true,
        "openai/widgetDescription": "Test widget",
      });
      expect(response.isError).toBe(false);
    });

    it("should not include undefined fields", () => {
      const response = createMCPResponse([createTextContent("Minimal")], {});

      expect(response).not.toHaveProperty("structuredContent");
      expect(response).not.toHaveProperty("_meta");
      expect(response).not.toHaveProperty("isError");
    });
  });
});
