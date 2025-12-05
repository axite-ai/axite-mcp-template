/**
 * MCP Authentication Middleware
 *
 * Validates Better Auth sessions for MCP tool calls.
 * Provides helper functions to extract and verify user sessions.
 */

import { auth } from "./index";

/**
 * Session information extracted from Better Auth
 */
export interface McpSession {
  userId: string;
  sessionId: string;
}

/**
 * Extract and validate session from MCP request headers
 */
export async function getMcpSession(
  headers: Headers
): Promise<McpSession | null> {
  try {
    const authHeader = headers.get('authorization') || headers.get('Authorization');
    console.error('[MCP Auth] Validating session', {
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
    });

    // Validate token with Better Auth
    const sessionData = await auth.api.getMcpSession({
      headers: headers,
    });

    console.error('[MCP Auth] Session data received', {
      hasSessionData: !!sessionData,
      hasUserId: !!sessionData?.userId,
      userId: sessionData?.userId
    });

    if (!sessionData?.userId) {
      console.error('[MCP Auth] Invalid or expired MCP session');
      return null;
    }

    console.error('[MCP Auth] Session validated successfully', {
      userId: sessionData.userId
    });

    return {
      userId: sessionData.userId,
      sessionId: sessionData.accessToken,
    };
  } catch (error) {
    console.error('[MCP Auth] Error validating session:', error);
    return null;
  }
}

/**
 * Helper to require authentication for MCP tools
 */
export async function requireMcpAuth(
  headers: Headers
): Promise<McpSession> {
  const session = await getMcpSession(headers);

  if (!session) {
    throw new Error(
      'Authentication required. Please authenticate with ChatGPT.'
    );
  }

  return session;
}

/**
 * Check if request is authenticated without throwing
 */
export async function isAuthenticated(
  headers: Headers
): Promise<boolean> {
  const session = await getMcpSession(headers);
  return session !== null;
}

/**
 * Get MCP session if authenticated, or null if not
 */
export async function getOptionalMcpAuth(
  headers: Headers
): Promise<McpSession | null> {
  return getMcpSession(headers);
}
