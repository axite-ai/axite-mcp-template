/**
 * Test setup for @axite/server package
 *
 * This file runs before each test file.
 */

import { vi, beforeEach, afterEach } from "vitest";

// Mock environment variables for testing
process.env.NODE_ENV = "test";
process.env.WEB_URL = "http://localhost:3000";
process.env.MCP_SERVER_PORT = "3001";

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
