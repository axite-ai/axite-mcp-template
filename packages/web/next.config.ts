import type { NextConfig } from "next";
import { baseURL } from "./baseUrl";

const nextConfig: NextConfig = {
  assetPrefix: baseURL,
  // Allow cross-origin requests from ChatGPT sandbox for Server Actions
  experimental: {
    serverActions: {
      allowedOrigins: [
        "connector_*.web-sandbox.oaiusercontent.com",
        "*.web-sandbox.oaiusercontent.com",
        "web-sandbox.oaiusercontent.com",
        "chatgpt.com",
        "*.chatgpt.com",
      ],
    },
  },
};

export default nextConfig;
