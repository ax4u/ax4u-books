import { z } from 'zod';

export class PrintError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export type ProviderConfig = { enabled: boolean; environment: 'sandbox' | 'live'; apiKey: string };
export const providerOrigins = { sandbox: 'https://api-sandbox.sweetbook.com/v1', live: 'https://api.sweetbook.com/v1' } as const;
export const uidSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const money = z.number().finite().nonnegative();
export const productSchema = z.object({
  bookSpecUid: uidSchema, name: z.string(), pageMin: z.number().int().positive(),
  pageMax: z.number().int().positive(), pageIncrement: z.number().int().positive(), booksPerBox: z.number().int().positive(),
  priceBase: money.optional(), pricePerIncrement: money.optional(),
  sandboxPriceBase: money.optional(), sandboxPricePerIncrement: money.optional(),
  innerTrimWidthMm: z.number().positive().optional(), innerTrimHeightMm: z.number().positive().optional(),
  coverType: z.string().optional(), bindingType: z.string().optional(),
}).refine(s => s.pageMax >= s.pageMin);
export const itemsSchema = z.array(z.object({ bookUid: uidSchema, quantity: z.number().int().min(1).max(200) }).strict()).min(1).max(50);
export const quoteRequestSchema = z.object({ items: itemsSchema }).strict();
const quoteSchema = z.object({
  paidCreditAmount: money, creditBalance: money, creditSufficient: z.boolean(),
  totalAmount: money.optional(), productAmount: money.optional(), shippingFee: money.optional(), packagingFee: money.optional(),
  totalProductAmount: money.optional(), totalShippingFee: money.optional(), totalPackagingFee: money.optional(),
});
const statusSchema = z.object({
  orderUid: uidSchema,
  orderStatus: z.enum(['PAID', 'PDF_READY', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'PRODUCTION_COMPLETE', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'CANCELLED_REFUND', 'ERROR']),
  orderStatusDisplay: z.string().optional(),
});

export const createOrderItemSchema = z.object({
  bookUid: uidSchema,
  quantity: z.number().int().min(1).max(200),
}).strict();

export const createOrderRequestSchema = z.object({
  orderName: z.string().min(1).max(200),
  recipientName: z.string().min(1).max(100),
  recipientPhone: z.string().min(1).max(30),
  recipientPhoneSub: z.string().max(30).optional(),
  shippingPostcode: z.string().min(1).max(20),
  shippingAddress: z.string().min(1).max(500),
  shippingAddressDetail: z.string().max(500).optional(),
  shippingMemo: z.string().max(500).optional(),
  items: z.array(createOrderItemSchema).min(1).max(50),
}).strict();

export const orderResponseSchema = z.object({
  orderUid: uidSchema,
  orderNumber: z.string().optional(),
  orderStatus: z.enum(['PAID', 'PDF_READY', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'PRODUCTION_COMPLETE', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'CANCELLED_REFUND', 'ERROR']),
  totalAmount: money.optional(),
  paidCreditAmount: money.optional(),
  creditBalance: money.optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderRequestSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;

export class SweetbookClient {
  readonly #config: ProviderConfig;
  readonly #fetch: typeof fetch;
  constructor(config: ProviderConfig, transport: typeof fetch = fetch) {
    if (typeof window !== 'undefined') throw new PrintError('SERVER_ONLY', 503);
    if (!config.enabled || !config.apiKey || !['sandbox', 'live'].includes(config.environment)) throw new PrintError('PRINT_PROVIDER_DISABLED', 503);
    this.#config = config; this.#fetch = transport;
  }
  async #request<T>(path: string, schema: z.ZodType<T>, body?: unknown, headersExtra?: Record<string, string>): Promise<T> {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.#config.apiKey}`,
        'Content-Type': 'application/json',
        ...headersExtra,
      };
      response = await this.#fetch(providerOrigins[this.#config.environment] + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
    } catch { throw new PrintError('PRINT_PROVIDER_UNAVAILABLE', 502); }
    let envelope: { success?: boolean; data?: unknown };
    try { envelope = await response.json(); } catch { throw new PrintError('PRINT_PROVIDER_INVALID_RESPONSE', 502); }
    if (!response.ok || envelope?.success !== true) throw new PrintError('PRINT_PROVIDER_REJECTED', 502);
    const parsed = schema.safeParse(envelope.data);
    if (!parsed.success) throw new PrintError('PRINT_PROVIDER_INVALID_RESPONSE', 502);
    return parsed.data;
  }
  products() { return this.#request('/book-specs', z.array(productSchema)); }
  async product(uid: string) { return this.#request(`/book-specs/${uidSchema.parse(uid)}`, productSchema); }
  async quote(input: unknown) { return this.#request('/orders/estimate', quoteSchema, quoteRequestSchema.parse(input)); }
  async status(uid: string) {
    const id = uidSchema.parse(uid);
    const result = await this.#request(`/orders/${id}`, statusSchema);
    if (result.orderUid !== id) throw new PrintError('PRINT_PROVIDER_INVALID_RESPONSE', 502);
    return result;
  }
  async order(input: unknown, idempotencyKey?: string) {
    const validated = createOrderRequestSchema.parse(input);
    const headersExtra: Record<string, string> = {};
    if (idempotencyKey) {
      headersExtra['Idempotency-Key'] = idempotencyKey;
    }
    return this.#request('/orders', orderResponseSchema, validated, headersExtra);
  }
}