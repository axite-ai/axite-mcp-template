import { useState, useEffect } from 'react';

/**
 * Hook to access a specific property from the OpenAI global object
 * Useful for accessing displayMode, locale, etc.
 */
export function useOpenAiGlobal<T = any>(key: string): T | undefined {
  const [value, setValue] = useState<T | undefined>(() => {
    if (typeof window !== 'undefined' && (window as any).oai) {
      return (window as any).oai[key];
    }
    return undefined;
  });

  useEffect(() => {
    const checkForValue = () => {
      if ((window as any).oai && (window as any).oai[key] !== undefined) {
        setValue((window as any).oai[key]);
      }
    };

    checkForValue();

    const interval = setInterval(checkForValue, 100);
    const timeout = setTimeout(() => clearInterval(interval), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [key]);

  return value;
}
