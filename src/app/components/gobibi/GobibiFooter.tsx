import Link from "next/link";
import styles from "./gobibi.module.css";
export default function GobibiFooter() {
  return <footer className={styles.footer} data-gobibi-footer>
    <div className={styles.footerTop}><Link href="/" className={styles.footerBrand}>GOBIBI <span>× SANGMUNG</span></Link><p>작은 상상과<br />오래 함께하는 세계.</p><nav aria-label="하단 메뉴"><Link href="/#world">고비비 세계관 ↗</Link><Link href="/exhibition">그림책 둘러보기 ↗</Link><Link href="/create" prefetch={false}>이야기 만들기 ↗</Link><a href="mailto:7pmbooks@gmail.com">협업 문의 ↗</a></nav></div>
    <div className={styles.footerBottom}><span>운영 · AX4U Books</span><p>그림책은 공개 승인을 받은 작품만 전시합니다.<br />종이책 판매·결제·주문·배송은 준비 중입니다.</p><Link href="/">BACK TO THE SKY ↑</Link></div>
  </footer>;
}
