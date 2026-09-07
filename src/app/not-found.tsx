import Link from "next/link";
import GobibiShell from "./components/gobibi/GobibiShell";
import PageHero from "./components/gobibi/PageHero";
import styles from "./components/gobibi/gobibi.module.css";
export default function NotFound() {
  return <GobibiShell theme="sky"><main className={styles.stateMain} data-gobibi-not-found><PageHero eyebrow="404 — A LITTLE DETOUR" title={<>이쪽 하늘에는<br />아직 이야기가 없어요.</>} description="주소가 바뀌었거나, 지금은 열 수 없는 페이지예요. 상멍이와 함께 아는 길로 돌아갈까요?" scene="arrival"><Link className={styles.primaryButton} href="/">고비비 홈으로 ↗</Link><Link className={styles.secondaryButton} href="/exhibition">전시회 둘러보기</Link></PageHero></main></GobibiShell>;
}
