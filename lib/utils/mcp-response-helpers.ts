/**
 * Helper functions for creating MCP tool responses
 * These helpers ensure proper typing for all MCP tool responses
 */

import type {
  MCPToolResponse,
  OpenAIResponseMetadata,
} from "@/lib/types/mcp-responses";
import type { AuthChallengeContent } from "@/lib/types/tool-responses";
import { createTextContent } from "@/lib/types/mcp-responses";
import { createUIResource } from '@mcp-ui/server';
import type { CreateUIResourceOptions } from '@mcp-ui/server';
import { baseURL } from "@/baseUrl";

/**
 * Creates a generic error response that matches AuthChallengeContent structure
 * This allows error responses to be compatible with tool response union types
 */
export const createErrorResponse = (
  message: string,
  meta?: Partial<OpenAIResponseMetadata>
): MCPToolResponse<AuthChallengeContent, OpenAIResponseMetadata> => ({
  content: [createTextContent(message)],
  structuredContent: {
    message,
  },
  isError: true,
  _meta: {
    "openai/toolInvocation/invoked": "Error occurred",
    ...meta
  }
});

/**
 * Creates a success response with structured content
 * Automatically creates UIResource for widget-enabled tools using Apps SDK adapter
 */
export const createSuccessResponse = <T extends Record<string, unknown>>(
  text: string,
  structuredContent: T,
  meta?: Partial<OpenAIResponseMetadata>
): MCPToolResponse<T, OpenAIResponseMetadata> => {
  const {
    "openai/outputTemplate": outputTemplate,
    ...otherMeta
  } = meta || {};

  // If there's an outputTemplate, create UIResource with Apps SDK adapter
  if (outputTemplate) {
    const widgetPath = outputTemplate.replace('ui://widget/', '').replace('.html', '');

    // Use @mcp-ui/server to create resource with Apps SDK adapter
    const resourceOptions: CreateUIResourceOptions = {
      uri: outputTemplate.replace('.html', '') as `ui://${string}`,
      content: {
        type: 'externalUrl',
        iframeUrl: `${baseURL}/widgets/${widgetPath}`,
      },
      encoding: 'text',
      adapters: {
        appsSdk: {
          enabled: true,
          config: {}
        }
      }
    };

    const uiResource = createUIResource(resourceOptions);

    return {
      content: [{
        type: "resource" as const,
        resource: uiResource.resource
      }],
      structuredContent,
      _meta: otherMeta as OpenAIResponseMetadata,
      isError: false,
    };
  }

  // Fallback for non-widget responses
  return {
    content: [createTextContent(text)],
    structuredContent,
    ...(meta && { _meta: meta as OpenAIResponseMetadata })
  };
};

/**
 * Creates an authentication challenge response
 */
export const createAuthChallengeResponse = (
  resourceMetadataUrl: string,
  errorDescription: string = "Authentication required"
): MCPToolResponse<{ error: string }, OpenAIResponseMetadata> => ({
  content: [createTextContent(errorDescription)],
  structuredContent: {
    error: "insufficient_scope"
  },
  isError: true,
  _meta: {
    "mcp/www_authenticate": `Bearer resource_metadata="${resourceMetadataUrl}", error="insufficient_scope", error_description="${errorDescription}"`
  }
});
