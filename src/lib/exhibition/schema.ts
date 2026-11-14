import { z } from "zod";

export const approvedTitles = [
  "사랑종말처리장 – 에필로그: 흐려진 사랑이 다시 흐르기까지",
  "엄마는 꿈꾸던 어른이야?",
  "상멍이와 해온, 다시 바다로",
  "빌더갈릭과 마늘 로봇 알리",
  "상멍이와 종이배 약속",
  "보리의 첫 물놀이",
  "후추&베리",
  "수수의 팝콘 가게",
  "별빛을 건너는 우주여행",
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
  coverPageIndex: z.number().int().nonnegative().optional(),
  reviewNotice: z.string().trim().min(1).optional(),
  fullCover: exhibitionPageSchema.optional(),
  readingPdf: asset.refine(value => value.endsWith(".pdf")).optional(),
  pages: z.array(exhibitionPageSchema).min(2),
}).strict().superRefine((book, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (JSON.stringify(book.cover) !== JSON.stringify(book.pages[book.coverPageIndex ?? 0])) issue("cover must equal the selected manifest page");
  const prefix = `/published-exhibition/${book.slug}/`;
  if (![book.cover.src, ...(book.fullCover ? [book.fullCover.src] : []), ...(book.readingPdf ? [book.readingPdf] : []), ...book.pages.map(page => page.src)].every(src => src.startsWith(prefix))) issue("assets must belong to this book");
  if (new Set(book.pages.map(page => page.src)).size !== book.pages.length) issue("duplicate page asset");
});
export const exhibitionCatalogSchema = z.array(exhibitionBookSchema).superRefine((books, ctx) => {
  // An empty catalog is the safe preparation state, never substitute sample books.
  if (books.length !== 0 && (books.length !== approvedTitles.length || new Set(books.map(book => book.title)).size !== approvedTitles.length || new Set(books.map(book => book.slug)).size !== approvedTitles.length)) {
    ctx.addIssue({ code: "custom", message: "catalog must be empty or contain all approved unique works" });
  }
});
export type ExhibitionBook = z.infer<typeof exhibitionBookSchema>;
