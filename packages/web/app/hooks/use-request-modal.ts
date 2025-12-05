import { useCallback } from "react";

/**
 * Modal configuration types based on OpenAI Apps SDK spec
 */
export interface ModalAction {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  color?: "primary" | "danger";
}

export interface ModalField {
  name: string;
  type: "text" | "textarea" | "number" | "select" | "multiselect" | "dateRange";
  label: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
}

export interface ModalConfig {
  title: string;
  description?: string;
  content?: string;
  fields?: ModalField[];
  actions?: ModalAction[];
}

export interface ModalResult {
  selectedIndex?: number;
  [key: string]: unknown;
}

/**
 * Custom hook for displaying modals in ChatGPT.
 * Wraps window.openai.requestModal with error handling and type safety.
 *
 * @example
 * const requestModal = useRequestModal();
 * const result = await requestModal({
 *   title: "Confirm Deletion",
 *   description: "Are you sure?",
 *   actions: [
 *     { label: "Cancel", variant: "secondary" },
 *     { label: "Delete", variant: "danger" }
 *   ]
 * });
 * if (result?.selectedIndex === 1) {
 *   // User clicked Delete
 * }
 */
export const useRequestModal = () => {
  return useCallback(
    async (config: ModalConfig): Promise<ModalResult | null> => {
      try {
        if (typeof window === "undefined" || !window.openai) {
          console.warn("[useRequestModal] requestModal API not available");
          return null;
        }

        // Type assertion for requestModal since it may not be in the SDK types yet
        const requestModalFn = (window.openai as any).requestModal;
        if (!requestModalFn) {
          console.warn("[useRequestModal] requestModal function not available");
          return null;
        }

        console.log("[useRequestModal] Requesting modal:", config);
        const result = await requestModalFn(config);
        console.log("[useRequestModal] Modal result:", result);
        return result as ModalResult;
      } catch (error) {
        console.error("[useRequestModal] Error requesting modal:", error);
        return null;
      }
    },
    []
  );
};
