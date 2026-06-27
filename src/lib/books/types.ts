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
  /** Prompt used to (re)generate this page's illustration. Enables resuming. */
  imagePrompt?: string;
  /** Legacy/mock illustration data URL. New Supabase-backed books use imagePath. */
  image?: string | null;
  /** Private Supabase Storage path for the illustration. */
  imagePath?: string | null;
  imageMime?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageBytes?: number | null;
};

export type Book = {
  id: string;
  userId: string;
  topic: string;
  title: string | null;
  options: BookOptions;
  status: BookStatus;
  pages: BookPage[];
  coverImagePath: string | null;
  pdfPath: string | null;
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

export type BookSummary = {
  id: string;
  userId: string;
  topic: string;
  title: string | null;
  status: BookStatus;
  coverImagePath: string | null;
  /** Legacy/mock cover image data URL. */
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
};
