import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  var __demoSql: Sql | undefined;
}

let cached: Sql | undefined;

/**
 * Lazily opens the pooled connection to the demo's Supabase Postgres.
 *
 * `prepare: false` is required for Supabase's transaction pooler (port 6543).
 * There is no Supabase Auth here — access is gated by invite token — so this is
 * the only database entry point, used exclusively from server routes.
 */
export function getSql(): Sql {
  if (cached) return cached;
  if (global.__demoSql) {
    cached = global.__demoSql;
    return cached;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  // max 8: a run step writes up to 6 surface results in parallel.
  cached = postgres(connectionString, { prepare: false, max: 8, idle_timeout: 20 });

  if (process.env.NODE_ENV !== "production") {
    global.__demoSql = cached;
  }
  return cached;
}
