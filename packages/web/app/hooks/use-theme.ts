import { useOpenAiGlobal } from "./use-openai-global";
import { type Theme } from "./types";

/**
 * Hook to get the current theme (light/dark mode).
 *
 * @returns The current theme: "light" or "dark", or null if not available
 *
 * @example
 * ```tsx
 * const theme = useTheme();
 * const isDark = theme === "dark";
 *
 * return (
 *   <div className={isDark ? "bg-gray-900 text-white" : "bg-white text-black"}>
 *     Content
 *   </div>
 * );
 * ```
 */
export const useTheme = (): Theme | null => {
  return useOpenAiGlobal("theme");
};
