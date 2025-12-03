import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  decimal,
  index,
  pgEnum
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  stripeCustomerId: text("stripe_customer_id"),
});

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_key_idx").on(table.key),
    index("apikey_userId_idx").on(table.userId),
  ],
);

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"),
});

export const oauthApplication = pgTable(
  "oauth_application",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls"),
    type: text("type"),
    disabled: boolean("disabled").default(false),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [index("oauthApplication_userId_idx").on(table.userId)],
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    accessToken: text("access_token").unique(),
    refreshToken: text("refresh_token").unique(),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    clientId: text("client_id").references(() => oauthApplication.clientId, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    index("oauthAccessToken_clientId_idx").on(table.clientId),
    index("oauthAccessToken_userId_idx").on(table.userId),
  ],
);

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").references(() => oauthApplication.clientId, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    consentGiven: boolean("consent_given"),
  },
  (table) => [
    index("oauthConsent_clientId_idx").on(table.clientId),
    index("oauthConsent_userId_idx").on(table.userId),
  ],
);

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull(),
  referenceId: text("reference_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").default("incomplete"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  seats: integer("seats"),
});

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  passkeys: many(passkey),
  apikeys: many(apikey),
  oauthApplications: many(oauthApplication),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.userId],
    references: [user.id],
  }),
}));

export const oauthApplicationRelations = relations(
  oauthApplication,
  ({ one, many }) => ({
    user: one(user, {
      fields: [oauthApplication.userId],
      references: [user.id],
    }),
    oauthAccessTokens: many(oauthAccessToken),
    oauthConsents: many(oauthConsent),
  }),
);

export const oauthAccessTokenRelations = relations(
  oauthAccessToken,
  ({ one }) => ({
    oauthApplication: one(oauthApplication, {
      fields: [oauthAccessToken.clientId],
      references: [oauthApplication.clientId],
    }),
    user: one(user, {
      fields: [oauthAccessToken.userId],
      references: [user.id],
    }),
  }),
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthApplication: one(oauthApplication, {
    fields: [oauthConsent.clientId],
    references: [oauthApplication.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
  }),
}));



// Custom application tables

/**
 * Plaid Item Status Lifecycle
 *
 * - 'active': Item is connected and ready to use (set immediately after token exchange)
 * - 'error': Item requires user action (login, MFA, etc.) - set by ERROR webhook
 * - 'revoked': User revoked access at their institution - set by USER_PERMISSION_REVOKED webhook
 * - 'deleted': Item was removed by user via deleteItem() - set by item deletion service
 * - 'pending': DEPRECATED - No longer used (items are active immediately after token exchange)
 *
 * Note: Plaid does NOT send an ITEM_READY webhook. Items are ready immediately after
 * public token exchange. See: https://plaid.com/docs/api/items/#webhooks
 */
export const PlaidItemStatus = pgEnum("plaid_item_status", [
  "pending",   // DEPRECATED - kept for backward compatibility with existing data
  "active",    // Item connected and ready
  "error",     // Requires user action
  "revoked",   // User revoked access
  "deleted",   // Soft deleted by user
])

export const plaidItems = pgTable(
  "plaid_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    itemId: text("item_id").notNull().unique(),

    accessToken: text("access_token").notNull(), // Encrypted

    institutionId: text("institution_id"),
    institutionName: text("institution_name"),

    status: PlaidItemStatus("status").default("active"), // Items are ready immediately after token exchange

    consentExpiresAt: timestamp("consent_expires_at"),

    transactionsCursor: text("transactions_cursor"),

    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    lastWebhookAt: timestamp("last_webhook_at"),

    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    itemIdIndex: index("plaid_items_item_id_idx").on(table.itemId),
    userIdIndex: index("plaid_items_user_id_idx").on(table.userId),
    statusIndex: index("plaid_items_status_idx").on(table.status),
  })
);

export const plaidWebhooks = pgTable(
  "plaid_webhooks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    itemId: text("item_id"),

    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),

    webhookType: text("webhook_type").notNull(),
    webhookCode: text("webhook_code").notNull(),

    errorCode: text("error_code"),

    payload: jsonb("payload"),

    processed: boolean("processed").default(false).notNull(),
    processingError: jsonb("processing_error"),

    retryCount: integer("retry_count").default(0).notNull(),

    receivedAt: timestamp("received_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    itemIdProcessedIndex: index("plaid_webhooks_item_id_processed_idx").on(
      table.itemId,
      table.processed,
      table.createdAt
    ),
    webhookTypeCodeIndex: index("plaid_webhooks_type_code_item_idx").on(
      table.webhookType,
      table.webhookCode,
      table.itemId
    ),
  })
);

export const plaidAccounts = pgTable(
  "plaid_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    itemId: text("item_id")
      .notNull()
      .references(() => plaidItems.itemId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull().unique(),
    name: text("name").notNull(),
    mask: text("mask"),
    officialName: text("official_name"),
    currentBalance: decimal("current_balance", { precision: 28, scale: 10 }),
    availableBalance: decimal("available_balance", {
      precision: 28,
      scale: 10,
    }),
    isoCurrencyCode: text("iso_currency_code"),
    type: text("type"),
    subtype: text("subtype"),
    persistentAccountId: text("persistent_account_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    accountIdIndex: index("plaid_accounts_account_id_idx").on(table.accountId),
    userIdIndex: index("plaid_accounts_user_id_idx").on(table.userId),
  })
);

export const plaidTransactions = pgTable(
  "plaid_transactions",
  {
    transactionId: text("transaction_id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => plaidAccounts.accountId),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 28, scale: 10 }).notNull(),
    isoCurrencyCode: text("iso_currency_code"),
    unofficialCurrencyCode: text("unofficial_currency_code"),
    categoryPrimary: text("category_primary"),
    categoryDetailed: text("category_detailed"),
    categoryConfidence: text("category_confidence"),
    checkNumber: text("check_number"),
    date: timestamp("date").notNull(),
    datetime: timestamp("datetime"),
    authorizedDate: timestamp("authorized_date"),
    authorizedDatetime: timestamp("authorized_datetime"),
    location: jsonb("location"),
    merchantName: text("merchant_name"),
    paymentChannel: text("payment_channel"),
    pending: boolean("pending").default(false).notNull(),
    pendingTransactionId: text("pending_transaction_id"),
    transactionCode: text("transaction_code"),
    name: text("name"),
    originalDescription: text("original_description"),
    logoUrl: text("logo_url"),
    website: text("website"),
    counterparties: jsonb("counterparties"),
    paymentMeta: jsonb("payment_meta"),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    transactionIdIndex: index("plaid_transactions_transaction_id_idx").on(
      table.transactionId
    ),
    accountIdIndex: index("plaid_transactions_account_id_idx").on(
      table.accountId
    ),
    userIdIndex: index("plaid_transactions_user_id_idx").on(table.userId),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIndex: index("audit_logs_user_id_idx").on(table.userId),
    eventTypeIndex: index("audit_logs_event_type_idx").on(table.eventType),
    createdAtIndex: index("audit_logs_created_at_idx").on(table.createdAt),
  })
);

export const plaidLinkSessions = pgTable(
  "plaid_link_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    linkToken: text("link_token").notNull(),
    linkSessionId: text("link_session_id"),
    plaidUserToken: text("plaid_user_token"),
    status: text("status").default("pending").notNull(), // pending, active, completed, failed
    publicTokens: jsonb("public_tokens"), // Array of public tokens from SESSION_FINISHED
    itemsAdded: integer("items_added").default(0).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    userIdIndex: index("plaid_link_sessions_user_id_idx").on(table.userId),
    linkTokenIndex: index("plaid_link_sessions_link_token_idx").on(table.linkToken),
    linkSessionIdIndex: index("plaid_link_sessions_link_session_id_idx").on(table.linkSessionId),
    statusIndex: index("plaid_link_sessions_status_idx").on(table.status),
  })
);

export const plaidItemDeletions = pgTable(
  "plaid_item_deletions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    itemId: text("item_id").notNull(),

    institutionId: text("institution_id"),
    institutionName: text("institution_name"),

    deletedAt: timestamp("deleted_at").defaultNow().notNull(),
    reason: text("reason"),
  },
  (table) => ({
    userIdDeletedAtIndex: index("plaid_item_deletions_user_id_deleted_at_idx").on(
      table.userId,
      table.deletedAt
    ),
  })
);
