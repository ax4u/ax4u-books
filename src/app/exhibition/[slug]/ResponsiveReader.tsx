"use client";

import dynamic from "next/dynamic";
import type { ExhibitionBook } from "@/lib/exhibition/catalog";

// One mounted reader owns the absolute source page across viewport changes.
// Browser-only portal and media queries must not run during server rendering.
const Flipbook = dynamic(() => import("./MobileReader"), {
  ssr: false,
  loading: () => <p role="status">그림책을 펼치고 있어요…</p>,
});
export default function ResponsiveReader({ book }: { book: ExhibitionBook }) {
  return <Flipbook book={book} />;
}
