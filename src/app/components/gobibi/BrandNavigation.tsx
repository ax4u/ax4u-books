"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import FlightLink from "./FlightLink";
import MyWhaleLink from "./MyWhaleLink";
import styles from "./gobibi.module.css";
export default function BrandNavigation({ authenticated, children }: { authenticated: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [{href:"/#world",label:"고비비 세계관"},{href:"/exhibition",label:"오픈 그림책 전시회"},{href:"/#studio",label:"캐릭터 체험"},...(authenticated ? [{href:"/dashboard",label:"내 그림책"}] : [])];
  return <header className={styles.header} onKeyDown={event => { if(event.key === "Escape") setOpen(false); }}>
    <Link href="/" className={styles.brand} aria-label="GOBIBI 홈">GOBIBI <small>× SANG#MUNG<br />상상이 머무는 섬</small></Link>
    <button type="button" className={styles.menuToggle} aria-expanded={open} aria-controls="gobibi-navigation" aria-label={open ? "메뉴 닫기" : "메뉴 열기"} onClick={() => setOpen(!open)}>{open ? "닫기 ×" : "메뉴 +"}</button>
    <nav id="gobibi-navigation" className={styles.navigation} data-open={open} aria-label="주 메뉴" onClick={() => setOpen(false)}>
      <MyWhaleLink current={pathname === "/my-whale"} />
      {links.map(link => <Link key={link.href} href={link.href} prefetch={link.href === "/create" || link.href === "/dashboard" ? false : undefined} aria-current={pathname === link.href || (link.href === "/exhibition" && pathname.startsWith("/exhibition/")) ? "page" : undefined}>{link.label}</Link>)}
      <FlightLink>고래들의 비상 ↗</FlightLink>
      {authenticated ? <div className={styles.account}>{children}</div> : <Link href="/login" className={styles.loginLink} aria-current={pathname === "/login" ? "page" : undefined}>시작하기 <span aria-hidden="true">↗</span></Link>}
    </nav>
  </header>;
}
