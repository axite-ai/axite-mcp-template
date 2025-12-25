/**
 * MCP-UI Widget Hooks
 *
 * ARCHITECTURE:
 * - Server: Uses @mcp-ui/server's createUIResource() with Apps SDK adapter enabled
 * - Adapter: @mcp-ui/server automatically injects scripts that populate window.openai
 * - Widgets: Use these hooks to access window.openai API in a type-safe way
 *
 * CRITICAL: @mcp-ui/client does NOT provide these hooks. These are custom hooks
 * designed to work with the Apps SDK adapter pattern.
 *
 * @mcp-ui/client only provides:
 * - UIResourceRenderer (for Remote DOM, which we don't use)
 * - Utility functions (getUIResourceMetadata, isUIResource, etc.)
 *
 * These hooks provide a type-safe interface for widgets to interact
 * with the ChatGPT Apps SDK environment via window.openai.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { AppType } from '@/app/[transport]/route';

// Apps SDK Types (from official OpenAI Apps SDK documentation)
// See: https://developers.openai.com/apps-sdk/build/custom-ux
type DisplayMode = 'pip' | 'inline' | 'fullscreen';
type Theme = 'light' | 'dark';
type UnknownObject = Record<string, unknown>;

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface SafeArea {
  insets: SafeAreaInsets;
}

type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

interface UserAgent {
  device: { type: DeviceType };
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
}

interface CallToolResponse {
  content: Array<{ type: string; [key: string]: unknown }>;
  structuredContent: UnknownObject;
  isError: boolean;
  result: string;
  meta: UnknownObject;
}

// OpenAI Global State (Apps SDK)
interface OpenAiGlobals<
  ToolInput extends UnknownObject = UnknownObject,
  ToolOutput extends UnknownObject = UnknownObject,
  ToolResponseMetadata extends UnknownObject = UnknownObject,
  WidgetState extends UnknownObject = UnknownObject
> {
  theme: Theme;
  userAgent: UserAgent;
  locale: string;
  maxHeight: number;
  displayMode: DisplayMode;
  safeArea: SafeArea;
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
}

// OpenAI API (Apps SDK)
interface OpenAiAPI<WidgetState extends UnknownObject = UnknownObject> {
  callTool: (name: string, args: Record<string, unknown>) => Promise<CallToolResponse>;
  sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;
  openExternal: (payload: { href: string }) => void;
  requestDisplayMode: (args: { mode: DisplayMode }) => Promise<{ mode: DisplayMode }>;
  setWidgetState: (state: WidgetState) => Promise<void>;
}

// Extend AppsSdkBridge with additional OpenAI-specific methods
interface ExtendedAppsSdkBridge {
  // Required AppsSdkBridge properties
  toolInput: Record<string, unknown>;
  toolOutput: unknown;
  widgetState: unknown;
  setWidgetState(state: unknown): Promise<void>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  sendFollowUpMessage(params: { prompt: string }): Promise<void>;
  requestDisplayMode(params: { mode: 'inline' | 'pip' | 'fullscreen' }): Promise<void>;
  maxHeight?: number;
  displayMode?: 'inline' | 'pip' | 'fullscreen';
  locale?: string;
  theme?: string;

  // Optional OpenAI-specific extensions
  openExternal?: (payload: { href: string }) => void;
  userAgent?: UserAgent;
  safeArea?: SafeArea;
  toolResponseMetadata?: unknown;
}

// Event type for global state changes
const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

/**
 * Hook: useOpenAiGlobal - Subscribe to specific global values
 *
 * @param key - The key of the global value to subscribe to
 * @returns The current value of the global
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = () => onChange();
      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, { passive: true });
      return () => window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
    },
    () => (window.openai as ExtendedAppsSdkBridge | undefined)?.[key as keyof ExtendedAppsSdkBridge] as OpenAiGlobals[K]
  );
}

/**
 * Hook: useToolInfo - Get tool output and metadata
 *
 * Provides access to the structured content and metadata from the tool response.
 *
 * @returns Object with isSuccess, output, and responseMetadata
 */
export function useToolInfo<TOutput = UnknownObject, TMeta = UnknownObject>() {
  const toolOutput = useOpenAiGlobal('toolOutput') as TOutput | null;
  const toolResponseMetadata = useOpenAiGlobal('toolResponseMetadata') as TMeta | null;

  return {
    isSuccess: toolOutput !== null,
    output: toolOutput,
    responseMetadata: toolResponseMetadata,
  };
}

/**
 * Hook: useDisplayMode - Get/set display mode
 *
 * Manages the widget's display mode (inline, fullscreen, or pip).
 *
 * @returns Tuple of [currentMode, requestModeChange]
 */
export function useDisplayMode(): [
  DisplayMode,
  (mode: DisplayMode) => Promise<void>
] {
  const displayMode = useOpenAiGlobal('displayMode');

  const requestDisplayMode = useCallback(async (mode: DisplayMode) => {
    await window.openai?.requestDisplayMode({ mode });
  }, []);

  return [displayMode, requestDisplayMode];
}

/**
 * Hook: useWidgetState - Persistent widget state
 *
 * Manages state that persists across widget renders and conversation turns.
 *
 * @param defaultState - Initial state or function that returns initial state
 * @returns Tuple of [state, setState]
 */
export function useWidgetState<T extends UnknownObject>(
  defaultState: T | (() => T | null) | null = null
): readonly [T | null, (state: T | ((prev: T | null) => T | null)) => void] {
  const widgetStateFromWindow = useOpenAiGlobal('widgetState') as T | null;

  const [widgetState, _setWidgetState] = useState<T | null>(() => {
    if (widgetStateFromWindow != null) return widgetStateFromWindow;
    return typeof defaultState === 'function' ? defaultState() : defaultState;
  });

  useEffect(() => {
    _setWidgetState(widgetStateFromWindow);
  }, [widgetStateFromWindow]);

  const setWidgetState = useCallback((state: T | ((prev: T | null) => T | null)) => {
    _setWidgetState((prevState) => {
      const newState = typeof state === 'function' ? state(prevState) : state;
      if (newState != null) {
        window.openai?.setWidgetState(newState);
      }
      return newState;
    });
  }, []);

  return [widgetState, setWidgetState] as const;
}

/**
 * Hook: useTheme - Get current theme
 *
 * @returns The current theme ('light' or 'dark')
 */
export function useTheme(): Theme {
  return useOpenAiGlobal('theme');
}

/**
 * Hook: useOpenExternal - Open external URLs
 *
 * Opens URLs outside the widget iframe (e.g., in a new browser tab or ChatGPT navigation).
 *
 * @returns Function to open external URLs
 */
export function useOpenExternal() {
  return useCallback((url: string) => {
    const openai = window.openai as ExtendedAppsSdkBridge | undefined;
    if (openai?.openExternal) {
      openai.openExternal({ href: url });
    }
  }, []);
}

/**
 * Hook: useSendFollowUpMessage - Send follow-up chat messages
 *
 * Sends a message to the conversation as if the user typed it.
 *
 * @returns Function to send follow-up messages
 */
export function useSendFollowUpMessage() {
  return useCallback((prompt: string) => {
    return window.openai?.sendFollowUpMessage({ prompt });
  }, []);
}

/**
 * Hook: useCallTool - Type-safe tool calling via AppType
 *
 * Calls other MCP tools with full type safety based on the AppType definition.
 *
 * @returns Function to call tools with typed arguments and return values
 */
export function useCallTool() {
  return useCallback(async <T extends keyof AppType>(
    toolName: T,
    args: AppType[T]['input']
  ): Promise<AppType[T]['result']> => {
    const response = await window.openai?.callTool(toolName as string, args);
    return response as AppType[T]['result'];
  }, []);
}
