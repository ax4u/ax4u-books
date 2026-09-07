"use client";
import Link from "next/link";
import BrandNavigation from "./components/gobibi/BrandNavigation";
import GobibiFooter from "./components/gobibi/GobibiFooter";
import GobibiArt from "./components/gobibi/GobibiArt";
import styles from "./components/gobibi/gobibi.module.css";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className={styles.shell} data-gobibi-shell><BrandNavigation authenticated={false}/><main className={styles.stateMain} data-gobibi-error><section className={styles.hero}><div className={styles.heroCopy}><p className={styles.eyebrow}>A CLOUD IN THE WAY</p><h1>잠깐, 구름이<br />길을 가렸어요.</h1><p className={styles.heroDescription}>화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요. 이 안내만으로 결제나 작업 완료 여부를 판단하지 마세요.</p><div className={styles.heroActions}><button type="button" className={styles.primaryButton} onClick={reset}>다시 불러오기 ↻</button><Link className={styles.secondaryButton} href="/">고비비 홈으로</Link></div></div><GobibiArt scene="arrival" quiet/></section></main><GobibiFooter/></div>;
}
