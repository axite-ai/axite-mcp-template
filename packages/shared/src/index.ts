/**
 * Axite MCP Template - Shared Package
 *
 * Shared types and utilities used across both server and web packages.
 * Provides a single source of truth for type definitions and common helpers.
 *
 * Implements MCP best practices from docs/mcp-builder/
 */

// Export constants (CHARACTER_LIMIT, pagination defaults, ResponseFormat enum)
export * from "./constants";

// Export all types (MCPToolResponse, PaginationMeta, etc.)
export * from "./types";

// Export all utils (response helpers, pagination, formatting)
export * from "./utils";

// Export Zod schemas for input validation
export * from "./schemas";
