import { describe, it, expect, vi } from "vitest";
import { checkWidgetAuth } from "./widget-auth-check";

// Mock the SubscriptionRequired component
vi.mock("@/app/widgets/subscription-required/widget", () => ({
  default: () => <div data-testid="subscription-required">Subscription Required</div>,
}));

describe("checkWidgetAuth", () => {
  it("should return null when toolOutput is null", () => {
    const result = checkWidgetAuth(null);
    expect(result).toBeNull();
  });

  it("should return null when toolOutput is undefined", () => {
    const result = checkWidgetAuth(undefined);
    expect(result).toBeNull();
  });

  it("should return null when no auth issues detected", () => {
    const toolOutput = {
      items: [],
      count: 0,
    };

    const result = checkWidgetAuth(toolOutput);
    expect(result).toBeNull();
  });

  it("should return SubscriptionRequired component when subscription is required", () => {
    const toolOutput = {
      error_message: "Subscription required",
      featureName: "premium feature",
    };

    const result = checkWidgetAuth(toolOutput);
    expect(result).not.toBeNull();
  });

  it("should handle toolOutput with various properties", () => {
    const cases = [
      { error_message: "Some other error" },
      { message: "Not related to auth" },
      { data: [], error: false },
      {},
    ];

    cases.forEach((toolOutput) => {
      const result = checkWidgetAuth(toolOutput);
      expect(result).toBeNull();
    });
  });

  it("should only trigger on exact 'Subscription required' message", () => {
    const variations = [
      { error_message: "subscription required" }, // lowercase
      { error_message: "SUBSCRIPTION REQUIRED" }, // uppercase
      { error_message: "Subscription Required!" }, // with punctuation
      { error_message: "Subscription" }, // partial
    ];

    variations.forEach((toolOutput) => {
      const result = checkWidgetAuth(toolOutput);
      expect(result).toBeNull();
    });
  });

  it("should return SubscriptionRequired for exact match", () => {
    const toolOutput = {
      error_message: "Subscription required",
    };

    const result = checkWidgetAuth(toolOutput);
    expect(result).not.toBeNull();
  });
});
