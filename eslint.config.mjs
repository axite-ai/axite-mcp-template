import { createRequire } from "node:module";
import path from "node:path";

// Resolve eslint-config-next from the web package so it's available even when not hoisted to the repo root
const requireFromWeb = createRequire(path.join(process.cwd(), "packages/web/"));
const nextCoreWebVitals = requireFromWeb("eslint-config-next/core-web-vitals");
const nextTypescript = requireFromWeb("eslint-config-next/typescript");

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "tests/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
    ],
  },
];

export default config;
