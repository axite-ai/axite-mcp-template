/**
 * User Items Widget Component
 *
 * Displays a list of user items from the get_user_items MCP tool.
 * TEMPLATE: Use this as a reference for creating data display widgets.
 *
 * Key patterns:
 * 1. Hydrate ONLY from toolOutput (never call server actions on mount)
 * 2. Use checkWidgetAuth() for auth checks
 * 3. Handle empty states gracefully
 * 4. Keep widgets read-only unless user explicitly interacts
 */

"use client";

import { useWidgetProps } from "@/src/use-widget-props";
import { checkWidgetAuth } from "@/src/utils/widget-auth-check";
import type { UserItemsContent } from "@/lib/types/tool-responses";

interface ToolOutput extends Record<string, unknown> {
  structuredContent: UserItemsContent;
}

export default function UserItemsWidget() {
  const toolOutput = useWidgetProps<ToolOutput>();

  // Check authentication (handles login, subscription, etc.)
  const authComponent = checkWidgetAuth(toolOutput);
  if (authComponent) return authComponent;

  // Handle empty or missing data
  if (!toolOutput?.structuredContent) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500">
          <p className="text-lg font-medium">No items yet</p>
          <p className="text-sm mt-2">
            Use the "manage_item" tool to create your first item.
          </p>
        </div>
      </div>
    );
  }

  const { items, totalItems } = toolOutput.structuredContent;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Your Items</h2>
        <p className="text-sm text-gray-600 mt-1">
          {totalItems} item{totalItems !== 1 ? "s" : ""} total
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No items to display</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-gray-600 mt-1 text-sm">
                      {item.description}
                    </p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    item.status === "active"
                      ? "bg-green-100 text-green-800"
                      : item.status === "archived"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                {item.metadata && (
                  <span className="ml-auto">Has metadata</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Use the "manage_item" tool to create, update, or
          delete items.
        </p>
      </div>
    </div>
  );
}
