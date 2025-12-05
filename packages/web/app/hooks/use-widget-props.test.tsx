import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWidgetProps } from "./use-widget-props";

// Mock useOpenAiGlobal
vi.mock("./use-openai-global", () => ({
  useOpenAiGlobal: vi.fn(),
}));

import { useOpenAiGlobal } from "./use-openai-global";

describe("useWidgetProps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return tool output when available", () => {
    const toolOutput = { userId: "123", name: "Test User" };
    vi.mocked(useOpenAiGlobal).mockReturnValue(toolOutput);

    const { result } = renderHook(() => useWidgetProps<typeof toolOutput>());

    expect(result.current).toEqual(toolOutput);
  });

  it("should return default state when tool output is null", () => {
    vi.mocked(useOpenAiGlobal).mockReturnValue(null);

    const defaultState = { userId: "default", name: "Default User" };
    const { result } = renderHook(() => useWidgetProps(defaultState));

    expect(result.current).toEqual(defaultState);
  });

  it("should call default state function when tool output is null", () => {
    vi.mocked(useOpenAiGlobal).mockReturnValue(null);

    const defaultFn = vi.fn(() => ({ userId: "computed", name: "Computed" }));
    const { result } = renderHook(() => useWidgetProps(defaultFn));

    expect(defaultFn).toHaveBeenCalled();
    expect(result.current).toEqual({ userId: "computed", name: "Computed" });
  });

  it("should return tool output instead of default when tool output is available", () => {
    const toolOutput = { userId: "123", name: "Test" };
    vi.mocked(useOpenAiGlobal).mockReturnValue(toolOutput);

    const defaultFn = vi.fn(() => ({ userId: "computed", name: "Computed" }));
    const { result } = renderHook(() => useWidgetProps(defaultFn));

    // The result should be the tool output, not the computed default
    expect(result.current).toEqual(toolOutput);
    expect(result.current).not.toEqual({ userId: "computed", name: "Computed" });
  });

  it("should return null when no tool output and no default", () => {
    vi.mocked(useOpenAiGlobal).mockReturnValue(null);

    const { result } = renderHook(() => useWidgetProps());

    expect(result.current).toBeNull();
  });

  it("should handle complex structured content", () => {
    const complexOutput = {
      items: [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ],
      metadata: {
        totalCount: 2,
        page: 1,
      },
      nested: {
        deeply: {
          value: 42,
        },
      },
    };
    vi.mocked(useOpenAiGlobal).mockReturnValue(complexOutput);

    const { result } = renderHook(() => useWidgetProps<typeof complexOutput>());

    expect(result.current).toEqual(complexOutput);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.nested.deeply.value).toBe(42);
  });

  it("should call useOpenAiGlobal with 'toolOutput' key", () => {
    vi.mocked(useOpenAiGlobal).mockReturnValue(null);

    renderHook(() => useWidgetProps());

    expect(useOpenAiGlobal).toHaveBeenCalledWith("toolOutput");
  });
});
