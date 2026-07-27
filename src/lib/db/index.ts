import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __cairnQueryClient: ReturnType<typeof postgres> | undefined;
}

const queryClient =
  globalThis.__cairnQueryClient ?? postgres(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  globalThis.__cairnQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
