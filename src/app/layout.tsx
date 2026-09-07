import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import "./globals.css";

const nanumGothic = localFont({
  src: "../../public/fonts/NanumGothic-Regular.ttf",
  variable: "--font-nanum-gothic",
  display: "swap",
});

const gobibiFont = localFont({
  src: "../../public/fonts/gobibi/BagelFatOne-korean.ttf",
  variable: "--font-gobibi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GOBIBI × 상멍이 — 작은 상상이 머무는 세계",
  description: "고래가 나는 세계 고비비. 상멍이와 나만의 이야기를 만들고, 그림책을 펼쳐 보세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${nanumGothic.variable} ${gobibiFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
