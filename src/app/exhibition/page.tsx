import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/Header";
import { publishedBooks } from "@/lib/exhibition/catalog";

export const metadata: Metadata = { title: "오픈 그림책 전시회 | AX4U Books", description: "로그인 없이 누구나 감상하는 공개 그림책 전시회." };

export default function ExhibitionPage() {
  return <div lang="ko" className="flex min-h-screen flex-col">
    <Header />
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="mb-3 text-sm font-semibold text-violet-600 dark:text-violet-300">함께 펼치는 이야기</p>
      <h1 className="text-3xl font-bold sm:text-4xl">오픈 그림책 전시회</h1>
      <p className="mb-10 mt-4 text-zinc-600 dark:text-zinc-400">공개가 승인된 그림책을 로그인 없이 자유롭게 감상하세요.</p>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {publishedBooks.map(book => <Link key={book.slug} href={`/exhibition/${book.slug}`} className="group overflow-hidden rounded-2xl border border-zinc-200 shadow-sm focus-visible:outline-4 focus-visible:outline-violet-600 dark:border-zinc-700">
          <div className="bg-violet-50 p-5 dark:bg-zinc-900"><Image src={book.pages[0].src} alt={`${book.title} 앞표지`} width={book.pages[0].width} height={book.pages[0].height} sizes="(max-width: 640px) 90vw, 320px" className="aspect-square w-full object-contain" /></div>
          <div className="p-6"><p className="text-xs text-violet-600 dark:text-violet-300">공개 작품 · 앞표지 + 본문 28쪽</p><h2 className="mt-2 text-xl font-bold group-hover:underline">{book.title}</h2><p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{book.description}</p><p className="mt-5 font-semibold">그림책 펼치기 →</p></div>
        </Link>)}
      </div>
    </main>
  </div>;
}
