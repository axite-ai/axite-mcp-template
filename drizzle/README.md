# Database Migrations

## ⚠️ Important Note for Template Users

**These migration files contain the database schema from a previous financial management application and include Plaid-specific tables.**

### For New Projects

We recommend **deleting these migrations** and generating fresh ones for your application:

```bash
# Delete existing migrations
rm -rf drizzle/0000_*.sql drizzle/meta/*.json

# Generate fresh migrations based on your schema
pnpm db:generate

# OR use push for development (recommended)
pnpm db:push
```

### What's in These Migrations?

The existing migrations include:
- **Better Auth tables** (user, session, account, etc.) - Keep these
- **Plaid-specific tables** (plaid_items, plaid_accounts, plaid_transactions, etc.) - Example from previous app
- **Example application tables** (app_settings, audit_logs) - Customize for your needs

### Recommended Approach

1. **For Development:** Use `pnpm db:push` to sync your schema directly
2. **For Production:** Generate migrations with `pnpm db:generate` after finalizing your schema

### Schema Location

Your database schema is defined in `lib/db/schema.ts`. Modify this file to match your application's needs, then regenerate migrations.
