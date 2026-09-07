import type { ReactNode } from "react";
import GobibiArt, { type GobibiScene } from "./GobibiArt";
import styles from "./gobibi.module.css";

export default function PageHero({ eyebrow, title, description, scene = "library", compact = false, children }: { eyebrow: string; title: ReactNode; description?: ReactNode; scene?: GobibiScene; compact?: boolean; children?: ReactNode }) {
  return <section className={`${styles.hero} ${compact ? styles.compactHero : ""}`} data-page-hero>
    <div className={styles.heroCopy}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1>{description && <div className={styles.heroDescription}>{description}</div>}{children && <div className={styles.heroActions}>{children}</div>}<span className={styles.routeNote}>GOBIBI · 작은 상상이 머무는 곳</span></div>
    <GobibiArt scene={scene} className={styles.heroArt} />
  </section>;
}
