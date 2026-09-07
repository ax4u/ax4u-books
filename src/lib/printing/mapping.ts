import { z } from 'zod';
import { PrintError, uidSchema } from './client';
import type { PrintBinding } from './handlers';

// Structural interface lets offline tests exercise the exact production lookup.
type Query = { eq(key: string, value: string): Query; maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
export type MappingDatabase = { from(table: string): { select(columns: string): Query } };
const mappingSchema = z.object({
  user_id: z.string(), book_id: z.string(), environment: z.enum(['sandbox', 'live']),
  provider_book_uid: uidSchema, book_spec_uid: uidSchema, page_count: z.number().int().positive(),
  finalized: z.boolean(), source_updated_at: z.string(), finalized_at: z.string().nullable(),
  inner_pdf_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(), cover_pdf_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  trim_width_mm: z.number().positive(), trim_height_mm: z.number().positive(), bleed_mm: z.number().nonnegative(),
  binding_type: z.string().min(1), cover_type: z.string().min(1),
});
export type PreparedBinding = PrintBinding & { trimWidthMm: number; trimHeightMm: number; bleedMm: number; bindingType: string; coverType: string };
export async function lookupPrintBinding(db: MappingDatabase, userId: string, bookId: string, environment: 'sandbox' | 'live'): Promise<PreparedBinding | null> {
  const book = await db.from('books').select('id,user_id,status,updated_at').eq('id', bookId).eq('user_id', userId).maybeSingle();
  if (book.error) throw new PrintError('PRINT_MAPPING_UNAVAILABLE', 503);
  const owned = z.object({ id: z.string(), user_id: z.string(), status: z.literal('completed'), updated_at: z.string() }).safeParse(book.data);
  if (!owned.success || owned.data.id !== bookId || owned.data.user_id !== userId) return null;
  const result = await db.from('print_book_bindings').select('*').eq('user_id', userId).eq('book_id', bookId).eq('environment', environment).maybeSingle();
  // Includes undefined-table/schema-cache/permissions errors; never fall back to another environment.
  if (result.error) throw new PrintError('PRINT_MAPPING_UNAVAILABLE', 503);
  if (!result.data) return null;
  const parsed = mappingSchema.safeParse(result.data);
  if (!parsed.success) throw new PrintError('PRINT_MAPPING_INVALID', 503);
  const row = parsed.data;
  if (row.user_id !== userId || row.book_id !== bookId || row.environment !== environment || !Number.isFinite(Date.parse(row.source_updated_at)) || Date.parse(row.source_updated_at) !== Date.parse(owned.data.updated_at)) return null;
  return { userId, bookId, providerBookUid: row.provider_book_uid, bookSpecUid: row.book_spec_uid, pageCount: row.page_count,
    finalized: row.finalized && !!row.finalized_at && !!row.inner_pdf_sha256 && !!row.cover_pdf_sha256,
    trimWidthMm: row.trim_width_mm, trimHeightMm: row.trim_height_mm, bleedMm: row.bleed_mm, bindingType: row.binding_type, coverType: row.cover_type };
}
