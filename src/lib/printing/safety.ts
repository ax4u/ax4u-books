import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { z } from 'zod';
import { itemsSchema, PrintError, SweetbookClient, type ProviderConfig } from './client';
const text = (max: number) => z.string().min(1).max(max).refine(s => s.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(s));
export const orderPayloadSchema = z.object({
  items: itemsSchema,
  shipping: z.object({ recipientName: text(100), recipientPhone: text(20), postalCode: text(10), address1: text(200), address2: text(200).optional(), memo: text(200).optional() }).strict(),
  externalRef: text(100).optional(),
}).strict();
type OrderPayload = z.infer<typeof orderPayloadSchema>;
/** Trusted server ledger record ONLY. Never deserialize this from a browser request.
 * A future ledger must bind user/book/PDF hashes, quantity, exact payload and fresh
 * provider estimate, confirm a separate physical-book payment, and atomically claim
 * the intent before dispatch. Ebook status/checkoutId alone is NOT this entitlement.
 */
export type PaidPrintApproval = {
  intentId: string; userId: string; kind: 'physical_book'; paymentStatus: 'confirmed'; approved: boolean;
  environment: 'sandbox' | 'live'; payload: OrderPayload; expiresAt: number;
};
export function prepareOrder(config: ProviderConfig, input: unknown, approval: PaidPrintApproval | null) {
  new SweetbookClient(config); // validate config, no I/O
  const payload = orderPayloadSchema.parse(input);
  if (!approval || approval.kind !== 'physical_book' || approval.paymentStatus !== 'confirmed' || !approval.approved || !approval.intentId || !approval.userId || !Number.isFinite(approval.expiresAt) || approval.expiresAt <= Date.now()) throw new PrintError('PRINT_PAID_APPROVAL_REQUIRED', 403);
  const body = JSON.stringify(payload);
  if (approval.environment !== config.environment || JSON.stringify(orderPayloadSchema.parse(approval.payload)) !== body) throw new PrintError('PRINT_APPROVAL_MISMATCH', 409);
  // Stable key per paid intent, NOT per HTTP retry; changed payload must conflict.
  const idempotencyKey = 'ax4u-print-' + createHash('sha256').update(JSON.stringify([config.environment, approval.userId, approval.intentId])).digest('hex');
  return { method: 'POST' as const, path: '/orders' as const, idempotencyKey, body, dispatchEnabled: false as const };
}
export function validatePageCount(count: number, spec: { pageMin: number; pageMax: number; pageIncrement: number }) {
  if (![count, spec.pageMin, spec.pageMax, spec.pageIncrement].every(Number.isSafeInteger) || spec.pageIncrement <= 0 || count < spec.pageMin || count > spec.pageMax || (count - spec.pageMin) % spec.pageIncrement !== 0) throw new PrintError('PRINT_PAGE_COUNT_INVALID');
}
const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) blocked.addSubnet(address, prefix, 'ipv4');
/** Preflight ONLY: deliberately no PDF fetch/upload exists in this adapter.
 * A future downloader MUST pin the validated IP to its connection, forbid redirects,
 * cap streamed bytes and verify PDF structure. Re-resolving after this check is unsafe.
 * Prefer direct private object-store reads, not URL downloads.
 */
export async function assertTrustedPdfUrl(value: string, allowedOrigins: readonly string[], resolve = (host: string) => lookup(host, { all: true })) {
  let url: URL;
  try { url = new URL(value); } catch { throw new PrintError('PRINT_PDF_URL_REJECTED'); }
  if (value.length > 4096 || url.protocol !== 'https:' || url.username || url.password || url.hash || url.port || isIP(url.hostname) || !allowedOrigins.includes(url.origin) || !/^\/print\/[A-Za-z0-9/_-]+\.pdf$/.test(url.pathname) || /%|\\/.test(value.split('?')[0])) throw new PrintError('PRINT_PDF_URL_REJECTED');
  const addresses = await resolve(url.hostname);
  // IPv6 deliberately unsupported until a pinned downloader is security-reviewed.
  if (!addresses.length || addresses.some(a => a.family !== 4 || isIP(a.address) !== 4 || blocked.check(a.address, 'ipv4'))) throw new PrintError('PRINT_PDF_URL_REJECTED');
  return { url: url.href, addresses: addresses.map(a => a.address) };
}
