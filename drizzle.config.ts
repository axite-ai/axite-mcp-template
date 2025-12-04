import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/axite_mcp";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
  },
});
