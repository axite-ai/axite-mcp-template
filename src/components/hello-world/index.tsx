"use client";

import { useToolInfo } from "@/src/mcp-ui-hooks";
import type { HelloWorldContent } from "@/lib/types/tool-responses";

export default function HelloWorldWidget() {
  const { output } = useToolInfo();
  const data = output as { structuredContent: HelloWorldContent } | undefined;

  if (!data?.structuredContent) {
    return <div className="p-4">Loading...</div>;
  }

  const { greeting, name, timestamp } = data.structuredContent;

  return (
    <div className="p-6 bg-surface text-default rounded-lg border border-default">
      <h2 className="text-2xl font-bold mb-4">{greeting}</h2>
      <div className="space-y-2">
        <p>
          <span className="font-semibold">Name:</span> {name}
        </p>
        <p>
          <span className="font-semibold">Time:</span> {new Date(timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
