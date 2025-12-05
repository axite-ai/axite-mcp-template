/**
 * Calculate ROI Tool
 *
 * Calculates investment returns with compound interest.
 * Demonstrates: Calculations, form-based tools, charts, free tier access
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../../services/logger-service";
import { createSuccessResponse, createErrorResponse } from "@axite/shared";
import type { McpContext } from "../server";
import type { ROICalculatorResponse } from "@axite/shared";

/**
 * Register the calculate_roi tool
 */
export function registerCalculateRoiTool(server: McpServer, _context: McpContext): void {
  server.tool(
    "calculate_roi",
    "Calculate investment returns over time with compound interest. Shows year-by-year breakdown. Free to use!",
    {
      initialInvestment: z
        .number()
        .positive()
        .describe("Initial investment amount in dollars"),
      years: z
        .number()
        .int()
        .positive()
        .max(50)
        .describe("Number of years to project"),
      annualReturn: z
        .number()
        .min(-100)
        .max(100)
        .describe("Expected annual return as percentage (e.g., 7 for 7%)"),
    },
    async ({ initialInvestment, years, annualReturn }): Promise<ROICalculatorResponse> => {
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

        return createSuccessResponse(
          `After ${years} years at ${annualReturn}% annual return, $${initialInvestment.toLocaleString()} would grow to $${Math.round(finalValue).toLocaleString()} (${totalReturn.toFixed(1)}% total return)`,
          {
            inputs: {
              initialInvestment,
              years,
              annualReturn,
            },
            results: {
              finalValue: Math.round(finalValue * 100) / 100,
              totalGain: Math.round(totalGain * 100) / 100,
              totalReturn: Math.round(totalReturn * 100) / 100,
              yearByYear,
            },
            calculatedAt: new Date().toISOString(),
          },
          {
            "openai/outputTemplate": "ui://widget/roi-calculator.html",
            "openai/toolInvocation/invoked": "Calculation complete",
          }
        );
      } catch (error) {
        logger.error("calculate_roi failed", { error });
        return createErrorResponse("Failed to calculate ROI") as unknown as ROICalculatorResponse;
      }
    }
  );
}
