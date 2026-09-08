"use client";
import { useEffect, useRef } from "react";
import { orderedSpecies, speciesById, type FlightView, type SpeciesOrder, type WhaleSpeciesId } from "./species";
import styles from "./species.module.css";

type Props = { active: WhaleSpeciesId; order: SpeciesOrder; view: FlightView; onSelect: (id: WhaleSpeciesId) => void; onOrder: (order: SpeciesOrder) => void; onView: (mode: FlightView) => void };
export default function SpeciesNavigator({active, order, view, onSelect, onOrder, onView}: Props) {
  const list = useRef<HTMLDivElement>(null);
  const species = speciesById(active);
  const ordered = orderedSpecies(order);
  useEffect(() => {
    const item = list.current?.querySelector<HTMLButtonElement>(`[data-species="${active}"]`);
    if (item && list.current) {
      const left = item.offsetLeft - list.current.offsetLeft;
      if (left < list.current.scrollLeft || left + item.offsetWidth > list.current.scrollLeft + list.current.clientWidth) {
        list.current.scrollTo({left: left - list.current.clientWidth / 2 + item.offsetWidth / 2, behavior: "instant"});
      }
    }
  }, [active, order]);
  return <>
    {view === "flight" && <section className={styles.spotlight} aria-label="지금 만나는 고래" data-active-card={active}>
      <p className={styles.kicker}>MEET THE WHALES <span>{String(ordered.findIndex(item => item.id === active) + 1).padStart(2, "0")} / 10</span></p>
      <h2>{species.name}<span>{species.length}<small>m</small></span></h2>
      <p className={styles.feature}>{species.feature}</p>
      <p className={styles.scientific}>{species.scientific}</p>
    </section>}
    <nav className={styles.navigator} aria-label="고래 10종 탐색">
      <div className={styles.toolbar}>
        <div className={styles.toggle} aria-label="고래 보기 방식">
          <button type="button" aria-pressed={view === "flight"} onClick={() => onView("flight")}>자유비행</button>
          <button type="button" aria-pressed={view === "compare"} onClick={() => onView("compare")}>크기 비교</button>
        </div>
        <div className={styles.sort} aria-label="고래 소개 순서">
          <button type="button" aria-pressed={order === "size"} onClick={() => onOrder("size")}>크기순</button>
          <button type="button" aria-pressed={order === "familiar"} onClick={() => onOrder("familiar")}>유명한 종 먼저</button>
        </div>
      </div>
      <div className={styles.list} ref={list}>
        {ordered.map((item, index) => <button key={item.id} type="button" data-species={item.id} aria-label={`${item.name} 보기`} aria-pressed={item.id === active} className={styles.species} onClick={() => onSelect(item.id)}>
          <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><small>{item.length} m</small>
        </button>)}
      </div>
      <p className={styles.note}>{view === "compare" ? "동일 축척 · 같은 거리의 측면 비교" : "종별 근접 비행 · 원근에 따라 화면 크기는 달라집니다"}<span> / 비교용 대표 몸길이 · 일각고래 엄니 별도</span></p>
      <span className={styles.srOnly}>유명한 종 먼저는 편집상 소개 순서이며 통계로 측정한 인기 순위가 아닙니다. 실제 크기는 성별과 지역에 따라 다릅니다.</span>
    </nav>
  </>;
}
