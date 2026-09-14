import { z } from "zod";

export const approvedTitles = [
  "사랑종말처리장 – 에필로그: 흐려진 사랑이 다시 흐르기까지",
  "엄마는 꿈꾸던 어른이야?",
  "상멍이와 해온, 다시 바다로",
] as const;

const asset = z.string().regex(/^\/published-exhibition\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9][a-z0-9.-]*\.(?:webp|pdf)$/);
export const exhibitionPageSchema = z.object({
  src: asset.refine(value => value.endsWith(".webp")),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  label: z.string().trim().min(1),
}).strict();
export const exhibitionBookSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(value => value !== "planet-friends"),
  title: z.enum(approvedTitles),
  description: z.string().trim().min(1),
  author: z.string().trim().min(1),
  cover: exhibitionPageSchema,
  readingPdf: asset.refine(value => value.endsWith(".pdf")).optional(),
  pages: z.array(exhibitionPageSchema).min(2),
}).strict().superRefine((book, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (JSON.stringify(book.cover) !== JSON.stringify(book.pages[0])) issue("cover must equal the first manifest page");
  const prefix = `/published-exhibition/${book.slug}/`;
  if (![book.cover.src, ...(book.readingPdf ? [book.readingPdf] : []), ...book.pages.map(page => page.src)].every(src => src.startsWith(prefix))) issue("assets must belong to this book");
  if (new Set(book.pages.map(page => page.src)).size !== book.pages.length) issue("duplicate page asset");
});
export const exhibitionCatalogSchema = z.array(exhibitionBookSchema).superRefine((books, ctx) => {
  // An empty catalog is the safe preparation state, never substitute sample books.
  if (books.length !== 0 && (books.length !== 3 || new Set(books.map(book => book.title)).size !== 3 || new Set(books.map(book => book.slug)).size !== 3)) {
    ctx.addIssue({ code: "custom", message: "catalog must be empty or contain exactly the three approved unique works" });
  }
});
export type ExhibitionBook = z.infer<typeof exhibitionBookSchema>;
