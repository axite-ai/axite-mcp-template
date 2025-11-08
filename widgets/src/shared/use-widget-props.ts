import { useState, useEffect } from 'react';

declare global {
  interface Window {
    oai?: {
      toolOutput?: any;
      _meta?: any;
    };
  }
}

/**
 * Hook to access tool output data from the OpenAI bridge
 * Returns structured content passed from the MCP tool
 */
export function useWidgetProps<T = any>(defaults: T): T {
  const [props, setProps] = useState<T>(() => {
    if (typeof window !== 'undefined' && window.oai?.toolOutput) {
      return { ...defaults, ...window.oai.toolOutput };
    }
    return defaults;
  });

  useEffect(() => {
    const checkForData = () => {
      if (window.oai?.toolOutput) {
        setProps({ ...defaults, ...window.oai.toolOutput });
      }
    };

    // Check immediately
    checkForData();

    // Also check on a short interval (bridge might load async)
    const interval = setInterval(checkForData, 100);
    const timeout = setTimeout(() => clearInterval(interval), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return props;
}
