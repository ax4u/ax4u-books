import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { hasPageImage } from "./images";
import type { Book, BookPage, BookSummary, CreateBookInput } from "./types";

/**
 * Data access for books. Backed by Supabase when configured, otherwise by an
 * in-memory map (persisted on globalThis so it survives dev hot-reloads).
 *
 * `admin: true` uses the service-role client (bypasses RLS) — used by webhook
 * and generation code that runs without a user session.
 */

// ---------------------------------------------------------------------------
// Mock (in-memory) store
// ---------------------------------------------------------------------------

const globalForBooks = globalThis as unknown as {
  __mockBooks?: Map<string, Book>;
};
const mockBooks = (globalForBooks.__mockBooks ??= new Map<string, Book>());

const nowIso = () => new Date().toISOString();

function mockCreate(input: CreateBookInput): Book {
  const id = randomUUID();
  const book: Book = {
    id,
    userId: input.userId,
    topic: input.topic,
    title: null,
    options: input.options,
    status: "draft",
    pages: [],
    coverImagePath: null,
    pdfPath: null,
    checkoutId: null,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  mockBooks.set(id, book);
  return book;
}

// ---------------------------------------------------------------------------
// Supabase store
// ---------------------------------------------------------------------------

type Client = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

async function getClient(admin: boolean): Promise<Client | null> {
  if (admin) return createSupabaseAdminClient() as unknown as Client | null;
  return createSupabaseServerClient();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToBook(row: any): Book {
  return {
    id: row.id,
    userId: row.user_id,
    topic: row.topic,
    title: row.title,
    options: row.options,
    status: row.status,
    pages: row.pages ?? [],
    coverImagePath: row.cover_image_path ?? null,
    pdfPath: row.pdf_path ?? null,
    checkoutId: row.checkout_id,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bookToRow(patch: Partial<Book>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.userId !== undefined) row.user_id = patch.userId;
  if (patch.topic !== undefined) row.topic = patch.topic;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.options !== undefined) row.options = patch.options;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.pages !== undefined) row.pages = patch.pages;
  if (patch.coverImagePath !== undefined) {
    row.cover_image_path = patch.coverImagePath;
  }
  if (patch.pdfPath !== undefined) row.pdf_path = patch.pdfPath;
  if (patch.checkoutId !== undefined) row.checkout_id = patch.checkoutId;
  if (patch.error !== undefined) row.error = patch.error;
  row.updated_at = nowIso();
  return row;
}

function rowToSummary(row: any): BookSummary {
  const pages = (row.pages ?? []) as BookPage[];
  const cover = firstCover(pages);
  return {
    id: row.id,
    userId: row.user_id,
    topic: row.topic,
    title: row.title,
    status: row.status,
    coverImagePath: row.cover_image_path ?? cover?.imagePath ?? null,
    coverImage: cover?.image ?? null,
    pageCount: Number(row.options?.pageCount ?? pages.length ?? 0),
    imagesReady: pages.filter(hasPageImage).length,
    error: row.error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function bookToSummary(book: Book): BookSummary {
  const cover = firstCover(book.pages);
  return {
    id: book.id,
    userId: book.userId,
    topic: book.topic,
    title: book.title,
    status: book.status,
    coverImagePath: book.coverImagePath ?? cover?.imagePath ?? null,
    coverImage: cover?.image ?? null,
    pageCount: book.options.pageCount,
    imagesReady: book.pages.filter(hasPageImage).length,
    error: book.error,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

function firstCover(pages: BookPage[]): BookPage | undefined {
  return [...pages]
    .sort((a, b) => a.index - b.index)
    .find((p) => p.imagePath || p.image);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createBook(input: CreateBookInput): Promise<Book> {
  if (!isSupabaseConfigured) return mockCreate(input);

  const supabase = await getClient(false);
  const { data, error } = await supabase!
    .from("books")
    .insert(bookToRow({ ...input, status: "draft", pages: [] }))
    .select()
    .single();
  if (error) throw new Error(`createBook: ${error.message}`);
  return rowToBook(data);
}

export async function getBook(
  id: string,
  opts: { admin?: boolean } = {},
): Promise<Book | null> {
  if (!isSupabaseConfigured) return mockBooks.get(id) ?? null;

  const supabase = await getClient(opts.admin ?? false);
  const { data, error } = await supabase!
    .from("books")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getBook: ${error.message}`);
  return data ? rowToBook(data) : null;
}

export async function listBooks(userId: string): Promise<Book[]> {
  if (!isSupabaseConfigured) {
    return [...mockBooks.values()]
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const supabase = await getClient(false);
  const { data, error } = await supabase!
    .from("books")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listBooks: ${error.message}`);
  return (data ?? []).map(rowToBook);
}

export async function listBookSummaries(userId: string): Promise<BookSummary[]> {
  if (!isSupabaseConfigured) {
    return [...mockBooks.values()]
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(bookToSummary);
  }

  const supabase = await getClient(false);
  const { data, error } = await supabase!
    .from("books")
    .select(
      "id,user_id,topic,title,options,status,pages,cover_image_path,error,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listBookSummaries: ${error.message}`);
  return (data ?? []).map(rowToSummary);
}

export async function updateBook(
  id: string,
  patch: Partial<Book>,
  opts: { admin?: boolean } = {},
): Promise<Book> {
  if (!isSupabaseConfigured) {
    const existing = mockBooks.get(id);
    if (!existing) throw new Error(`updateBook: ${id} not found`);
    const updated: Book = { ...existing, ...patch, updatedAt: nowIso() };
    mockBooks.set(id, updated);
    return updated;
  }

  const supabase = await getClient(opts.admin ?? false);
  const { data, error } = await supabase!
    .from("books")
    .update(bookToRow(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateBook: ${error.message}`);
  return rowToBook(data);
}

export async function deleteBook(
  id: string,
  opts: { userId?: string; admin?: boolean } = {},
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockBooks.delete(id);
    return;
  }

  const supabase = await getClient(opts.admin ?? false);
  let query = supabase!.from("books").delete().eq("id", id);
  if (!opts.admin && opts.userId) query = query.eq("user_id", opts.userId);
  const { error } = await query;
  if (error) throw new Error(`deleteBook: ${error.message}`);
}

/** Find a book by its Polar checkout id (used by the webhook). */
export async function getBookByCheckoutId(
  checkoutId: string,
): Promise<Book | null> {
  if (!isSupabaseConfigured) {
    return (
      [...mockBooks.values()].find((b) => b.checkoutId === checkoutId) ?? null
    );
  }

  const supabase = await getClient(true);
  const { data, error } = await supabase!
    .from("books")
    .select()
    .eq("checkout_id", checkoutId)
    .maybeSingle();
  if (error) throw new Error(`getBookByCheckoutId: ${error.message}`);
  return data ? rowToBook(data) : null;
}
