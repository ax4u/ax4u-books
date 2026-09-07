/** Demo fallbacks are local-development only, never deployed authentication/payment. */
export function isLocalDemoAllowed(): boolean {
  return process.env.NODE_ENV !== "production" &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development");
}
