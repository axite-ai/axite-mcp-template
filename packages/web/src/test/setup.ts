/**
 * Test setup for @axite/web package
 *
 * This file runs before each test file.
 * Sets up testing-library, mocks, and global test utilities.
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import "@testing-library/jest-dom";

// Mock environment variables
// @ts-expect-error - NODE_ENV is read-only in Next.js types but can be set in tests
process.env.NODE_ENV = "test";
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

// Mock window.openai for ChatGPT SDK
const mockOpenAI = {
  openExternal: vi.fn(),
  requestDisplayMode: vi.fn(),
  callTool: vi.fn(),
  sendMessage: vi.fn(),
};

Object.defineProperty(window, "openai", {
  value: mockOpenAI,
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Suppress console errors/warnings in tests unless explicitly testing them
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() || "";
    const ignoredPatterns = [
      /Warning: ReactDOM.render/,
      /Not implemented: HTMLFormElement.prototype.submit/,
      /act\(\.\.\.\)/,
    ];

    if (!ignoredPatterns.some((pattern) => pattern.test(message))) {
      originalConsoleError(...args);
    }
  };

  console.warn = (...args: unknown[]) => {
    const message = args[0]?.toString() || "";
    const ignoredPatterns = [/componentWillReceiveProps/, /React Router/];

    if (!ignoredPatterns.some((pattern) => pattern.test(message))) {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Export mocks for use in tests
export { mockOpenAI };
