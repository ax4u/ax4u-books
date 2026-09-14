"use client";

import { useSyncExternalStore } from "react";
import type { ExhibitionBook } from "@/lib/exhibition/catalog";
import Reader from "./Reader";
import MobileReader from "./MobileReader";

// Orientation changes on a phone must never switch components or reset position.
const query = "(max-width: 600px), (pointer: coarse) and (max-width: 1100px)";
function subscribe(update: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;
export default function ResponsiveReader({ book }: { book: ExhibitionBook }) {
  const mobile = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return mobile ? <MobileReader book={book} /> : <Reader book={book} />;
}
