"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Leaflet is loaded from a vendored UMD build and has no installed type package. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./porpoise-map.module.css";
import {
  MONTHS,
  PORTS,
  PREY,
  REGIONS,
  TIME_SLOTS,
  bearing,
  formatMinutes,
  monthLabel,
  monthlyBest,
  pointAlong,
  preyById,
  rankRegions,
  regionById,
  routeFor,
  type RankedRegion,
  type SlotId,
} from "@/lib/jinhae/porpoise-data";

type BaseId = "ocean" | "satellite" | "light";

const BASES: { id: BaseId; label: string; url: string; attribution: string; maxNativeZoom: number }[] = [
  {
    id: "ocean",
    label: "바다 지도",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — GEBCO, NOAA, National Geographic, HERE",
    maxNativeZoom: 10,
  },
  {
    id: "satellite",
    label: "위성",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri, Maxar, Earthstar Geographics",
    maxNativeZoom: 17,
  },
  {
    id: "light",
    label: "밝은 지도",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap contributors © CARTO",
    maxNativeZoom: 19,
  },
];

const LEAFLET_CSS = "/vendor/leaflet/leaflet.css";
const LEAFLET_JS = "/vendor/leaflet/leaflet.js";

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const existing = (window as any).L;
  if (existing) return Promise.resolve(existing);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => {
      const L = (window as any).L;
      if (L) resolve(L);
      else reject(new Error("leaflet unavailable"));
    };
    script.onerror = () => reject(new Error("leaflet failed to load"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function JinhaeMapExplorer({ initialMonth }: { initialMonth: number }) {
  const [month, setMonth] = useState(initialMonth);
  const [slot, setSlot] = useState<SlotId>("morning");
  const [portId, setPortId] = useState(PORTS[0].id);
  const [activePrey, setActivePrey] = useState<string[]>(["anchovy"]);
  const [base, setBase] = useState<BaseId>("ocean");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [calendarFocus, setCalendarFocus] = useState<string>("anchovy");

  const mapHost = useRef<HTMLDivElement | null>(null);
  const mapCtx = useRef<{
    map: any;
    bases: Partial<Record<BaseId, any>>;
    currentBase: BaseId;
    groups: Record<string, any>;
  } | null>(null);

  const ranked = useMemo(() => rankRegions(portId, month, slot), [portId, month, slot]);
  const reachable = useMemo(() => ranked.filter((item) => item.reachable), [ranked]);
  const best = reachable[0];
  const alternates = reachable.slice(1, 3);
  const chart = useMemo(() => monthlyBest(portId, slot), [portId, slot]);
  const chartMax = Math.max(...chart.map((item) => item.probability), 1);

  const popupHtml = useCallback(
    (regionId: string) => {
      const region = regionById(regionId);
      const entry = ranked.find((item) => item.region.id === regionId);
      const score = entry && entry.reachable
        ? `<span class="jm-popup-score">이번 조건 ${entry.probability}% · ${formatMinutes(entry.minutes)}</span>`
        : `<span class="jm-popup-score">${entry ? `출항 ${formatMinutes(entry.minutes)} · 장거리` : "장거리"}</span>`;
      return `<div>
        <p class="jm-popup-name">${escapeHtml(region.name)}</p>
        <p class="jm-popup-meta">${escapeHtml(region.depth)} · 신뢰도 ${region.confidence}</p>
        ${score}
        <p class="jm-popup-body">${escapeHtml(region.why)}</p>
        <p class="jm-popup-tip"><b>${escapeHtml(region.peak)}</b>에 특히 기대할 수 있어요.<br />${escapeHtml(region.tip)}</p>
      </div>`;
    },
    [ranked],
  );

  // 지도 초기화
  useEffect(() => {
    let cancelled = false;
    const host = mapHost.current;
    if (!host) return;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapHost.current) return;
        const map = L.map(mapHost.current, {
          center: [35.055, 128.66],
          zoom: 10,
          minZoom: 8,
          maxZoom: 16,
          scrollWheelZoom: false,
          zoomControl: true,
        });
        const bases: Partial<Record<BaseId, any>> = {};
        for (const item of BASES) {
          bases[item.id] = L.tileLayer(item.url, {
            maxZoom: 16,
            maxNativeZoom: item.maxNativeZoom,
            subdomains: item.id === "light" ? "abcd" : "abc",
            attribution: item.attribution,
          });
        }
        bases.ocean.addTo(map);
        L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
        const groups: Record<string, any> = {};
        for (const key of ["protected", "hotspots", "regions", "ports", "prey", "route"]) {
          groups[key] = L.layerGroup().addTo(map);
        }
        mapCtx.current = { map, bases, currentBase: "ocean", groups };
        map.fitBounds(
          [
            [34.895, 128.1],
            [35.17, 128.87],
          ],
          { padding: [22, 22], maxZoom: 10 },
        );
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError("지도를 불러오지 못했어요. 아래 수역 카드와 시즌 달력에서 같은 내용을 확인할 수 있어요.");
      });
    return () => {
      cancelled = true;
      if (mapCtx.current) {
        mapCtx.current.map.remove();
        mapCtx.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // 선택 조건에 맞춰 레이어 다시 그리기
  useEffect(() => {
    const ctx = mapCtx.current;
    if (!ctx || !mapReady) return;
    const L = (window as any).L;
    if (!L) return;

    if (ctx.currentBase !== base) {
      ctx.bases[ctx.currentBase]?.remove();
      ctx.bases[base]?.addTo(ctx.map);
      ctx.currentBase = base;
    }

    Object.values(ctx.groups).forEach((group: any) => group.clearLayers());
    const monthIndex = month - 1;
    const bestId = best?.region.id;

    // 상괭이 기대 밀도
    REGIONS.forEach((region) => {
      const value = region.months[monthIndex];
      const isBest = region.id === bestId;
      L.circleMarker([region.lat, region.lon], {
        radius: 6 + value / 5.5,
        color: isBest ? "#12375a" : "#1649dd",
        weight: isBest ? 2.5 : 1,
        opacity: 0.85,
        fillColor: isBest ? "#ffe78c" : "#1649dd",
        fillOpacity: isBest ? 0.5 : 0.16,
      })
        .bindTooltip(`${region.short} · ${monthLabel(month)} ${value}%`, {
          direction: "top",
          offset: [0, -8],
          className: "jm-tip",
        })
        .bindPopup(popupHtml(region.id))
        .addTo(ctx.groups.hotspots);
    });

    // 보호구역
    const jaran = regionById("jaran");
    L.circle([jaran.lat, jaran.lon], {
      radius: 2100,
      color: "#bb5a6b",
      weight: 1.5,
      dashArray: "4 6",
      fillColor: "#bb5a6b",
      fillOpacity: 0.07,
    })
      .bindTooltip("상괭이 해양생물보호구역(약 2.1㎢) · 외곽 300m 이상", { className: "jm-tip" })
      .addTo(ctx.groups.protected);

    // 수역 번호 핀 (출항지와 같은 자리면 ⚓로 표시)
    REGIONS.forEach((region, index) => {
      const isBest = region.id === bestId;
      const isPort = PORTS.some(
        (port) => Math.abs(port.lat - region.lat) < 0.002 && Math.abs(port.lon - region.lon) < 0.002,
      );
      L.marker([region.lat, region.lon], {
        icon: L.divIcon({
          className: "",
          html: `<span class="jm-num${isBest ? " is-best" : ""}" aria-hidden="true">${index + 1}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: false,
        title: region.name,
        alt: region.name,
      })
        .bindPopup(popupHtml(region.id))
        .bindTooltip(`${isPort ? "⚓ " : ""}${region.short}`, {
          permanent: true,
          direction: "bottom",
          offset: [0, 14],
          className: "jm-label",
        })
        .addTo(ctx.groups.regions);
    });

    // 먹이 어종 레이어
    activePrey.forEach((preyId) => {
      const prey = preyById(preyId);
      const intensity = prey.months[monthIndex];
      if (intensity <= 0) return;
      prey.zones.forEach((zone) => {
        L.circle([zone.lat, zone.lon], {
          radius: zone.radius,
          color: prey.color,
          weight: 1.2,
          opacity: 0.55,
          fillColor: prey.color,
          fillOpacity: 0.08 + intensity * 0.035,
        })
          .bindTooltip(`${prey.name} · ${monthLabel(month)} ${["드물어요", "적어요", "있어요", "많아요"][intensity]}`, {
            className: "jm-tip",
          })
          .addTo(ctx.groups.prey);
      });
      prey.arrows.forEach((arrow) => {
        const line = L.polyline([arrow.from, arrow.to], {
          color: prey.color,
          weight: 2,
          opacity: 0.75,
          className: "jm-flow",
        }).addTo(ctx.groups.prey);
        line.bindTooltip(`${prey.name} 이동 · ${arrow.label}`, { className: "jm-tip" });
        [0.52, 0.86].forEach((t) => {
          const point = pointAlong([arrow.from, arrow.to], t);
          const angle = bearing(arrow.from, arrow.to);
          L.marker(point, {
            icon: L.divIcon({
              className: "",
              html: `<span class="jm-arrow" style="--c:${prey.color};transform:rotate(${angle - 90}deg)" aria-hidden="true">➤</span>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }),
            interactive: false,
            keyboard: false,
          }).addTo(ctx.groups.prey);
        });
      });
    });

    // 추천 항로
    if (best) {
      const path = routeFor(portId, best.region.id);
      L.polyline(path, {
        color: "#1649dd",
        weight: 3,
        opacity: 0.92,
        dashArray: "1 8",
        lineCap: "round",
      })
        .bindTooltip(`추천 항로 · ${PORTS.find((port) => port.id === portId)?.name} → ${best.region.short} (개략)`, {
          sticky: true,
          className: "jm-tip",
        })
        .addTo(ctx.groups.route);
      [0.42, 0.72].forEach((t) => {
        const point = pointAlong(path, t);
        const next = pointAlong(path, Math.min(0.99, t + 0.08));
        const angle = bearing(point, next);
        L.marker(point, {
          icon: L.divIcon({
            className: "",
            html: `<span class="jm-arrow is-route" style="transform:rotate(${angle - 90}deg)" aria-hidden="true">➤</span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(ctx.groups.route);
      });
    }
  }, [activePrey, base, best, mapReady, month, popupHtml, portId]);

  const focusRegion = (regionId: string) => {
    const ctx = mapCtx.current;
    if (!ctx) {
      document.getElementById("map")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      return;
    }
    const region = regionById(regionId);
    document.getElementById("map")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    const L = (window as any).L;
    const popup = L.popup({ className: "jm-popup", offset: [0, -4] })
      .setLatLng([region.lat, region.lon])
      .setContent(popupHtml(regionId));
    if (prefersReducedMotion()) {
      ctx.map.setView([region.lat, region.lon], 11, { animate: false });
      popup.openOn(ctx.map);
      return;
    }
    ctx.map.once("moveend", () => popup.openOn(ctx.map));
    ctx.map.flyTo([region.lat, region.lon], 11, { duration: 0.7 });
  };

  const togglePrey = (id: string) => {
    setActivePrey((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const allPreyActive = activePrey.length === PREY.length;

  const resultSpecies = best ? best.region.prey.map((id) => preyById(id)) : [];
  const focusPreyInfo = preyById(calendarFocus);

  return (
    <>
      <section id="planner" className={`${styles.band} ${styles.bandTight}`} aria-labelledby="planner-title">
        <div className={styles.sectionMeta}>
          <span>01 — DEPARTURE PLANNER</span>
          <span>언제 · 어느 시간에 · 어디서 나갈까</span>
        </div>
        <div className={styles.sectionHeading}>
          <h2 id="planner-title">출항 결정판.</h2>
          <p>
            월과 시간대, 출항지만 고르면 돼요.
            <br />
            조사 자료를 겹쳐 그날 가장 만날 가능성이 높은 수역과 개략 항로를 골라 드려요.
          </p>
        </div>

        <div className={styles.plannerGrid}>
          <div className={styles.controls}>
            <div className={styles.step}>
              <div className={styles.stepLabel}>
                <span>01 / 시기</span>
                <em>{monthLabel(month)}</em>
              </div>
              <div className={styles.monthGrid} role="group" aria-label="출항 시기 선택">
                {MONTHS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${styles.monthChip}`}
                    aria-pressed={value === month}
                    onClick={() => setMonth(value)}
                  >
                    {value}월
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepLabel}>
                <span>02 / 시간대</span>
                <em>{TIME_SLOTS.find((item) => item.id === slot)?.time}</em>
              </div>
              <div className={styles.chipRow} role="group" aria-label="출항 시간대 선택">
                {TIME_SLOTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.chip} ${styles.slotChip}`}
                    aria-pressed={item.id === slot}
                    onClick={() => setSlot(item.id)}
                  >
                    {item.label}
                    <small>{item.time}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepLabel}>
                <span>03 / 출항지</span>
                <em>{PORTS.find((item) => item.id === portId)?.short}</em>
              </div>
              <div className={styles.chipRow} role="group" aria-label="출항지 선택">
                {PORTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.chip} ${styles.portChip}`}
                    aria-pressed={item.id === portId}
                    onClick={() => setPortId(item.id)}
                  >
                    {item.name}
                    <small>{item.note}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.result} aria-live="polite">
            <p className={styles.resultLabel}>예상 조우 확률 · {monthLabel(month)} {TIME_SLOTS.find((item) => item.id === slot)?.label}</p>
            {best ? (
              <>
                <div className={styles.scoreRow}>
                  <span className={styles.bigNumber}>{best.probability}</span>
                  <span className={styles.unit}>%</span>
                </div>
                <p className={styles.marginText}>
                  ± {best.margin}%p 범위 · 오전 골든타임 기준으로 계산한 추정값이에요
                </p>
                <div className={styles.gradeRow}>
                  <span className={styles.gradeBadge}>
                    신뢰도 <b>{best.confidence}</b>
                  </span>
                  <span className={styles.gradeText}>{best.confidenceNote}</span>
                </div>
                <p className={styles.resultRegion}>{best.region.name}</p>
                <p className={styles.resultAside}>
                  {PORTS.find((item) => item.id === portId)?.short} 출항 · {formatMinutes(best.minutes)} · {best.region.peak}
                </p>
                <div className={styles.resultFacts}>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>이 수역의 먹이</span>
                    <div className={styles.preyChips}>
                      {resultSpecies.map((prey) => (
                        <span key={prey.id} className={styles.preyChip}>
                          <span className={styles.dot} style={{ background: prey.color }} aria-hidden="true" />
                          {prey.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>수심 · 지형</span>
                    <span className={styles.factValue}>{best.region.depth}</span>
                  </div>
                </div>
                <p className={styles.resultNote}>
                  지도에서 파란 점선이 추천 항로예요. 실제 항해는 해도·조류·통제구역을 확인하고, 현지 안내를 따라 주세요.
                </p>
                {alternates.length > 0 && (
                  <div className={styles.alts}>
                    {alternates.map((item) => (
                      <button
                        key={item.region.id}
                        type="button"
                        className={styles.altCard}
                        onClick={() => focusRegion(item.region.id)}
                      >
                        <strong>{item.region.short}</strong>
                        <span>
                          {item.probability}% · {formatMinutes(item.minutes)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className={styles.resultNote}>이 출항지에서는 이번 조건에 추천할 수 있는 수역이 없어요. 다른 출항지를 골라 보세요.</p>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHead}>
            <h3>월별 기대 확률 · {PORTS.find((item) => item.id === portId)?.name}</h3>
            <p>{TIME_SLOTS.find((item) => item.id === slot)?.label} 기준 가장 좋은 수역의 확률이에요. 막대를 누르면 그 달로 바뀌어요.</p>
          </div>
          <div className={styles.chartScroll}>
            <div className={styles.chart} role="group" aria-label="월별 기대 조우 확률">
              {chart.map((item) => (
                <button
                  key={item.month}
                  type="button"
                  className={styles.barButton}
                  aria-pressed={item.month === month}
                  aria-label={`${item.month}월 ${item.probability}퍼센트, ${regionById(item.regionId).short}`}
                  onClick={() => setMonth(item.month)}
                >
                  <span className={styles.barValue}>{item.probability}</span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{ height: `${Math.max(6, (item.probability / chartMax) * 100)}%` }}
                    />
                  </span>
                  <span className={styles.barMonth}>{item.month}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="map" className={styles.band} aria-labelledby="map-title">
        <div className={styles.sectionMeta}>
          <span>02 — PREY HUNTING MAP</span>
          <span>진해만 · 가덕수로 · 거제 · 자란만</span>
        </div>
        <div className={styles.sectionHeading}>
          <h2 id="map-title">먹이를 따라, 지도 위에서.</h2>
          <p>
            숭어떼만이 아니라 상괭이가 먹는 어종을 하나씩 켜 볼 수 있어요.
            <br />
            원을 누르면 그 수역의 이유와 현장 요령이 열려요.
          </p>
        </div>

        <div className={styles.mapCard}>
          <div className={styles.mapToolbar}>
            <div className={styles.toolbarGroup} role="group" aria-label="먹이 어종 레이어">
              <span className={styles.toolbarLabel}>먹이</span>
              {PREY.map((prey) => (
                <button
                  key={prey.id}
                  type="button"
                  className={styles.speciesChip}
                  aria-pressed={activePrey.includes(prey.id)}
                  onClick={() => togglePrey(prey.id)}
                  title={prey.note}
                >
                  <span className={styles.dot} style={{ background: prey.color }} aria-hidden="true" />
                  {prey.name}
                </button>
              ))}
              <button
                type="button"
                className={styles.baseButton}
                aria-pressed={allPreyActive}
                onClick={() => setActivePrey(allPreyActive ? ["anchovy"] : PREY.map((prey) => prey.id))}
              >
                {allPreyActive ? "기본으로" : "전체 보기"}
              </button>
            </div>
            <div className={styles.toolbarGroup} role="group" aria-label="지도 배경">
              {BASES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.baseButton}
                  aria-pressed={item.id === base}
                  onClick={() => setBase(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.mapFrame}>
            <div
              ref={mapHost}
              className={`${styles.map} jm-map`}
              role="application"
              aria-label="진해만 상괭이 먹이사냥 지도. 수역별 기대 확률과 먹이 어종, 추천 항로를 보여 줍니다."
            />
            {!mapReady && !mapError && <p className={styles.mapStatus}>지도를 준비하고 있어요…</p>}
            <noscript>
              <p className={styles.mapStatus}>
                지도는 JavaScript를 켜면 볼 수 있어요. 아래 수역 카드와 시즌 달력에서 같은 내용을 확인할 수 있어요.
              </p>
            </noscript>
            {mapError && <p className={styles.mapStatus}>{mapError}</p>}
            <div className={styles.legend} aria-hidden="true">
              <strong>MAP LEGEND</strong>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#ffe78c", borderColor: "#12375a" }} />
                이번 조건 추천 수역
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#1649dd", opacity: 0.35 }} />
                상괭이 기대 밀도({monthLabel(month)})
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#1649dd" }} />
                번호가 수역 · ⚓는 출항지
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#bb5a6b", opacity: 0.35 }} />
                상괭이 해양생물보호구역
              </span>
              <span className={styles.legendItem}>➤ 먹이·항로 이동 방향</span>
            </div>
          </div>
          <p className={styles.mapNote}>
            <b>개략 항로 안내</b> · 파란 점선은 출항지에서 추천 수역까지의 방향을 보여 주는 참고선이에요. 실제 항로가 아니며,
            해도·조류·어업 통제구역과 현지 안내를 확인한 뒤 항해해야 해요. 수역 카드를 누르면 지도가 그곳으로 이동해요.
          </p>
        </div>

        <div className={styles.regionGrid}>
          {REGIONS.map((region, index) => {
            const entry = ranked.find((item) => item.region.id === region.id) as RankedRegion | undefined;
            const isBest = best?.region.id === region.id;
            return (
              <button
                key={region.id}
                type="button"
                className={styles.regionCard}
                data-active={isBest}
                onClick={() => focusRegion(region.id)}
                aria-label={`${region.name} 지도에서 보기`}
              >
                <span className={styles.regionTop}>
                  <span className={styles.regionNumber}>{index + 1}</span>
                  <span className={styles.confidence}>
                    {region.protectedArea ? "보호구역 · 신뢰도 " : "신뢰도 "}
                    {region.confidence}
                  </span>
                </span>
                <span className={styles.regionName}>{region.name}</span>
                <span className={styles.regionShort}>{region.why}</span>
                <span className={styles.regionScore}>
                  <b>{entry && entry.reachable ? entry.probability : "—"}</b>
                  <span>
                    {entry && entry.reachable
                      ? `% · ${formatMinutes(entry.minutes)}`
                      : entry
                        ? `이번 출항지에선 장거리 · ${formatMinutes(entry.minutes)}`
                        : ""}
                  </span>
                </span>
                <span className={styles.regionMeta}>
                  {region.peak}
                  <span>{region.depth}</span>
                </span>
                <span className={styles.tagRow}>
                  {region.prey.map((id) => {
                    const prey = preyById(id);
                    return (
                      <span key={id} className={styles.tag} style={{ borderColor: prey.color, color: prey.color }}>
                        {prey.name}
                      </span>
                    );
                  })}
                </span>
                <span className={styles.regionAction}>지도에서 보기 ↗</span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="calendar" className={styles.band} aria-labelledby="calendar-title">
        <div className={styles.sectionMeta}>
          <span>03 — SEASON CALENDAR</span>
          <span>어종별 시즌 · 0에서 3까지</span>
        </div>
        <div className={styles.sectionHeading}>
          <h2 id="calendar-title">먹이의 달력.</h2>
          <p>
            어종 이름을 누르면 지도에 그 먹이 레이어가 켜져요.
            <br />
            3에 가까울수록 그 달에 가장 빽빽한 먹이예요.
          </p>
        </div>

        <div className={styles.calendarScroll}>
          <table className={styles.calendar}>
            <caption>진해만 먹이 어종별 시즌 강도 · 어종 이름을 누르면 지도 레이어가 켜지고 꺼져요</caption>
            <thead>
              <tr>
                <th scope="col">먹이 어종</th>
                {MONTHS.map((value) => (
                  <th key={value} scope="col">
                    {value}월
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PREY.map((prey) => (
                <tr key={prey.id}>
                  <th scope="row">
                    <button
                      type="button"
                      className={styles.nameButton}
                      aria-pressed={activePrey.includes(prey.id)}
                      onClick={() => {
                        togglePrey(prey.id);
                        setCalendarFocus(prey.id);
                      }}
                    >
                      <span className={styles.dot} style={{ background: prey.color }} aria-hidden="true" />
                      <span>
                        {prey.name}
                        <small>{prey.english}</small>
                      </span>
                    </button>
                  </th>
                  {prey.months.map((intensity, index) => (
                    <td key={index} className={styles.cellWrap}>
                      <div
                        className={styles.cell}
                        role="img"
                        aria-label={`${prey.name} ${index + 1}월 ${["드물어요", "적어요", "있어요", "많아요"][intensity]}`}
                        style={{
                          background: prey.color,
                          opacity: 0.1 + intensity * 0.22,
                          boxShadow: intensity === 3 ? "inset 0 0 0 1.5px #12375a66" : undefined,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.calendarNote}>
          <span>
            <b>{focusPreyInfo.name}</b> · {focusPreyInfo.note}
          </span>
          <span>{focusPreyInfo.connection}</span>
        </p>
      </section>
    </>
  );
}
