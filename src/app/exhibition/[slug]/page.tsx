import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBook, publishedBooks } from "@/lib/exhibition/catalog";
import Reader from "./Reader";

export const dynamicParams = false;
export function generateStaticParams() { return publishedBooks.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  return { title: `${book.title} | 오픈 그림책 전시회`, description: book.description };
}
export default async function ExhibitionReader({ params }: { params: Promise<{ slug: string }> }) {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  return <main lang="ko" className="min-h-dvh bg-[#141823] px-3 py-4 text-white sm:px-6">
    <div className="mx-auto max-w-6xl"><Link href="/exhibition" className="inline-block py-2 text-sm text-violet-200 underline underline-offset-4">← 오픈 그림책 전시회</Link>
      <h1 className="my-3 text-center text-xl font-bold sm:text-2xl">{book.title}</h1>
      <Reader book={book} />
    </div>
  </main>;
}
