import Link from "next/link";
import GobibiArt from "./components/gobibi/GobibiArt";
import styles from "./components/gobibi/gobibi.module.css";
export default function Loading() {
  return <div className={styles.shell} data-gobibi-shell><header className={styles.header}><Link href="/" className={styles.brand}>GOBIBI</Link><span className={styles.eyebrow}>A MOMENT IN THE SKY</span></header><main className={styles.loadingMain} aria-busy="true"><GobibiArt scene="library" quiet/><div role="status" aria-live="polite"><h1>이야기를 펼치고 있어요.</h1><p>잠시만 기다려 주세요.</p><div className={styles.loadingDots} aria-hidden="true"><i/><i/><i/></div></div></main></div>;
}
