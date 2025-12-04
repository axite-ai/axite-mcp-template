# Testing Guide

## Overview

The project uses Vitest for running tests with a dedicated test environment configuration.

## Configuration

### Environment Variables

Test-specific environment variables are defined in `.env.test`. This file contains safe defaults for local testing including:

- Test database configuration (`POSTGRES_DB=axite_mcp_test`)
- Dummy API keys for external services (configured in vitest.config.ts)
- Test encryption keys
- Sandbox mode configurations

The test environment is loaded via `vitest.config.ts` using Vite's `loadEnv('test', ...)` function.

### Database Setup

Tests use a dedicated PostgreSQL test database (`axite_mcp_test` by default) that is:

1. **Created** automatically before tests run (via `tests/global-setup.ts`)
2. **Migrated** using Drizzle Kit's `pnpm db:push` command
3. **Dropped** after all tests complete

The global setup uses Drizzle ORM for consistency with the rest of the codebase.

### Test Files

- **`vitest.config.ts`** - Main Vitest configuration
  - Loads `.env.test` for environment variables
  - Configures test environment (happy-dom)
  - Sets up global setup and per-file setup

- **`tests/global-setup.ts`** - Global setup/teardown
  - Creates/drops test database
  - Runs migrations
  - Uses Drizzle ORM for database operations

- **`tests/setup-files.ts`** - Per-test-file setup
  - Imports testing library utilities
  - Configures console output filtering

- **`tests/test-db.ts`** - Test database utilities
  - Exports `testDb` - Drizzle instance for tests
  - Exports `testPool` - PostgreSQL pool for tests
  - Exports `closeTestDb()` - Cleanup function

## Running Tests

```bash
# Run all tests
pnpm test

# Run integration tests only
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Writing Tests

### Using the Test Database

Import the test database utilities:

```typescript
import { testDb } from '../test-db';
import { users } from '@/lib/db/schema';

it('should query test database', async () => {
  const result = await testDb.select().from(users);
  expect(result).toHaveLength(0);
});
```

### Environment Variables

All environment variables from `.env.test` are available in tests via `process.env`:

```typescript
it('should have test environment variables', () => {
  expect(process.env.NODE_ENV).toBe('test');
  expect(process.env.POSTGRES_DB).toBe('axite_mcp_test');
  expect(process.env.ENCRYPTION_KEY).toHaveLength(64);
});
```

### Integration vs Unit Tests

- **Integration tests** (`tests/integration/`) - Test actual services with real database
- **Unit tests** - Test individual functions with mocks (use vitest's `vi.mock()`)

## Best Practices

1. **Use Drizzle ORM** - Prefer Drizzle queries over raw SQL for consistency
2. **Clean up after tests** - Use `afterEach`/`afterAll` hooks to clean test data
3. **Use test transactions** - Consider wrapping tests in transactions for isolation
4. **Mock external APIs** - Mock external services to avoid real API calls
5. **Test environment isolation** - Never use production credentials in tests

## Troubleshooting

### Database Permission Errors

If you see permission errors during teardown, this is usually harmless. The test database cleanup runs after tests complete and doesn't affect test results.

### Encryption Key Errors

Ensure `.env.test` has a valid 64-character hex string for `ENCRYPTION_KEY` (32 bytes).

### Module Loading Errors

If you see errors during module evaluation, check that:
1. All required environment variables are set in `.env.test`
2. Services that run on import (like encryption self-test) handle test environment properly

## Test Database Access

To manually inspect the test database:

```bash
# Connect to test database
psql -h localhost -U postgres -d axite_mcp_test

# Or use Drizzle Studio (will use .env.test if NODE_ENV=test)
NODE_ENV=test pnpm db:studio
```

## CI/CD Considerations

When running tests in CI:

1. Ensure PostgreSQL is available
2. Set `DATABASE_URL` if different from the default (`postgresql://postgres:postgres@localhost:5432/axite_mcp_test`)
3. Override any environment variables that differ from `.env.test` defaults

## Known Issues & TODOs

### Current Test Status
- ✅ **121 tests passing** across 5 test files
- ⚠️ **Database permission warnings** during teardown (harmless, doesn't affect results)
- 📝 **Note:** Some tests reference the previous Plaid integration as examples. Update or remove these based on your application's needs.

### Testing Gaps & Future Work

**Unit Tests:**
- [ ] Individual service method tests (encryption, user service, subscription helpers)
- [ ] MCP response helper tests
- [ ] Auth response helper tests
- [ ] Utility function tests

**Integration Tests:**
- [ ] Complete MCP tool flow tests (OAuth → subscription → feature access → tool execution)
- [ ] Database transaction isolation for faster test execution
- [ ] Error handling and edge cases for all MCP tools
- [ ] Webhook handling tests for external services

**E2E Tests:**
- [ ] MCP tool invocation from ChatGPT (requires test environment)
- [ ] OAuth flow completion
- [ ] Subscription creation and activation
- [ ] Third-party integration flows

**Widget Tests:**
- [ ] HTML/CSS validation
- [ ] Interactive behavior testing (using Playwright/Puppeteer)
- [ ] ChatGPT iframe compatibility
- [ ] Responsive design validation

**Performance Tests:**
- [ ] Load testing for MCP endpoints
- [ ] Database query performance
- [ ] Cache effectiveness

### Contributing Tests

When adding new tests:

1. **Use the test database** (`testDb` from `tests/test-db.ts`)
2. **Clean up after yourself** (use `afterEach` or database transactions)
3. **Mock external APIs** to avoid real API calls
4. **Follow existing patterns** in `tests/integration/`
5. **Update this document** when fixing TODOs or adding new test coverage
