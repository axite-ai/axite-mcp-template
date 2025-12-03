// Detect deployment platform and construct base URL
// Priority: Explicit BASE_URL > Railway > Vercel > Error in production
const explicitUrl = process.env.BASE_URL;
const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.RAILWAY_STATIC_URL
  ? `https://${process.env.RAILWAY_STATIC_URL}`
  : undefined;
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

// Development fallback (only used in local development)
const localUrl = "https://dev.askmymoney.ai";

// Priority: Explicit > Railway > Vercel > Local (dev only)
// In production, env validation will ensure at least one platform URL is set
export const baseURL =
  explicitUrl || railwayUrl || vercelUrl || localUrl;

