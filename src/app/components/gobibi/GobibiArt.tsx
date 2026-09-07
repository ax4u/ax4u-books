"use client";
/* eslint-disable @next/next/no-img-element -- Original, pre-optimized local world artwork and canonical mascot sprites. */
import { useState } from "react";
import styles from "./gobibi.module.css";
export type GobibiScene = "arrival" | "library" | "studio" | "press";
const scenes = {
  arrival: { label: "WELCOME ABOARD", name: "구름 도착 부두", caption: "어서 와요. 네 이야기를 기다렸어요." },
  library: { label: "THE SKY LIBRARY", name: "고비비 하늘 도서관", caption: "책 한 권마다, 새로운 하늘이 열려요." },
  studio: { label: "STORY WORKSHOP", name: "상멍이의 이야기 작업실", caption: "첫 장은, 한 줄이면 충분해요." },
  press: { label: "PAPER ATELIER", name: "고비비 종이 공방", caption: "화면의 이야기를 종이 위로, 차근차근." },
};
export default function GobibiArt({ scene = "library", className = "", quiet = false }: { scene?: GobibiScene; className?: string; quiet?: boolean }) {
  const [paused, setPaused] = useState(false);
  const info = scenes[scene];
  return <figure className={`${styles.art} ${className}`} data-gobibi-art={scene} data-motion={quiet || paused ? "paused" : "playing"}>
    <div className={styles.artWindow}><img className={styles.landscape} src={`/home/gobibi/${scene}.webp`} alt={`${info.name} — 크림색 구름과 하늘을 나는 고래가 있는 수공예풍 풍경`} width="1536" height="1024" />
      <img className={styles.artMascot} src="/home/gobibi/sangmung.webp" alt="" width="787" height="1267" aria-hidden="true" />
      <span className={styles.artLabel}>{info.label}</span>
      {!quiet && <button type="button" className={styles.motionToggle} onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? "배경 움직임 재생" : "배경 움직임 멈추기"}><span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span></button>}
    </div>
    <figcaption><span aria-hidden="true">✳</span>{info.caption}</figcaption>
  </figure>;
}
