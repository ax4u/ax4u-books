"use client";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import ErrorPage from "./error";
const bodyFont = localFont({ src: "../../public/fonts/NanumGothic-Regular.ttf", variable: "--font-nanum-gothic", display: "swap" });
const brandFont = localFont({ src: "../../public/fonts/gobibi/BagelFatOne-korean.ttf", variable: "--font-gobibi", display: "swap" });
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }): ReactNode {
  return <html lang="ko" className={`${bodyFont.variable} ${brandFont.variable}`}><body style={{margin:0,background:"#fff9e9",color:"#12375a"}}><ErrorPage {...props}/></body></html>;
}
