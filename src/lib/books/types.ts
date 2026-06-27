export type BookStatus =
  | "draft" // created, awaiting payment
  | "paid" // payment confirmed, generation queued
  | "generating" // AI is producing text + images
  | "completed" // ready, PDF can be downloaded
  | "failed";

export type BookOptions = {
  style: string; // e.g. "watercolor", "cartoon"
  pageCount: number; // number of illustrated spreads
  ageGroup: string; // e.g. "3-5"
  language: string; // e.g. "ko", "en"
};

export type BookPage = {
  index: number;
  text: string;
  /** Illustration as a data URL (data:image/png;base64,...) or a public URL. */
  image: string | null;
};

export type Book = {
  id: string;
  userId: string;
  topic: string;
  title: string | null;
  options: BookOptions;
  status: BookStatus;
  pages: BookPage[];
  /** Polar checkout id, used to correlate webhooks. */
  checkoutId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBookInput = {
  userId: string;
  topic: string;
  options: BookOptions;
};
