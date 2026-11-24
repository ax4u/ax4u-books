# 진해 바다 상괭이 지도 (`/jinhae-map`)

진해만을 중심으로 상괭이의 먹이사냥 어종과 계절·시간대·출항지별 기대 조우 확률을 보여 주는 안내 페이지입니다. 공개 페이지 주소는 `https://gobibi.art/jinhae-map`입니다.

## 구성

- `page.tsx` — 히어로, 조사 숫자, 배 위 수칙, 조사 기관, 출처와 주의 문구(서버 컴포넌트)
- `JinhaeMapExplorer.tsx` — 출항 결정판, Leaflet 지도, 먹이 레이어, 월별 확률 막대, 시즌 달력(클라이언트 컴포넌트)
- `porpoise-map.module.css` — 페이지 전용 스타일
- `jinhae-map.global.css` — Leaflet 컨트롤·팝업·핀 등 전역 스타일
- `src/lib/jinhae/porpoise-data.ts` — 수역·출항지·먹이 어종 데이터와 확률 계산 함수
- `public/vendor/leaflet/` — Leaflet 1.9.4 (BSD-2-Clause, 로컬 보관)

## 데이터 수정

1. 수역의 월별 기대 확률은 `REGIONS[].months`(1월~12월, 오전 골든타임 기준 %)입니다.
2. 먹이 어종의 시즌 강도는 `PREY[].months`(0~3)이고, 표시 범위는 `PREY[].zones`(위도·경도·반경 m), 이동 화살표는 `PREY[].arrows`입니다.
3. 출항지 좌표는 `PORTS`, 개략 항로 안내점은 `porpoise-data.ts`의 `CORRIDOR`에서 고칩니다.
4. 확률 계산은 `rankRegions()`가 담당합니다. 시간대 계수는 `TIME_SLOTS[].factor`(오전 1.0 / 한낮 0.6 / 일몰 0.92), 출항 거리 페널티와 115분 초과 제외 규칙이 들어 있습니다.

수정 뒤에는 아래 검사를 통과해야 합니다.

```sh
npx tsc --noEmit
npx eslint src/app/jinhae-map src/lib/jinhae
npm run build:exhibition
```

## 지도 타일

- 기본: Esri Ocean Base(© Esri — GEBCO, NOAA, National Geographic, HERE)
- 위성: Esri World Imagery(© Esri, Maxar, Earthstar Geographics)
- 밝은 지도: CARTO Light(© OpenStreetMap contributors © CARTO)

타일은 브라우저에서 직접 불러옵니다. 이용량이 늘면 각 제공자의 사용 약관을 확인하세요.

## 근거와 한계

확률은 공개 조사 자료(해양수산부 보호구역 지정 자료·드론 조사 보도자료, 국립수산과학원 남해안 항공 목시조사, 한국수산과학회지 음향 조사)와 지역 어황을 바탕으로 계산한 추정값입니다. 조우를 보장하지 않으며, 상괭이는 해양보호생물로 300m 이상 거리 유지와 보호구역 출입 제한을 지켜야 합니다. 자세한 출처는 페이지 하단 `06 — SOURCES & NOTES`에 있습니다.
