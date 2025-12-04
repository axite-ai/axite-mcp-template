"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import type { ROICalculatorContent } from "@/lib/types/tool-responses";

interface ToolOutput extends Record<string, unknown> {
  structuredContent: ROICalculatorContent;
}

export default function ROICalculatorWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();

  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No calculation data available</p>
      </div>
    );
  }

  const { inputs, results } = toolOutput.structuredContent;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">ROI Calculation Results</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">Initial Investment</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">
            ${inputs.initialInvestment.toLocaleString()}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">Final Value</div>
          <div className="text-2xl font-bold text-green-900 mt-1">
            ${results.finalValue.toLocaleString()}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600 font-medium">Total Return</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">
            {results.totalReturn.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="text-lg font-semibold mb-2">Total Gain</div>
        <div className="text-3xl font-bold text-green-600">
          +${results.totalGain.toLocaleString()}
        </div>
        <div className="text-sm text-gray-600 mt-2">
          Over {inputs.years} years at {inputs.annualReturn}% annual return
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Year-by-Year Breakdown</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.yearByYear.map((year: { year: number; value: number; gain: number }) => (
            <div
              key={year.year}
              className="flex items-center justify-between bg-white border border-gray-200 rounded p-3"
            >
              <div className="font-medium">Year {year.year}</div>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-600">Value: </span>
                  <span className="font-semibold">${year.value.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Gain: </span>
                  <span className="font-semibold text-green-600">
                    +${year.gain.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
