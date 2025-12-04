import { vi } from 'vitest';

/**
 * Mock database client for testing
 */
export const createMockDbClient = () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return mockClient;
};

/**
 * Mock database pool for testing
 */
export const createMockDbPool = () => {
  const mockClient = createMockDbClient();

  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  return { mockPool, mockClient };
};

/**
 * Mock Redis client for testing
 */
export const createMockRedisClient = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue('OK'),
});

/**
 * Mock user data
 */
export const mockUsers = {
  withSubscription: {
    id: 'user_with_sub_123',
    email: 'subscribed@example.com',
    name: 'Subscribed User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  withoutSubscription: {
    id: 'user_no_sub_456',
    email: 'free@example.com',
    name: 'Free User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // TEMPLATE: Example user for testing third-party integrations
  withIntegration: {
    id: 'user_with_integration_789',
    email: 'integration@example.com',
    name: 'Integration User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * Mock subscription data
 */
export const mockSubscriptions = {
  active: {
    id: 'sub_123',
    referenceId: mockUsers.withSubscription.id,
    stripeSubscriptionId: 'sub_stripe_123',
    plan: 'pro',
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  trialing: {
    id: 'sub_456',
    referenceId: mockUsers.withIntegration.id,
    stripeSubscriptionId: 'sub_stripe_456',
    plan: 'pro',
    status: 'trialing',
    trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * TEMPLATE: Example third-party integration items (from previous Plaid integration)
 * Replace or remove this based on your application's needs
 */
export const mockIntegrationItems = {
  item1: {
    id: 'integration_item_123',
    userId: mockUsers.withIntegration.id,
    externalId: 'item_external_123',
    accessToken: 'access-sandbox-encrypted-token',
    providerId: 'provider_1',
    providerName: 'Example Provider',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * Setup database query responses for common scenarios
 */
export const setupDbMocks = (mockClient: ReturnType<typeof createMockDbClient>) => {
  // Default: no results
  mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

  return {
    // User queries
    mockUserQuery: (user: typeof mockUsers[keyof typeof mockUsers]) => {
      mockClient.query.mockResolvedValueOnce({ rows: [user], rowCount: 1 });
    },

    // Subscription queries
    mockSubscriptionQuery: (
      subscription: typeof mockSubscriptions[keyof typeof mockSubscriptions]
    ) => {
      mockClient.query.mockResolvedValueOnce({
        rows: [subscription],
        rowCount: 1,
      });
    },

    // Integration items queries (TEMPLATE: customize for your app)
    mockIntegrationItemsQuery: (items: Array<typeof mockIntegrationItems.item1>) => {
      mockClient.query.mockResolvedValueOnce({ rows: items, rowCount: items.length });
    },

    // No results
    mockNoResults: () => {
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    },
  };
};
