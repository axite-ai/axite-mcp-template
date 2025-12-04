"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import type { ManageItemContent } from "@/lib/types/tool-responses";

interface ToolOutput extends Record<string, unknown> {
  structuredContent: ManageItemContent;
}

export default function ManageItemWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();

  // Check authentication
  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No item data available</p>
      </div>
    );
  }

  const { item, action, message } = toolOutput.structuredContent;

  const actionColors: Record<string, string> = {
    created: "bg-green-50 border-green-200 text-green-900",
    updated: "bg-blue-50 border-blue-200 text-blue-900",
    deleted: "bg-red-50 border-red-200 text-red-900",
    archived: "bg-gray-50 border-gray-200 text-gray-900",
  };

  const actionIcons: Record<string, string> = {
    created: "✅",
    updated: "✏️",
    deleted: "🗑️",
    archived: "📦",
  };

  return (
    <div className="p-6">
      <div className={`rounded-lg border-2 p-6 ${actionColors[action]}`}>
        <div className="text-4xl mb-4">{actionIcons[action]}</div>
        <h2 className="text-2xl font-bold mb-2">
          Item {action.charAt(0).toUpperCase() + action.slice(1)}
        </h2>
        <p className="text-lg mb-6">{message}</p>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
          {item.description && (
            <p className="text-gray-600 mb-3">{item.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span
              className={`px-2 py-1 rounded-full ${
                item.status === "active"
                  ? "bg-green-100 text-green-800"
                  : item.status === "archived"
                    ? "bg-gray-100 text-gray-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {item.status}
            </span>
            <span>ID: {item.id}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600 text-center">
        Use "get_user_items" to see all your items
      </div>
    </div>
  );
}
