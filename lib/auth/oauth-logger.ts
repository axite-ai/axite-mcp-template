/**
 * OAuth Logging Middleware
 *
 * Provides detailed logging for OAuth flows to help diagnose authentication issues.
 */

export const logOAuthRequest = (
  endpoint: string,
  request: Request,
  additionalInfo?: Record<string, any>
) => {
  const url = new URL(request.url);
  console.log(`[OAuth] ${endpoint} request`, {
    method: request.method,
    path: url.pathname,
    searchParams: Object.fromEntries(url.searchParams),
    headers: {
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
      contentType: request.headers.get('content-type'),
    },
    ...additionalInfo,
  });
};

export const logOAuthResponse = (
  endpoint: string,
  response: Response,
  body?: any
) => {
  console.log(`[OAuth] ${endpoint} response`, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      contentType: response.headers.get('content-type'),
      location: response.headers.get('location'),
    },
    body: body ? {
      ...body,
      // Redact sensitive fields
      access_token: body.access_token ? '[REDACTED]' : undefined,
      refresh_token: body.refresh_token ? '[REDACTED]' : undefined,
      client_secret: body.client_secret ? '[REDACTED]' : undefined,
    } : undefined,
  });
};

export const logOAuthError = (
  endpoint: string,
  error: Error | unknown,
  context?: Record<string, any>
) => {
  console.error(`[OAuth] ${endpoint} error`, {
    error: error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : error,
    ...context,
  });
};
