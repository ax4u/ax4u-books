import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SweetbookClient, PrintError, type ProviderConfig } from './client';
import { lookupPrintBinding, type MappingDatabase } from './mapping';
import { printingHandlers } from './handlers';

export function providerConfig(environment: Record<string, string | undefined> = process.env): ProviderConfig {
  const selected = environment.SWEETBOOK_ENV;
  if (selected !== undefined && selected !== 'sandbox' && selected !== 'live') throw new PrintError('PRINT_PROVIDER_DISABLED', 503);
  return { enabled: environment.PRINTING_ENABLED === 'true', environment: selected ?? 'sandbox', apiKey: environment.SWEETBOOK_API_KEY ?? '' };
}
export const handlers = printingHandlers({
  async authenticate() {
    // Do NOT use getSessionUser's unsigned demo-cookie fallback for paid printing.
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    return !error && data.user ? { id: data.user.id } : null;
  },
  origin: process.env.PRINTING_APP_ORIGIN,
  client: () => new SweetbookClient(providerConfig()),
  async binding(userId, bookId) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new PrintError('PRINT_MAPPING_UNAVAILABLE', 503);
    return lookupPrintBinding(supabase as unknown as MappingDatabase, userId, bookId, providerConfig().environment);
  },
});
