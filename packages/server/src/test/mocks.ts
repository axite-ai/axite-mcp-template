/**
 * Test mocks for @axite/server package
 *
 * Provides reusable mocks for database, services, and external dependencies.
 */

import { vi } from "vitest";
import type { McpSession } from "../mcp/auth";

// Mock session factory
export function createMockSession(overrides: Partial<McpSession> = {}): McpSession {
  return {
    userId: "test-user-id",
    scopes: ["read", "write"],
    ...overrides,
  };
}

// Mock request factory
export function createMockRequest(options: {
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
} = {}) {
  return {
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
  };
}

// Database mock helpers
export const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

// Logger mock
export const mockLogger: Record<string, ReturnType<typeof vi.fn>> = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
