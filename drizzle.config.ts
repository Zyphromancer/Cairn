import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // DDL of record lives in supabase/migrations (hand-written, RLS-aware).
  // This is only used for `drizzle-kit check`/`studio` to confirm the
  // TypeScript schema matches the live database.
});
