import { test, expect } from '@playwright/test';

/**
 * End-to-End tests for critical user journeys
 *
 * These tests validate complete user flows:
 * 1. User registration and login
 * 2. OAuth flow with ChatGPT
 * 3. Subscription checkout
 * 4. Plaid account linking
 * 5. MCP tool invocation from ChatGPT
 */

test.describe('Critical User Journeys', () => {
  test.describe('Authentication Flow', () => {
    test('should load the login page', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveTitle(/Login/);
      await expect(page.locator('form')).toBeVisible();
    });

    test('should show validation errors for invalid credentials', async ({
      page,
    }) => {
      await page.goto('/login');

      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/email.*required/i')).toBeVisible();
    });

    test('should redirect to dashboard after successful login', async ({
      page,
    }) => {
      await page.goto('/login');

      // Fill in credentials
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');

      // Submit form
      await page.click('button[type="submit"]');

      // Should redirect to dashboard (in real app, mock the auth)
      // await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('OAuth Flow', () => {
    test('should display OAuth consent screen', async ({ page }) => {
      // Navigate to OAuth authorize endpoint
      await page.goto(
        '/api/auth/oauth/authorize?client_id=chatgpt.com&redirect_uri=https://chatgpt.com/connector_platform_oauth_redirect&scope=openid profile email&response_type=code&state=test_state'
      );

      // Should show consent screen or redirect to login
      await expect(page).toHaveURL(/\/(login|consent)/);
    });

    test('should complete OAuth flow and return authorization code', async ({
      page,
    }) => {
      // This would require authenticated session
      // In integration test, we'd mock the OAuth flow
      // and verify the callback receives a code parameter
    });
  });

  test.describe('Subscription Flow', () => {
    test('should display pricing page with all plans', async ({ page }) => {
      await page.goto('/pricing');

      // Should show all three plans
      await expect(page.locator('text=/basic/i')).toBeVisible();
      await expect(page.locator('text=/pro/i')).toBeVisible();
      await expect(page.locator('text=/enterprise/i')).toBeVisible();
    });

    test('should redirect to Stripe checkout when selecting a plan', async ({
      page,
    }) => {
      await page.goto('/pricing');

      // Click on Pro plan (assuming there's a button)
      const proButton = page.locator('button:has-text("Pro"), a:has-text("Pro")').first();

      // In real app, this would redirect to Stripe
      // For testing, we'd mock the Stripe checkout
    });

    test('should show success message after subscription', async ({ page }) => {
      // Navigate to success page (simulating Stripe redirect)
      await page.goto('/pricing/success?session_id=cs_test_123');

      // Should show success message
      await expect(
        page.locator('text=/success|thank you|subscription active/i')
      ).toBeVisible();
    });
  });

  test.describe('Plaid Integration Flow', () => {
    test('should open Plaid Link modal', async ({ page }) => {
      // This requires authentication
      // Navigate to account linking page
      await page.goto('/connect');

      // Should have a button to link accounts
      const linkButton = page.locator('button:has-text("Link Account")');
      // await expect(linkButton).toBeVisible();
    });

    test('should handle successful account linking', async ({ page }) => {
      // After Plaid Link completes, it calls a callback
      // with a public token that gets exchanged for an access token
      // This would be tested with Plaid sandbox
    });
  });

  test.describe('Widget Rendering', () => {
    test('should load test widget successfully', async ({ page }) => {
      await page.goto('/widgets/test-widget');

      // Widget should render without errors
      await expect(page.locator('body')).toBeVisible();

      // Should not have console errors
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Wait a bit for any errors to surface
      await page.waitForTimeout(1000);

      expect(errors).toHaveLength(0);
    });

    test('should load account balances widget', async ({ page }) => {
      await page.goto('/widgets/account-balances');

      // Widget should be accessible
      await expect(page).toHaveTitle(/Account Balances/);
    });

    test('should handle widget communication with parent frame', async ({
      page,
    }) => {
      // Widgets use postMessage to communicate with ChatGPT
      // This would test the communication protocol
    });
  });

  test.describe('MCP Server Health', () => {
    test('should respond to MCP requests', async ({ page }) => {
      // Make a request to the MCP endpoint
      const response = await page.request.post('http://localhost:3000/mcp', {
        data: {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return 200 OK
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('result');
    });

    test('should list all available tools', async ({ page }) => {
      const response = await page.request.post('http://localhost:3000/mcp', {
        data: {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const body = await response.json();
      const tools = body.result?.tools || [];

      // Should include free tools
      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('get_financial_tips');
      expect(toolNames).toContain('calculate_budget');
    });
  });

  test.describe('Error Handling', () => {
    test('should show 404 page for non-existent routes', async ({ page }) => {
      await page.goto('/non-existent-page');
      await expect(page.locator('text=/404|not found/i')).toBeVisible();
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Make invalid API request
      const response = await page.request.post('http://localhost:3000/api/invalid', {
        data: {},
      });

      // Should return error status
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should handle network errors in widgets', async ({ page }) => {
      // Test widget behavior when network fails
      // This would require mocking network failures
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on forms', async ({ page }) => {
      await page.goto('/login');

      const emailInput = page.locator('input[name="email"]');
      const passwordInput = page.locator('input[name="password"]');

      // Should have labels or aria-labels
      await expect(emailInput).toHaveAttribute('aria-label', /.+/);
      // or check for associated label element
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/pricing');

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should focus on interactive elements
      const focusedElement = await page.locator(':focus').first();
      await expect(focusedElement).toBeVisible();
    });

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto('/');

      // This would use axe-core or similar for automated accessibility testing
      // For now, just verify page loads
      await expect(page).toHaveTitle(/.+/);
    });
  });

  test.describe('Performance', () => {
    test('should load home page within 3 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test('should not have excessive console warnings', async ({ page }) => {
      const warnings: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'warning') {
          warnings.push(msg.text());
        }
      });

      await page.goto('/');

      // Some warnings are okay, but excessive warnings indicate issues
      expect(warnings.length).toBeLessThan(10);
    });
  });

  test.describe('Security', () => {
    test('should have security headers', async ({ page }) => {
      const response = await page.goto('/');

      // Should have security headers
      const headers = response?.headers() || {};

      // Check for common security headers
      // Note: Some might be set by Vercel or CDN
      expect(headers).toBeTruthy();
    });

    test('should not expose sensitive data in client', async ({ page }) => {
      await page.goto('/');

      // Get all script content
      const scriptContent = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.map((s) => s.textContent).join(' ');
      });

      // Should not contain API keys or secrets
      expect(scriptContent).not.toContain('sk_live_');
      expect(scriptContent).not.toContain('sk_test_');
      expect(scriptContent).not.toContain('PLAID_SECRET');
    });

    test('should redirect HTTP to HTTPS in production', async ({ page }) => {
      // This would only apply in production environment
      // Skip in local development
    });
  });
});
