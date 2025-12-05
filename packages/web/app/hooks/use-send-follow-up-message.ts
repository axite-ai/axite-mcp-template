import { useCallback } from "react";

/**
 * Custom hook for sending follow-up messages from widgets to ChatGPT.
 * Wraps window.openai.sendFollowUpMessage with error handling.
 *
 * @example
 * const sendFollowUp = useSendFollowUpMessage();
 * await sendFollowUp("Would you like me to analyze your spending?");
 */
export const useSendFollowUpMessage = () => {
  return useCallback(
    async (prompt: string): Promise<boolean> => {
      try {
        if (typeof window === "undefined" || !window.openai?.sendFollowUpMessage) {
          console.warn("[useSendFollowUpMessage] sendFollowUpMessage API not available");
          return false;
        }

        console.log("[useSendFollowUpMessage] Sending follow-up:", prompt);
        await window.openai.sendFollowUpMessage({ prompt });
        console.log("[useSendFollowUpMessage] Follow-up sent successfully");
        return true;
      } catch (error) {
        console.error("[useSendFollowUpMessage] Error sending follow-up:", error);
        return false;
      }
    },
    []
  );
};
