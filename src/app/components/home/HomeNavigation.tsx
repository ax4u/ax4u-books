"use client";
import {useState} from 'react';
import Link from 'next/link';
import FlightLink from '../gobibi/FlightLink';
import styles from '../../home.module.css';
export default function HomeNavigation(){
 const [open,setOpen]=useState(false);
 return <header className={styles.header}><Link href="/" className={styles.logo} aria-label="GOBIBI 홈">GOBIBI <small>상멍이 IP WORLD</small></Link><button type="button" className={styles.menuButton} aria-expanded={open} aria-controls="home-navigation" onClick={()=>setOpen(!open)}>{open?'메뉴 닫기 −':'메뉴 열기 +'}</button><nav id="home-navigation" className={styles.navigation} data-open={open} aria-label="홈페이지 메뉴" onClick={()=>setOpen(false)}><Link href="#world">WORLD</Link><Link href="#sangmung">CHARACTER</Link><Link href="/exhibition" aria-label="오픈 그림책 전시회">오픈 그림책 전시회</Link><FlightLink>고래들의 비상 ↗</FlightLink><Link href="#studio">STUDIO</Link><Link href="/dashboard" prefetch={false}>내 그림책</Link><Link href="/login" prefetch={false} className={styles.login}>로그인 <span aria-hidden="true">↗</span></Link></nav></header>;
}
