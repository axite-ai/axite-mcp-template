/**
 * Environment Variable Validation
 *
 * Validates that all required environment variables are set based on the runtime environment.
 * Follows Next.js best practices for environment detection and validation.
 */

import { logger } from "@/lib/services/logger-service";

interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
}

/**
 * Detect the current runtime environment
 *
 * Environments:
 * - build: During `next build` (CI/CD or local)
 * - production: Deployed production environment (Vercel/Railway with real traffic)
 * - development: Local development with `next dev`
 */
function getEnvironment() {
  // Build phase - when running `next build`
  const isBuild =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build";

  if (isBuild) {
    return "build";
  }

  // Production runtime - deployed with real env vars
  // Check for platform-specific indicators that this is a real production deployment
  const isDeployedProduction =
    process.env.NODE_ENV === "production" &&
    (process.env.VERCEL === "1" || // Vercel deployment
      !!process.env.RAILWAY_ENVIRONMENT || // Railway deployment
      process.env.IS_PRODUCTION === "true"); // Explicit production flag

  if (isDeployedProduction) {
    return "production";
  }

  // Local production preview - running `pnpm start` locally
  const isLocalProductionPreview =
    process.env.NODE_ENV === "production" && !isDeployedProduction;

  if (isLocalProductionPreview) {
    return "local-preview";
  }

  // Default to development
  return "development";
}

/**
 * Required environment variables for production deployments
 */
const REQUIRED_PRODUCTION_ENV_VARS = [
  "BETTER_AUTH_SECRET",
  "ENCRYPTION_KEY",
  "DATABASE_URL",
  "REDIS_URL",
] as const;

/**
 * Required environment variables with platform-specific fallbacks
 */
const REQUIRED_WITH_FALLBACK = [
  {
    name: "BASE_URL",
    fallbacks: ["RAILWAY_PUBLIC_DOMAIN", "RAILWAY_STATIC_URL", "VERCEL_URL"],
    description: "Base URL for OAuth redirects and webhooks",
  },
] as const;

/**
 * Recommended but optional environment variables
 */
const RECOMMENDED_ENV_VARS = [
  { name: "PLAID_CLIENT_ID", description: "Plaid API client ID" },
  { name: "PLAID_SECRET", description: "Plaid API secret" },
  { name: "PLAID_ENV", description: "Plaid environment (sandbox/production)" },
  { name: "STRIPE_SECRET_KEY", description: "Stripe API secret key" },
  { name: "STRIPE_WEBHOOK_SECRET", description: "Stripe webhook signing secret" },
] as const;

/**
 * Validates environment variables based on the current environment
 */
export function validateEnvironmentVariables(): EnvValidationResult {
  const env = getEnvironment();
  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Build phase - no validation needed
  if (env === "build") {
    return { isValid: true, missingVars: [], warnings: [] };
  }

  // Production deployment - strict validation
  if (env === "production") {
    // Check all required variables
    for (const varName of REQUIRED_PRODUCTION_ENV_VARS) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    // Check variables with fallbacks
    for (const { name, fallbacks } of REQUIRED_WITH_FALLBACK) {
      const hasVar = !!process.env[name];
      const hasFallback = fallbacks.some((fb) => !!process.env[fb]);

      if (!hasVar && !hasFallback) {
        missingVars.push(`${name} (or one of: ${fallbacks.join(", ")})`);
      }
    }

    // Warn about recommended variables
    for (const { name, description } of RECOMMENDED_ENV_VARS) {
      if (!process.env[name]) {
        warnings.push(`${name} not set - ${description}`);
      }
    }
  }

  // Local production preview - lenient validation (allows local testing)
  if (env === "local-preview") {
    // Only check DATABASE_URL and REDIS_URL (infrastructure requirements)
    const infrastructureVars = ["DATABASE_URL", "REDIS_URL"];
    for (const varName of infrastructureVars) {
      if (!process.env[varName]) {
        warnings.push(
          `${varName} not set - required for local production preview to function`
        );
      }
    }

    // Warn about other missing variables
    const securityVars = [
      "BETTER_AUTH_SECRET",
      "PLAID_WEBHOOK_SECRET",
      "ENCRYPTION_KEY",
    ];
    for (const varName of securityVars) {
      if (!process.env[varName]) {
        warnings.push(
          `${varName} not set - using fallback/stub (NOT SECURE - development only)`
        );
      }
    }

    // Check BASE_URL with fallback
    const hasBaseUrl = !!(
      process.env.BASE_URL ||
      process.env.RAILWAY_PUBLIC_DOMAIN ||
      process.env.RAILWAY_STATIC_URL ||
      process.env.VERCEL_URL
    );

    if (!hasBaseUrl) {
      warnings.push(
        `BASE_URL not configured - using fallback from baseUrl.ts`
      );
    }
  }

  // Development mode - only warnings
  if (env === "development") {
    // Warn about missing core variables
    for (const varName of REQUIRED_PRODUCTION_ENV_VARS) {
      if (!process.env[varName]) {
        warnings.push(
          `${varName} not set (required in production, optional in development)`
        );
      }
    }

    // Check BASE_URL with fallback
    const hasBaseUrl = !!(
      process.env.BASE_URL ||
      process.env.RAILWAY_PUBLIC_DOMAIN ||
      process.env.RAILWAY_STATIC_URL ||
      process.env.VERCEL_URL
    );

    if (!hasBaseUrl) {
      warnings.push(
        `BASE_URL not configured - using fallback from baseUrl.ts`
      );
    }
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings,
  };
}

/**
 * Validates environment and throws if invalid in production
 * Logs warnings in development and local preview
 */
export function validateEnvironmentOrExit(): void {
  const env = getEnvironment();

  // Skip validation during build
  if (env === "build") {
    logger.debug("[Env Validation] Skipping validation during build phase");
    return;
  }

  const result = validateEnvironmentVariables();

  // Log environment info
  logger.info(`[Env Validation] Environment: ${env}`);

  // Log warnings
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      logger.warn(`[Env Validation] ${warning}`);
    }
  }

  // Handle validation failures
  if (!result.isValid) {
    const errorMessage = `Missing required environment variables: ${result.missingVars.join(", ")}`;

    if (env === "production") {
      // Production - fatal error
      logger.error(`[Env Validation] FATAL: ${errorMessage}`);
      logger.error(
        "[Env Validation] Application cannot start without required environment variables in production"
      );
      throw new Error(errorMessage);
    } else {
      // Local preview - just warn
      logger.warn(`[Env Validation] ${errorMessage}`);
      logger.warn(
        "[Env Validation] Running in local preview mode - some features may not work"
      );
    }
  } else if (result.warnings.length === 0) {
    logger.info("[Env Validation] All required environment variables are set");
  } else {
    logger.info(
      `[Env Validation] Validation passed with ${result.warnings.length} warnings`
    );
  }
}

/**
 * Helper to check if running in a real production deployment
 */
export function isProductionDeployment(): boolean {
  return getEnvironment() === "production";
}

/**
 * Helper to check if running locally (dev or local preview)
 */
export function isLocalEnvironment(): boolean {
  const env = getEnvironment();
  return env === "development" || env === "local-preview";
}
