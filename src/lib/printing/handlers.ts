import { z } from 'zod';
import { PrintError, SweetbookClient, uidSchema } from './client';
import { validatePageCount } from './safety';

/** This mapping MUST come from owned server records, never client-supplied provider IDs. */
export type PrintBinding = { userId: string; bookId: string; providerBookUid: string; bookSpecUid: string; pageCount: number; finalized: boolean; orderUid?: string };
export type PrintingDependencies = {
  authenticate(): Promise<{ id: string } | null>;
  origin: string | undefined;
  client(): SweetbookClient;
  binding(userId: string, bookId: string): Promise<PrintBinding | null>;
};
const quoteInput = z.object({ bookId: uidSchema, quantity: z.number().int().min(1).max(200) }).strict();
const statusInput = z.object({ bookId: uidSchema }).strict();
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
async function jsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new PrintError('PRINT_JSON_REQUIRED', 415);
  // Bounded stream, not an unbounded request.json() allocation. No body logging.
  if (!request.body) throw new PrintError('PRINT_INVALID_REQUEST');
  const reader = request.body.getReader();
  let length = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); throw new PrintError('PRINT_REQUEST_TOO_LARGE', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) { if (error instanceof PrintError) throw error; throw new PrintError('PRINT_INVALID_REQUEST'); }
  finally { reader.releaseLock(); }
}
export function printingHandlers(deps: PrintingDependencies) {
  const run = async (request: Request, mutate: boolean, action: (userId: string) => Promise<unknown>) => {
    try {
      const user = await deps.authenticate();
      if (!user) throw new PrintError('PRINT_AUTH_REQUIRED', 401);
      if (mutate && (!deps.origin || request.headers.get('origin') !== deps.origin || request.headers.get('sec-fetch-site') === 'cross-site')) throw new PrintError('PRINT_ORIGIN_REJECTED', 403);
      return Response.json({ success: true, data: await action(user.id) }, { headers });
    } catch (error) {
      const safe = error instanceof PrintError ? error : error instanceof z.ZodError ? new PrintError('PRINT_INVALID_REQUEST') : new PrintError('PRINT_UNAVAILABLE', 503);
      return Response.json({ success: false, error: { code: safe.code }, data: null }, { status: safe.status, headers });
    }
  };
  const owned = async (userId: string, bookId: string) => {
    const binding = await deps.binding(userId, bookId);
    if (!binding) throw new PrintError('PRINT_BINDING_NOT_CONFIGURED', 503);
    if (binding.userId !== userId || binding.bookId !== bookId) throw new PrintError('PRINT_NOT_FOUND', 404);
    return binding;
  };
  return {
    products: (request: Request) => run(request, false, async () => {
      const query = new URL(request.url).searchParams;
      const input = z.object({ bookSpecUid: uidSchema.optional() }).strict().parse(Object.fromEntries(query));
      const client = deps.client();
      return input.bookSpecUid ? client.product(input.bookSpecUid) : client.products();
    }),
    quote: (request: Request) => run(request, true, async userId => {
      const input = quoteInput.parse(await jsonBody(request));
      const binding = await owned(userId, input.bookId);
      if (!binding.finalized) throw new PrintError('PRINT_PDF_NOT_FINALIZED', 409);
      const client = deps.client();
      validatePageCount(binding.pageCount, await client.product(binding.bookSpecUid));
      const quote = await client.quote({ items: [{ bookUid: binding.providerBookUid, quantity: input.quantity }] });
      // Provider cost only. Not a consumer checkout price or proof of payment.
      const { creditBalance: _balance, creditSufficient: _sufficient, ...cost } = quote;
      void _balance; void _sufficient;
      return { ...cost, currency: 'KRW', kind: 'provider_estimate', checkoutEnabled: false };
    }),
    status: (request: Request) => run(request, false, async userId => {
      const input = statusInput.parse(Object.fromEntries(new URL(request.url).searchParams));
      const binding = await owned(userId, input.bookId);
      if (!binding.orderUid) throw new PrintError('PRINT_NOT_FOUND', 404);
      return deps.client().status(binding.orderUid);
    }),
    orders: (request: Request) => run(request, true, async () => {
      // Intentionally before body parsing: do not collect recipient PII while disabled.
      // No env flag or claimed paid=true can bypass the missing durable entitlement,
      // approval, atomic idempotency ledger and provider reconciliation integration.
      throw new PrintError('PRINT_ORDER_FULFILLMENT_DISABLED', 503);
    }),
  };
}
