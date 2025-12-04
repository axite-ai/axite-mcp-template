# Testing Guide

This guide covers the comprehensive test suite for the application. The test suite ensures that all critical functionality works correctly and that changes don't break existing features.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)

## Overview

The test suite is organized into three main categories:

1. **Integration Tests** (`tests/integration/`) - Test business logic and service integrations
2. **E2E Tests** (`tests/e2e/`) - Test complete user journeys through the application
3. **Mocks & Utilities** (`tests/mocks/`, `tests/utils/`) - Shared testing utilities

### Testing Stack

- **Vitest** - Fast, modern test runner for integration/unit tests
- **Playwright** - E2E testing framework for browser automation
- **MSW** (Mock Service Worker) - API mocking for external services
- **Testing Library** - React component testing utilities

## Test Structure

```
tests/
├── setup.ts                          # Global test setup
├── vitest.config.ts                  # Vitest configuration
├── playwright.config.ts              # Playwright configuration
├── integration/                      # Integration tests
│   ├── mcp-tools-free.test.ts       # Free MCP tools (no auth)
│   ├── mcp-tools-authenticated.test.ts  # Authenticated MCP tools
│   ├── auth-flows.test.ts           # OAuth & authentication
│   ├── subscription-flows.test.ts   # Stripe subscriptions
│   └── services.test.ts             # Core services (Plaid, User, etc.)
├── e2e/                             # End-to-end tests
│   └── critical-flows.spec.ts       # Critical user journeys
├── mocks/                           # Mock data and clients
│   ├── plaid.ts                     # Plaid API mocks
│   ├── stripe.ts                    # Stripe API mocks
│   └── database.ts                  # Database mocks
└── utils/                           # Test utilities
    └── test-helpers.ts              # Shared helper functions
```

## Running Tests

### All Tests

```bash
# Run all tests (integration + E2E)
pnpm test:all

# Run integration tests only
pnpm test:run

# Run E2E tests only
pnpm test:e2e
```

### Development Workflow

```bash
# Watch mode - reruns tests on file changes
pnpm test:watch

# Interactive UI for debugging tests
pnpm test:ui

# E2E tests with visible browser
pnpm test:e2e:headed

# E2E tests in interactive mode
pnpm test:e2e:ui
```

### Specific Test Files

```bash
# Run specific integration test
pnpm vitest tests/integration/mcp-tools-free.test.ts

# Run specific E2E test
pnpm playwright test tests/e2e/critical-flows.spec.ts
```

### Coverage Reports

```bash
# Generate coverage report
pnpm test:coverage

# View coverage in browser
# Coverage report will be in coverage/index.html
```

## Writing Tests

### Integration Tests

Integration tests validate business logic without requiring a full application environment. They use mocked external dependencies (Plaid, Stripe, database).

**Example: Testing MCP Tool**

```typescript
import { describe, it, expect } from 'vitest';

describe('MCP Tools - Free Tier', () => {
  describe('calculate_budget', () => {
    it('should calculate standard 50/30/20 budget', () => {
      const monthlyIncome = 5000;
      const budget = {
        monthlyIncome,
        needs: { amount: 2500, percentage: 50 },
        wants: { amount: 1500, percentage: 30 },
        savings: { amount: 1000, percentage: 20 },
      };

      expect(budget.needs.amount).toBe(2500);
      expect(budget.wants.amount).toBe(1500);
      expect(budget.savings.amount).toBe(1000);
    });
  });
});
```

### E2E Tests

E2E tests validate complete user flows through the application using a real browser.

**Example: Testing User Flow**

```typescript
import { test, expect } from '@playwright/test';

test('should load pricing page with all plans', async ({ page }) => {
  await page.goto('/pricing');

  await expect(page.locator('text=/basic/i')).toBeVisible();
  await expect(page.locator('text=/pro/i')).toBeVisible();
  await expect(page.locator('text=/enterprise/i')).toBeVisible();
});
```

### Using Mocks

**Plaid Mock Example:**

```typescript
import { mockPlaidResponses } from '../mocks/plaid';

const response = mockPlaidResponses.accountsGet('test-token');
expect(response.accounts).toHaveLength(3);
```

**Database Mock Example:**

```typescript
import { createMockDbPool, mockUsers } from '../mocks/database';

const { mockPool, mockClient } = createMockDbPool();
mockClient.query.mockResolvedValueOnce({
  rows: [mockUsers.withSubscription],
  rowCount: 1,
});
```

## Test Coverage

### What We Test

#### ✅ MCP Tools
- **Free Tools**: `get_financial_tips`, `calculate_budget`
- **Authenticated Tools**: `get_account_balances`, `get_transactions`, `get_spending_insights`, `check_account_health`
- **Authorization**: Three-tier pattern (OAuth + Subscription + Plaid)

#### ✅ Authentication
- OAuth 2.1 authorization code flow
- Token exchange and refresh
- Session management
- API key authentication
- OpenID configuration

#### ✅ Subscriptions
- Stripe checkout session creation
- Webhook event handling
- Subscription lifecycle (active, trialing, canceled, etc.)
- Plan limits enforcement
- Email notifications

#### ✅ Services
- Plaid integration (accounts, transactions, insights)
- User service (access token management)
- Encryption service (token encryption/decryption)
- Subscription helpers (active subscription validation)

#### ✅ User Journeys
- User registration and login
- OAuth flow with ChatGPT
- Subscription checkout
- Plaid account linking
- Widget rendering

### Coverage Goals

- **Integration Tests**: 80%+ line coverage for business logic
- **E2E Tests**: 100% coverage of critical user paths
- **Services**: 90%+ coverage for core services

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run integration tests
        run: pnpm test:run

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
pnpm test:run
```

## Best Practices

### 1. Test Naming
- Use descriptive test names that explain what is being tested
- Follow the pattern: `should [expected behavior] when [condition]`

```typescript
// ✅ Good
it('should return subscription required response when user has no active subscription', () => {
  // ...
});

// ❌ Bad
it('test subscription', () => {
  // ...
});
```

### 2. Test Organization
- Group related tests using `describe` blocks
- Use `beforeEach` for common setup
- Keep tests independent and isolated

### 3. Mocking
- Mock external dependencies (Plaid, Stripe, database)
- Don't mock the code you're testing
- Use realistic mock data

### 4. Assertions
- Make specific assertions about expected behavior
- Test both success and error cases
- Verify side effects (emails sent, database updates, etc.)

### 5. Test Data
- Use factory functions for creating test data
- Keep test data minimal but realistic
- Avoid hardcoding values when possible

## Debugging Tests

### Vitest Debug Mode

```bash
# Run tests with Node debugger
node --inspect-brk ./node_modules/.bin/vitest --run

# Then attach your debugger (VS Code, Chrome DevTools, etc.)
```

### Playwright Debug Mode

```bash
# Run with Playwright Inspector
pnpm test:e2e --debug

# Generate trace for failed tests
pnpm test:e2e --trace on
```

### Common Issues

**Tests timing out:**
- Increase timeout in test: `test('...', { timeout: 10000 }, async () => {})`
- Check for unresolved promises
- Verify mocks are properly set up

**Database connection errors:**
- Ensure test database is running
- Check environment variables in `tests/setup.ts`
- Use database mocks for unit tests

**Flaky E2E tests:**
- Use `waitFor` for async operations
- Avoid hardcoded timeouts
- Use Playwright's auto-waiting features

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [MSW Documentation](https://mswjs.io/)

## Contributing

When adding new features:

1. Write tests for the new functionality
2. Ensure existing tests still pass
3. Aim for 80%+ coverage on new code
4. Update this documentation if needed

When fixing bugs:

1. Write a failing test that reproduces the bug
2. Fix the bug
3. Verify the test now passes
4. Add regression test to prevent future occurrences
