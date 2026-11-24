import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-metadata";
import { publishedBooks } from "@/lib/exhibition/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_ORIGIN + "/", changeFrequency: "weekly", priority: 1 },
    { url: SITE_ORIGIN + "/exhibition", changeFrequency: "weekly", priority: 0.9 },
    { url: SITE_ORIGIN + "/jinhae-map", changeFrequency: "monthly", priority: 0.8 },
    ...publishedBooks.filter(book => book.slug !== "planet-friends").map(book => ({
      url: SITE_ORIGIN + "/exhibition/" + encodeURIComponent(book.slug),
      changeFrequency: "monthly" as const, priority: 0.7,
    })),
  ];
}
