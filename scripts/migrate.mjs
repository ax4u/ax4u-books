/**
 * Build-time database migration.
 *
 * Runs as part of `npm run build` (before `next build`). On Vercel the Supabase
 * Postgres connection string is injected as POSTGRES_URL, so the schema is
 * applied automatically on every deploy — without the credentials ever needing
 * to be pulled locally. When there's no POSTGRES_URL (e.g. local mock mode), it
 * skips cleanly so the build still works offline.
 *
 * The schema (supabase/schema.sql) is idempotent (CREATE ... IF NOT EXISTS,
 * DROP/CREATE POLICY, ON CONFLICT DO NOTHING), so re-running every build is safe.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const conn = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;

if (!conn) {
  console.log("[migrate] No POSTGRES_URL set — skipping migration (mock mode).");
  process.exit(0);
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(dir, "..", "supabase", "schema.sql"), "utf8");

// Apply the books table/RLS separately from the storage bucket insert so that a
// permissions hiccup on the storage schema can't roll back the table creation.
const marker = "-- Storage bucket";
const idx = sql.indexOf(marker);
const tableSql = idx === -1 ? sql : sql.slice(0, idx);
const storageSql = idx === -1 ? "" : sql.slice(idx);

const { default: pg } = await import("pg");

// Supabase's connection string includes `sslmode=require`, which pg lets take
// precedence over the `ssl` option (so it would verify the self-signed chain).
// Strip it and force a non-verifying TLS connection instead.
let connString = conn;
try {
  const u = new URL(conn);
  u.searchParams.delete("sslmode");
  u.searchParams.delete("ssl");
  connString = u.toString();
} catch {
  // not a URL — use as-is
}

const client = new pg.Client({
  connectionString: connString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  await client.query(tableSql);
  console.log("[migrate] ✓ books table, indexes and RLS policies applied");

  if (storageSql.trim()) {
    try {
      await client.query(storageSql);
      console.log("[migrate] ✓ storage bucket 'book-assets' ensured");
    } catch (e) {
      console.warn("[migrate] storage bucket step skipped:", e.message);
    }
  }

  console.log("[migrate] ✅ migration complete");
} catch (err) {
  // Never fail the build on a migration error — log loudly instead.
  console.error("[migrate] ❌ migration failed:", err.message);
} finally {
  await client.end().catch(() => {});
}
