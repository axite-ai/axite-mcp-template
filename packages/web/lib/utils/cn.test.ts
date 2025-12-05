import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn (className utility)", () => {
  it("should merge simple class names", () => {
    const result = cn("foo", "bar");
    expect(result).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    const result = cn("base", isActive && "active");
    expect(result).toBe("base active");
  });

  it("should filter out falsy values", () => {
    const result = cn("base", false, null, undefined, "", "valid");
    expect(result).toBe("base valid");
  });

  it("should handle array of classes", () => {
    const result = cn(["foo", "bar"], "baz");
    expect(result).toBe("foo bar baz");
  });

  it("should handle object syntax", () => {
    const result = cn({
      foo: true,
      bar: false,
      baz: true,
    });
    expect(result).toBe("foo baz");
  });

  it("should merge Tailwind classes correctly", () => {
    // twMerge should resolve conflicts
    const result = cn("p-4", "p-2");
    expect(result).toBe("p-2");
  });

  it("should handle conflicting Tailwind utilities", () => {
    // Later classes should override earlier ones
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("should preserve non-conflicting Tailwind classes", () => {
    const result = cn("p-4", "m-2", "text-lg");
    expect(result).toBe("p-4 m-2 text-lg");
  });

  it("should handle responsive prefixes", () => {
    const result = cn("p-2", "md:p-4", "lg:p-6");
    expect(result).toBe("p-2 md:p-4 lg:p-6");
  });

  it("should handle hover/focus states", () => {
    const result = cn("bg-blue-500", "hover:bg-blue-600", "focus:bg-blue-700");
    expect(result).toBe("bg-blue-500 hover:bg-blue-600 focus:bg-blue-700");
  });

  it("should handle empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("should handle complex mixed input", () => {
    const isError = true;
    const result = cn(
      "base-class",
      ["array-class-1", "array-class-2"],
      {
        "object-class-true": true,
        "object-class-false": false,
      },
      isError && "error-class",
      "p-4",
      "p-2" // should override p-4
    );
    expect(result).toContain("base-class");
    expect(result).toContain("array-class-1");
    expect(result).toContain("object-class-true");
    expect(result).not.toContain("object-class-false");
    expect(result).toContain("error-class");
    expect(result).toBe(
      "base-class array-class-1 array-class-2 object-class-true error-class p-2"
    );
  });
});
