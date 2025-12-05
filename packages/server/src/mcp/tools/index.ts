/**
 * MCP Tools Index
 *
 * Re-exports all tool registration functions.
 * To add a new tool:
 * 1. Create a new file in this directory (e.g., my-tool.ts)
 * 2. Export a registerMyTool function
 * 3. Add the export here
 * 4. Import and call it in ../server.ts
 */

export { registerGetUserItemsTool } from "./get-user-items";
export { registerManageItemTool } from "./manage-item";
export { registerGetWeatherTool } from "./get-weather";
export { registerCalculateRoiTool } from "./calculate-roi";
export { registerManageSubscriptionTool } from "./manage-subscription";
