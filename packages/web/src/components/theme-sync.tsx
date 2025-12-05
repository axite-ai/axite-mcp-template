"use client";

import { useEffect } from "react";
import { useTheme } from "@/app/hooks";
import { applyDocumentTheme } from "@openai/apps-sdk-ui/theme";

export function ThemeSync() {
  const theme = useTheme();

  useEffect(() => {
    if (theme) {
      applyDocumentTheme(theme);
    }
  }, [theme]);

  return null;
}
