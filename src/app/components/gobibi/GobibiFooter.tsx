import Link from "next/link";
import styles from "./gobibi.module.css";
export default function GobibiFooter() {
  return <footer className={styles.footer} data-gobibi-footer>
    <div className={styles.footerTop}><Link href="/" className={styles.footerBrand}>GOBIBI <span>× SANG#MUNG</span></Link><p>작은 상상과<br />오래 함께하는 세계.</p><nav aria-label="하단 메뉴"><Link href="/my-whale">나의 고래 ↗</Link><Link href="/#world">고비비 세계관 ↗</Link><Link href="/exhibition">그림책 둘러보기 ↗</Link><Link href="/#studio">캐릭터 체험 ↗</Link><a href="mailto:7pmbooks@gmail.com">전시 이용 문의 ↗</a></nav></div>
    <div className={styles.footerBottom}><span>운영 · AX4U Books</span><p>공개 승인을 받은 작품의 비상업 무료 전시입니다.<br />유료 제작·판매·상업 협업은 운영하지 않습니다.</p><Link href="/">BACK TO THE SKY ↑</Link></div>
  </footer>;
}
