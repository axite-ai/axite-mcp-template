"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import type { WeatherContent } from "@/lib/types/tool-responses";

interface ToolOutput extends Record<string, unknown> {
  structuredContent: WeatherContent;
}

export default function WeatherWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();

  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No weather data available</p>
      </div>
    );
  }

  const { location, current, forecast } = toolOutput.structuredContent;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{location}</h2>

      <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg p-6 text-white mb-6">
        <div className="text-5xl font-bold">{current.temperature}°F</div>
        <div className="text-xl mt-2">{current.condition}</div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-75">Feels Like</div>
            <div className="font-semibold">{current.feelsLike}°F</div>
          </div>
          <div>
            <div className="opacity-75">Humidity</div>
            <div className="font-semibold">{current.humidity}%</div>
          </div>
          <div>
            <div className="opacity-75">Wind</div>
            <div className="font-semibold">{current.windSpeed} mph</div>
          </div>
        </div>
      </div>

      {forecast && forecast.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">3-Day Forecast</h3>
          <div className="grid grid-cols-3 gap-3">
            {forecast.map((day: any, idx: number) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="font-semibold text-gray-900">{day.day}</div>
                <div className="text-sm text-gray-600 my-2">{day.condition}</div>
                <div className="text-sm">
                  <span className="text-red-600 font-medium">{day.high}°</span>
                  {" / "}
                  <span className="text-blue-600 font-medium">{day.low}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
