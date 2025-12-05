/**
 * Canonical Hooks Location
 *
 * All widget/ChatGPT related hooks are exported from here.
 * Import from "@/app/hooks" to use these hooks.
 */

// OpenAI API hooks
export { useCallTool } from "./use-call-tool";
export { useSendMessage } from "./use-send-message";
export { useOpenExternal } from "./use-open-external";
export { useRequestDisplayMode } from "./use-request-display-mode";

// OpenAI state hooks
export { useDisplayMode } from "./use-display-mode";
export { useWidgetProps } from "./use-widget-props";
export { useWidgetState } from "./use-widget-state";
export { useOpenAiGlobal } from "./use-openai-global";

// Additional hooks
export { useMaxHeight } from "./use-max-height";
export { useIsChatGptApp } from "./use-is-chatgpt-app";
export { useRequestModal } from "./use-request-modal";
export { useSendFollowUpMessage } from "./use-send-follow-up-message";
export { useTheme } from "./use-theme";

// Types
export type * from "./types";

