import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import "./globals.css";

const nanumGothic = localFont({
  src: "../../public/fonts/NanumGothic-Regular.ttf",
  variable: "--font-nanum-gothic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AX4U Books — AI 그림책 생성",
  description:
    "주제만 입력하면 AI가 글과 그림이 있는 나만의 그림책 PDF를 만들어 드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nanumGothic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
