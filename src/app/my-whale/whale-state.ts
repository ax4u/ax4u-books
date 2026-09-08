export const STORAGE_KEY = "gobibi.first-whale.v1";
export const MOODS = {
  rest: { label: "느긋하게", line: "서두르지 않아도 괜찮아. 바람을 따라 천천히.", symbol: "☁" },
  adventure: { label: "모험하기", line: "오늘은 조금 더 멀리. 저 구름 너머까지 갈까?", symbol: "↗" },
  together: { label: "곁에 있기", line: "멀리 가지 않을게. 오늘은 네 곁에서.", symbol: "♡" },
} as const;
export type Mood = keyof typeof MOODS;
export type WhaleState = {
  version: 1;
  id?: string;
  name: string;
  line: string;
  born: string;
  mood: Mood;
  metrics: { moves: number; cards: number; visits: number };
};
export type ParseWhaleResult = { status: "empty" | "corrupt"; whale: null } | { status: "valid"; whale: WhaleState };
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const metric = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < 1e7;
export function normalizeWhaleFields(name: string, line: string): { name: string; line: string } | null {
  const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const fields = { name: clean(name), line: clean(line) };
  return fields.name.length > 0 && fields.name.length <= 20 && fields.line.length <= 80 ? fields : null;
}
/** Whitelist fields; never merge untrusted localStorage objects into application state. */
export function normalizeWhaleState(value: unknown): WhaleState | null {
  if (!record(value) || value.version !== 1 || typeof value.name !== "string" || typeof value.line !== "string" || value.name.length > 20 || value.line.length > 80 || typeof value.born !== "string" || !Number.isFinite(Date.parse(value.born)) || typeof value.mood !== "string" || !Object.hasOwn(MOODS, value.mood) || !record(value.metrics)) return null;
  const fields = normalizeWhaleFields(value.name, value.line);
  if (!fields || !metric(value.metrics.moves) || !metric(value.metrics.cards) || !metric(value.metrics.visits)) return null;
  if (value.id !== undefined && (typeof value.id !== "string" || value.id.length > 200)) return null;
  return { version: 1, ...fields, born: value.born, mood: value.mood as Mood, metrics: { moves: value.metrics.moves, cards: value.metrics.cards, visits: value.metrics.visits }, ...(typeof value.id === "string" ? { id: value.id } : {}) };
}
export function parseWhaleState(raw: string | null): ParseWhaleResult {
  if (raw === null) return { status: "empty", whale: null };
  try {
    const whale = normalizeWhaleState(JSON.parse(raw));
    return whale ? { status: "valid", whale } : { status: "corrupt", whale: null };
  } catch { return { status: "corrupt", whale: null }; }
}
export function incrementMetric(whale: WhaleState, key: keyof WhaleState["metrics"]): WhaleState {
  return { ...whale, metrics: { ...whale.metrics, [key]: Math.min(9_999_999, whale.metrics[key] + 1) } };
}
export type ReturnIntent = "yes" | "maybe" | "no";
export type PurchaseIntent = "unsure" | "free-only" | "consider";
export type Feedback = { returnIntent: ReturnIntent; reason: string; purchaseIntent: PurchaseIntent };
export function normalizeFeedback(value: unknown): Feedback | null {
  if (!record(value) || !["yes", "maybe", "no"].includes(String(value.returnIntent)) || !["unsure", "free-only", "consider"].includes(String(value.purchaseIntent)) || typeof value.reason !== "string") return null;
  return { returnIntent: value.returnIntent as ReturnIntent, reason: value.reason.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300), purchaseIntent: value.purchaseIntent as PurchaseIntent };
}
/** Explicit allowlist: no companion name, story, id, birthday, URL, or identifiers. */
export function createFeedbackPayload(value: unknown, whale: WhaleState | null) {
  const feedback = normalizeFeedback(value);
  if (!feedback) return null;
  return {
    prototype: "gobibi-first-whale-v0.1",
    ...feedback,
    observations: { destinationsSet: whale?.metrics.moves ?? 0, cardsDownloaded: whale?.metrics.cards ?? 0, returned: (whale?.metrics.visits ?? 0) > 1 },
    notice: "Self-reported small prototype feedback. No purchase or public adoption occurred.",
  };
}
