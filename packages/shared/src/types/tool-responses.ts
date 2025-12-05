/**
 * Type definitions for tool-specific structured content
 * TEMPLATE: Define your own tool response types here
 */

import type { MCPToolResponse, OpenAIResponseMetadata } from "./mcp-responses";
import { z } from "zod";

// ============================================================================
// COMMON AUTH/ERROR RESPONSES
// ============================================================================

/**
 * Common Auth Challenge Content
 * Used when a tool requires authentication or subscription
 */
export interface AuthChallengeContent extends Record<string, unknown> {
  message: string;
  featureName?: string;
  error_message?: string;
  pricingUrl?: string;
  baseUrl?: string;
  setupUrl?: string;
}

/**
 * Auth Challenge Response Type
 * Returned by requireAuth() helper and auth response builders
 */
export type AuthChallengeResponse = MCPToolResponse<
  AuthChallengeContent,
  OpenAIResponseMetadata
>;

/**
 * Common Auth/Error Response Schema (for validation)
 * Used when a tool requires authentication or subscription
 */
export const AuthResponseSchema = z.union([
  // Login prompt
  z.object({
    message: z.string(),
  }),
  // Subscription required
  z.object({
    featureName: z.string(),
    error_message: z.string(),
    pricingUrl: z.string(),
  }),
  // Security required
  z.object({
    message: z.string(),
    baseUrl: z.string(),
    featureName: z.string(),
    setupUrl: z.string(),
  }),
]);

// ============================================================================
// EXAMPLE TOOL RESPONSE TYPES
// TEMPLATE: Replace these with your own tool response types
// ============================================================================

/**
 * User Items List - GET operation
 * Demonstrates a simple data display tool
 */
export interface UserItemsContent extends Record<string, unknown> {
  items: Array<{
    id: string;
    title: string;
    description?: string;
    status: "active" | "archived" | "deleted";
    order: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
  totalItems: number;
  displayedItems: number;
}

/**
 * Manage Item - CRUD operations
 * Demonstrates create/update/delete operations
 */
export interface ManageItemContent extends Record<string, unknown> {
  item: {
    id: string;
    title: string;
    description?: string;
    status: "active" | "archived" | "deleted";
    order: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  action: "created" | "updated" | "deleted" | "archived" | "restored";
  message: string;
}

/**
 * Weather Data
 * Demonstrates external API integration
 */
export interface WeatherContent extends Record<string, unknown> {
  location: string;
  current: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    feelsLike: number;
  };
  forecast?: Array<{
    day: string;
    high: number;
    low: number;
    condition: string;
  }>;
  lastUpdated: string;
}

/**
 * ROI Calculator
 * Demonstrates calculation/form-based tool
 */
export interface ROICalculatorContent extends Record<string, unknown> {
  inputs: {
    initialInvestment: number;
    years: number;
    annualReturn: number;
  };
  results: {
    finalValue: number;
    totalGain: number;
    totalReturn: number; // percentage
    yearByYear: Array<{
      year: number;
      value: number;
      gain: number;
    }>;
  };
  calculatedAt: string;
}

/**
 * Subscription Management
 * Shows current subscription and billing portal link
 */
export interface ManageSubscriptionContent extends Record<string, unknown> {
  subscription: {
    plan: string;
    status: string;
    periodStart?: string;
    periodEnd?: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  portalUrl: string;
  message: string;
}

// ============================================================================
// RESPONSE TYPE ALIASES
// Makes it easier to use these types in tool handlers
// ============================================================================

export type UserItemsResponse = MCPToolResponse<
  UserItemsContent,
  OpenAIResponseMetadata
> | AuthChallengeResponse;

export type ManageItemResponse = MCPToolResponse<
  ManageItemContent,
  OpenAIResponseMetadata
> | AuthChallengeResponse;

export type WeatherResponse = MCPToolResponse<
  WeatherContent,
  OpenAIResponseMetadata
>;

export type ROICalculatorResponse = MCPToolResponse<
  ROICalculatorContent,
  OpenAIResponseMetadata
>;

export type ManageSubscriptionResponse = MCPToolResponse<
  ManageSubscriptionContent,
  OpenAIResponseMetadata
> | AuthChallengeResponse;

// ============================================================================
// TEMPLATE: Add your own tool response types below
// ============================================================================

/*
// Example: Custom tool response type
export interface MyCustomToolContent {
  data: string[];
  count: number;
  metadata?: Record<string, unknown>;
}

export type MyCustomToolResponse = MCPToolResponse<
  MyCustomToolContent,
  OpenAIResponseMetadata
>;
*/
