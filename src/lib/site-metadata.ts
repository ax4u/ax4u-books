import type { Metadata } from "next";

export const SITE_ORIGIN = "https://gobibi.art";
export const SITE_TITLE = "GOBIBI × 상멍이 — 고래가 나는 곳, 이야기가 태어나는 곳";
export const SITE_DESCRIPTION = "고래들의 이상향 고비비. 상멍이를 만나고, 나만의 캐릭터와 그림책 이야기를 펼쳐보세요.";

// A versioned JPEG built from the existing homepage world + Sangmung assets.
// All domains and subpages inherit this brand visual, never a reader's book cover.
export const SHARE_IMAGE = {
  url: `${SITE_ORIGIN}/social/gobibi-keyvisual-v1.jpg`,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "GOBIBI 고비비 — 하늘을 나는 고래들의 세계와 그림책 만들기를 돕는 상멍이",
};

export const brandSocialMetadata = {
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "GOBIBI × 상멍이",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: SHARE_IMAGE.url, alt: SHARE_IMAGE.alt }],
  },
} satisfies Metadata;
