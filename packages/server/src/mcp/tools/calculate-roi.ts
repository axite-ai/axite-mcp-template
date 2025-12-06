/**
 * Calculate ROI Tool
 *
 * Calculates investment returns with compound interest.
 * Demonstrates: Calculations, form-based tools, charts, free tier access
 *
 * MCP Best Practices implemented:
 * - Tool naming with {service}_ prefix placeholder
 * - All four tool annotations
 * - Strict Zod schema validation with descriptive constraints
 * - Response format support
 *
 * See: docs/mcp-builder/reference/mcp_best_practices.md
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { createSuccessResponse, createErrorResponse, ResponseFormat } from "@axite/shared";
import type { McpContext } from "../server";
import type { ROICalculatorResponse } from "@axite/shared";

// MCP Best Practice: Define input schema with .strict() and descriptive constraints
const CalculateRoiInputSchema = z
  .object({
    initialInvestment: z
      .number()
      .positive("Initial investment must be positive")
      .max(1_000_000_000_000, "Investment exceeds maximum allowed value")
      .describe("Initial investment amount in dollars (e.g., 10000)"),
    years: z
      .number()
      .int("Years must be a whole number")
      .positive("Years must be positive")
      .max(50, "Maximum projection is 50 years")
      .describe("Number of years to project (1-50)"),
    annualReturn: z
      .number()
      .min(-100, "Return cannot be less than -100%")
      .max(100, "Return cannot exceed 100%")
      .describe("Expected annual return as percentage (e.g., 7 for 7%, -5 for -5%)"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
  })
  .strict(); // MCP Best Practice: Use .strict() to reject unknown parameters

/**
 * Register the calculate_roi tool
 *
 * TODO: Replace {service} with your app name (e.g., myapp_calculate_roi)
 */
export function registerCalculateRoiTool(server: McpServer, _context: McpContext): void {
  server.tool(
    // MCP Best Practice: Tool names use {service}_action_resource format
    // TODO: Replace {service} with your app name
    "{service}_calculate_roi",
    `Calculate investment returns over time with compound interest.

Computes year-by-year investment growth with compound interest.
Free to use - no authentication required.

Args:
  - initialInvestment: Starting amount in dollars (e.g., 10000)
  - years: Number of years to project, 1-50
  - annualReturn: Expected annual return percentage (e.g., 7 for 7%)
  - response_format: Output format - 'markdown' or 'json' (default: markdown)

Returns final value, total gain, and year-by-year breakdown.`,
    {
      initialInvestment: CalculateRoiInputSchema.shape.initialInvestment,
      years: CalculateRoiInputSchema.shape.years,
      annualReturn: CalculateRoiInputSchema.shape.annualReturn,
      response_format: CalculateRoiInputSchema.shape.response_format,
    },
    // MCP Best Practice: Tool annotations (when SDK supports them)
    // readOnlyHint: true      - This tool only performs calculations
    // destructiveHint: false  - Never modifies anything
    // idempotentHint: true    - Same inputs always produce same results
    // openWorldHint: false    - Pure calculation, no external calls
    async (rawParams: Record<string, unknown>): Promise<ROICalculatorResponse> => {
      // Validate and parse input
      const params = CalculateRoiInputSchema.parse(rawParams);
      const { initialInvestment, years, annualReturn, response_format } = params;

      try {
        // No auth required for free tier tools

        // Calculate year-by-year returns
        const yearByYear = [];
        let currentValue = initialInvestment;

        for (let year = 1; year <= years; year++) {
          const gain = currentValue * (annualReturn / 100);
          currentValue += gain;

          yearByYear.push({
            year,
            value: Math.round(currentValue * 100) / 100,
            gain: Math.round(gain * 100) / 100,
          });
        }

        const finalValue = currentValue;
        const totalGain = finalValue - initialInvestment;
        const totalReturn = (totalGain / initialInvestment) * 100;

        const results = {
          finalValue: Math.round(finalValue * 100) / 100,
          totalGain: Math.round(totalGain * 100) / 100,
          totalReturn: Math.round(totalReturn * 100) / 100,
          yearByYear,
        };

        // MCP Best Practice: Format response based on requested format
        let textContent: string;
        if (response_format === ResponseFormat.MARKDOWN) {
          textContent = formatAsMarkdown(initialInvestment, years, annualReturn, results);
        } else {
          textContent = `$${initialInvestment.toLocaleString()} at ${annualReturn}% for ${years} years = $${Math.round(finalValue).toLocaleString()} (${totalReturn.toFixed(1)}% total return)`;
        }

        return createSuccessResponse(
          textContent,
          {
            inputs: {
              initialInvestment,
              years,
              annualReturn,
            },
            results,
            calculatedAt: new Date().toISOString(),
          },
          {
            "openai/outputTemplate": "ui://widget/roi-calculator.html",
            "openai/toolInvocation/invoked": "Calculation complete",
          }
        );
      } catch (error) {
        logger.error("calculate_roi failed", { error });
        // MCP Best Practice: Actionable error messages
        return createErrorResponse(
          error instanceof Error
            ? `ROI calculation failed: ${error.message}. Please verify your inputs.`
            : "ROI calculation failed. Please check your inputs and try again."
        ) as unknown as ROICalculatorResponse;
      }
    }
  );
}

/**
 * Format ROI results as human-readable markdown
 */
function formatAsMarkdown(
  initialInvestment: number,
  years: number,
  annualReturn: number,
  results: {
    finalValue: number;
    totalGain: number;
    totalReturn: number;
    yearByYear: Array<{ year: number; value: number; gain: number }>;
  }
): string {
  const lines: string[] = [
    "# Investment Return Projection",
    "",
    "## Inputs",
    `- **Initial Investment**: $${initialInvestment.toLocaleString()}`,
    `- **Time Horizon**: ${years} years`,
    `- **Annual Return**: ${annualReturn}%`,
    "",
    "## Results",
    `- **Final Value**: $${results.finalValue.toLocaleString()}`,
    `- **Total Gain**: $${results.totalGain.toLocaleString()}`,
    `- **Total Return**: ${results.totalReturn.toFixed(1)}%`,
    "",
    "## Year-by-Year Breakdown",
    "",
    "| Year | Value | Annual Gain |",
    "|------|-------|-------------|",
  ];

  for (const year of results.yearByYear) {
    lines.push(
      `| ${year.year} | $${year.value.toLocaleString()} | $${year.gain.toLocaleString()} |`
    );
  }

  return lines.join("\n");
}
