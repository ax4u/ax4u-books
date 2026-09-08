// Explicit origins only: PKCE verifier/session cookies must stay on their host.
const productionOrigins = new Set([
  "https://gobibi.art", "https://www.gobibi.art", "https://books.ax4u.kr",
  "https://ax4u-books.vercel.app",
]);

export function trustedAuthOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (productionOrigins.has(url.origin)) return url.origin;
    if (process.env.NODE_ENV !== "production" && url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
  } catch { /* invalid origin */ }
  return null;
}
