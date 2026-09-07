import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { lookupPrintBinding } from '../src/lib/printing/mapping';

const row = { user_id: 'owner', book_id: 'book', environment: 'live', provider_book_uid: 'bk_test', book_spec_uid: 'spec_test', page_count: 24, finalized: true, source_updated_at: '2026-01-01T00:00:00Z', finalized_at: '2026-01-02T00:00:00Z', inner_pdf_sha256: 'a'.repeat(64), cover_pdf_sha256: 'b'.repeat(64), trim_width_mm: 210, trim_height_mm: 210, bleed_mm: 3, binding_type: 'perfect', cover_type: 'soft' };
function database(mapping: unknown = row, error: unknown = null, status = 'completed', updated = row.source_updated_at) {
  const filters: unknown[] = [];
  const client = { from(table: string) { const q = { select() { return q; }, eq(key: string, value: string) { filters.push([table, key, value]); return q; }, async maybeSingle() { return table === 'books' ? { data: { id: 'book', user_id: 'owner', status, updated_at: updated }, error: null } : { data: mapping, error }; } }; return q; } };
  return { client, filters };
}
test('lookup binds owner/book/environment and rejects stale, foreign or unfinished records', async () => {
  const db = database();
  const result = await lookupPrintBinding(db.client, 'owner', 'book', 'live');
  assert.equal(result?.providerBookUid, 'bk_test');
  assert.ok(db.filters.some(f => JSON.stringify(f) === JSON.stringify(['print_book_bindings', 'environment', 'live'])));
  for (const args of [[{ ...row, user_id: 'other' }], [{ ...row, environment: 'sandbox' }], [row, null, 'draft'], [row, null, 'completed', '2026-02-01T00:00:00Z']] as const) {
    const bad = database(...args); assert.equal(await lookupPrintBinding(bad.client, 'owner', 'book', 'live'), null);
  }
});
test('missing mapping is distinct from unavailable/missing schema and never calls provider', async () => {
  assert.equal(await lookupPrintBinding(database(null).client, 'owner', 'book', 'live'), null);
  await assert.rejects(() => lookupPrintBinding(database(null, { code: '42P01' }).client, 'owner', 'book', 'live'), /PRINT_MAPPING_UNAVAILABLE/);
});

test('mapping migration isolates owners and environments with read-only consumer grants', () => {
  const path = resolve('supabase/migrations/20260908000100_print_book_bindings.sql');
  assert.ok(existsSync(path), 'durable mapping migration must exist');
  const sql = readFileSync(path, 'utf8').toLowerCase();
  for (const text of ['enable row level security', 'force row level security', 'auth.uid() = user_id', "environment in ('sandbox', 'live')", 'unique (user_id, book_id, environment)', 'revoke all', 'grant select', 'source_updated_at', 'inner_pdf_sha256', 'cover_pdf_sha256', "b.status = 'completed'"]) assert.ok(sql.includes(text), text);
  assert.ok(!/grant\s+(insert|update|all)\s+.*to authenticated/.test(sql));
});
