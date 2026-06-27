import type { BookStatus } from "@/lib/books/types";

export function statusLabel(status: BookStatus): string {
  switch (status) {
    case "draft":
      return "결제 대기";
    case "paid":
      return "생성 준비";
    case "generating":
      return "생성 중";
    case "completed":
      return "완성";
    case "failed":
      return "실패";
  }
}

export function statusClass(status: BookStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
    case "generating":
    case "paid":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    case "failed":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}
