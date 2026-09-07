/** Accept only a local absolute path, never an authority or URL credentials. */
export function safeAuthNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") ||
      /[\\\u0000-\u0020\u007f]/.test(next)) return "/dashboard";
  return next;
}
