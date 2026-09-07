import type { ReactNode } from "react";
import Header from "@/app/components/Header";
import GobibiFooter from "./GobibiFooter";
import styles from "./gobibi.module.css";

export default function GobibiShell({ children, theme = "cream", className = "" }: { children: ReactNode; theme?: "sky" | "cream" | "peach"; className?: string }) {
  return <div className={`${styles.shell} ${className}`} data-gobibi-shell data-theme={theme}>
    <a className={styles.skipLink} href="#gobibi-main">본문 바로가기</a>
    <Header />
    <div id="gobibi-main" className={styles.content} tabIndex={-1}>{children}</div>
    <GobibiFooter />
  </div>;
}
