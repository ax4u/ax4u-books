/**
 * Central place to read environment variables and decide whether each external
 * service is configured. When a service is NOT configured the app falls back to
 * a built-in mock so the whole flow (auth → topic → "payment" → generation →
 * PDF) can be demoed locally without any real keys.
 *
 * See SETUP.md for how to fill these in.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  // Supabase
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),

  // Polar
  polarAccessToken: read("POLAR_ACCESS_TOKEN"),
  polarProductId: read("POLAR_PRODUCT_ID"),
  polarWebhookSecret: read("POLAR_WEBHOOK_SECRET"),
  polarServer: (read("POLAR_SERVER") as "sandbox" | "production") ?? "sandbox",

  // AI providers
  aiProvider: (read("AI_PROVIDER") as "openai" | "gemini") ?? "openai",
  openaiApiKey: read("OPENAI_API_KEY"),
  openaiTextModel: read("OPENAI_TEXT_MODEL") ?? "gpt-5.1",
  openaiImageModel: read("OPENAI_IMAGE_MODEL") ?? "gpt-image-2",
  geminiApiKey: read("GEMINI_API_KEY"),
  geminiTextModel: read("GEMINI_TEXT_MODEL") ?? "gemini-2.5-flash",
  geminiImageModel: read("GEMINI_IMAGE_MODEL") ?? "gemini-3-pro-image-preview",

  // App
  appUrl: read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
} as const;

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

export const isSupabaseAdminConfigured = Boolean(
  env.supabaseUrl && env.supabaseServiceRoleKey,
);

export const isPolarConfigured = Boolean(
  env.polarAccessToken && env.polarProductId,
);

export const isOpenAiConfigured = Boolean(env.openaiApiKey);
export const isGeminiConfigured = Boolean(env.geminiApiKey);

/** Which AI provider will actually be used, accounting for missing keys. */
export function resolveAiProvider(): "openai" | "gemini" | "mock" {
  if (env.aiProvider === "gemini") {
    if (isGeminiConfigured) return "gemini";
    if (isOpenAiConfigured) return "openai";
    return "mock";
  }
  if (isOpenAiConfigured) return "openai";
  if (isGeminiConfigured) return "gemini";
  return "mock";
}

/** True when we have no real AI keys and must generate placeholder content. */
export const isAiMock = resolveAiProvider() === "mock";
