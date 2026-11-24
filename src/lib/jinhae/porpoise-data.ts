// 진해 바다 상괭이 먹이사냥·출항 가이드 데이터와 계산 모델.
// 확률은 공개 조사 자료와 계절 어황을 바탕으로 만든 추정값이며, 조우를 보장하지 않는다.
// 값은 모두 '오전 골든타임(08:00~11:30) 기준 기대 조우 확률(%)'이다.

export type Confidence = "A" | "B" | "C";
export type SlotId = "morning" | "midday" | "sunset";

export type Slot = {
  id: SlotId;
  label: string;
  time: string;
  factor: number;
  note: string;
};

export type Region = {
  id: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  radius: number;
  months: number[];
  confidence: Confidence;
  depth: string;
  why: string;
  peak: string;
  tip: string;
  prey: string[];
  protectedArea?: boolean;
};

export type Port = {
  id: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  note: string;
};

export type PreyZone = { region: string; lat: number; lon: number; radius: number };
export type PreyArrow = { from: [number, number]; to: [number, number]; label: string };

export type Prey = {
  id: string;
  name: string;
  english: string;
  color: string;
  months: number[];
  zones: PreyZone[];
  arrows: PreyArrow[];
  note: string;
  connection: string;
};

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const TIME_SLOTS: Slot[] = [
  {
    id: "morning",
    label: "오전 골든타임",
    time: "08:00 – 11:30",
    factor: 1,
    note: "가덕도 일대 드론 조사에서 발견율 91% 이상이 기록된 시간대예요.",
  },
  {
    id: "midday",
    label: "한낮",
    time: "12:00 – 14:30",
    factor: 0.6,
    note: "13~14시 발견율이 55% 수준으로 떨어지는 시간대예요. 가능하면 피하세요.",
  },
  {
    id: "sunset",
    label: "일몰 피크",
    time: "17:00 – 18:00",
    factor: 0.92,
    note: "음향 조사에서 일몰 무렵 출현이 다시 오르는 시간대예요. 노을과 함께 보기 좋아요.",
  },
];

export const REGIONS: Region[] = [
  {
    id: "sokcheon",
    name: "속천항 · 행암만",
    short: "속천항·행암만",
    lat: 35.136,
    lon: 128.672,
    radius: 2100,
    months: [38, 40, 50, 62, 66, 54, 45, 42, 55, 63, 52, 42],
    confidence: "B",
    depth: "수심 5~10m · 갯벌 만",
    why: "행암만은 갯벌이 넓고 물이 얕아요. 간조에 드러난 갯벌이 영양분을 내놓으면 멸치와 보리새우가 모이고, 상괭이는 그 떼를 따라 만 안쪽까지 들어와요.",
    peak: "4월 · 10월",
    tip: "만 입구(행암 수도)에서 안쪽으로 들어오는 수로를 천천히 따라가세요. 수심이 얕아 너울에 약하니 풍속 3m/s가 넘으면 출항을 미루는 편이 좋아요.",
    prey: ["anchovy", "crustacean", "mullet"],
  },
  {
    id: "myeongdong",
    name: "명동 · 음지도 · 우도 물골",
    short: "명동·우도 물골",
    lat: 35.095,
    lon: 128.711,
    radius: 2300,
    months: [52, 54, 62, 74, 70, 58, 50, 46, 60, 68, 58, 52],
    confidence: "B",
    depth: "수심 5~15m · 조류 강함",
    why: "섬과 갯바위 사이로 좁은 물골이 이어져 조류가 세게 흐르고, 그 흐름이 먹이를 한곳에 모아요. 봄에는 참숭어 떼가 갯바위에 붙고, 겨울에는 밀치가 물골 안쪽에 머물러요.",
    peak: "4월(참숭어) · 12~2월(밀치)",
    tip: "물골 안쪽은 조류가 빨라 요트가 설 자리가 좁아요. 만조 1~2시간 전에 입구에서 기다리다 흐름을 타고 통과하는 편이 안전해요.",
    prey: ["mullet", "halfbeak", "cephalopod", "anchovy"],
  },
  {
    id: "yongwon",
    name: "용원항 · 가덕수로",
    short: "용원항·가덕수로",
    lat: 35.085,
    lon: 128.808,
    radius: 2600,
    months: [55, 56, 64, 72, 74, 66, 64, 68, 72, 72, 62, 56],
    confidence: "A",
    depth: "수심 15~30m · 수로",
    why: "창조와 낙조마다 물이 빠르게 오가는 수로예요. 멸치와 전어 떼가 조류를 타고 지나가고, 상괭이도 이 통로를 따라 이동해요. 다른 구역에서 놓쳤다면 수로를 따라 길게 움직이는 무리를 노려 보세요.",
    peak: "8~10월(전어) · 4~5월",
    tip: "수로 가운데를 남북으로 길게 훑으세요. 통행 선박이 많으니 AIS와 육안 확인을 함께 하고, 큰 배 앞으로는 절대 가로지르지 마세요.",
    prey: ["anchovy", "gizzard", "mullet", "hairtail"],
  },
  {
    id: "gadeok",
    name: "가덕도 남단 · 외양포 · 대항항",
    short: "가덕도 남단",
    lat: 35.002,
    lon: 128.822,
    radius: 3200,
    months: [58, 58, 66, 74, 78, 80, 84, 92, 82, 74, 64, 60],
    confidence: "A",
    depth: "수심 10~25m · 외해 경계",
    why: "가덕도 남단은 외해와 만나는 수역이에요. 7~8월에는 멸치가 알을 낳고 새끼가 자라면서 먹이가 가장 빽빽해지고, 이때 상괭이 밀도가 연중 최고로 올라가요. 가을까지 먹이사냥이 이어져요.",
    peak: "7~9월, 특히 8월",
    tip: "남단 외곽은 너울이 바로 들어와요. 오전에도 파고 0.5m가 넘으면 관측이 어려우니 해상예보를 먼저 보세요. 무리와는 300m 이상 거리를 두세요.",
    prey: ["anchovy", "gizzard", "hairtail"],
  },
  {
    id: "okpo",
    name: "거제 옥포만 · 외포",
    short: "거제 옥포·외포",
    lat: 34.91,
    lon: 128.708,
    radius: 2500,
    months: [54, 52, 60, 68, 72, 64, 56, 52, 66, 70, 62, 56],
    confidence: "B",
    depth: "수심 5~20m · 좁은 만",
    why: "옥포만 안쪽은 좁고 잔잔해요. 봄과 가을에 학꽁치와 숭어가 연안을 따라 붙으면, 상괭이가 그 떼를 따라 방파제 가까이까지 들어와요. 거제 남쪽 외포 앞 수로에서도 자주 목격돼요.",
    peak: "4~6월 · 10월",
    tip: "수변 가까이 들어온 개체는 특히 예민해요. 엔진 회전을 낮추고 사선으로 천천히 접근하세요. 300m 안으로 들어가면 대부분 먼저 사라져요.",
    prey: ["halfbeak", "mullet", "anchovy", "cephalopod"],
  },
  {
    id: "masan",
    name: "마산만 · 진동만",
    short: "마산만·진동만",
    lat: 35.115,
    lon: 128.535,
    radius: 3000,
    months: [30, 32, 42, 50, 48, 42, 38, 48, 64, 70, 48, 36],
    confidence: "B",
    depth: "수심 5~15m · 넓은 갯벌",
    why: "진동만은 수심이 얕고 갯벌이 넓어 전어와 멸치가 풍부해요. 8~11월 전어 위판이 집중되는 시기와 겹쳐 상괭이 출현도 늘어요. 다만 만 안쪽은 어장과 선박 통행이 많아요.",
    peak: "9~10월",
    tip: "만 안쪽보다 입구 수로 쪽이 관측에 유리해요. 어구가 많은 구역은 속도를 줄이고, 어민의 조업을 방해하지 않도록 넓게 우회하세요.",
    prey: ["gizzard", "anchovy", "crustacean"],
  },
  {
    id: "jaran",
    name: "고성 하이면 · 자란만",
    short: "고성 자란만",
    lat: 34.918,
    lon: 128.148,
    radius: 2600,
    months: [46, 48, 56, 62, 60, 54, 48, 46, 54, 58, 52, 48],
    confidence: "C",
    depth: "수심 5~15m · 해양생물보호구역",
    why: "하이면 덕호리 앞 해역은 상괭이 무리가 다수 서식하는 것으로 조사돼 2019년 12월 국내 최초로 상괭이 해양생물보호구역(약 2.1㎢)으로 지정됐어요. 진해에서 출항하면 2시간 30분 이상 걸려요.",
    peak: "봄 · 가을",
    tip: "보호구역 안쪽 진입은 피하고 외곽에서 300m 이상 거리를 두세요. 이 해역은 관측보다 보전이 먼저예요. 고성·삼천포 쪽 현지 출항이 아니면 지도에서 위치만 확인하세요.",
    prey: ["anchovy", "crustacean", "mullet"],
    protectedArea: true,
  },
];

export const PORTS: Port[] = [
  { id: "sokcheon", name: "진해 속천항", short: "속천항", lat: 35.136, lon: 128.672, note: "진해 시내에서 가장 가까운 출항지" },
  { id: "myeongdong", name: "진해 명동 마리나", short: "명동 마리나", lat: 35.095, lon: 128.711, note: "물골과 갯바위가 바로 앞" },
  { id: "yongwon", name: "진해 용원항", short: "용원항", lat: 35.085, lon: 128.808, note: "가덕수로를 끼고 있어 남단까지 짧아요" },
  { id: "okpo", name: "거제 옥포 · 외포", short: "옥포·외포", lat: 34.91, lon: 128.708, note: "거제 연안과 외포 수로 쪽 출항지" },
];

export const PREY: Prey[] = [
  {
    id: "anchovy",
    name: "멸치",
    english: "Anchovy",
    color: "#2f7f9e",
    months: [1, 1, 2, 2, 3, 3, 3, 3, 3, 2, 2, 1],
    zones: [
      { region: "sokcheon", lat: 35.128, lon: 128.668, radius: 3200 },
      { region: "yongwon", lat: 35.07, lon: 128.79, radius: 5200 },
      { region: "gadeok", lat: 35.012, lon: 128.828, radius: 5600 },
      { region: "myeongdong", lat: 35.09, lon: 128.72, radius: 2600 },
      { region: "masan", lat: 35.09, lon: 128.55, radius: 5200 },
    ],
    arrows: [
      { from: [34.985, 128.87], to: [35.085, 128.775], label: "5월 산란 유입" },
      { from: [35.085, 128.775], to: [35.128, 128.685], label: "여름 내만 확산" },
      { from: [35.02, 128.84], to: [35.06, 128.75], label: "가을 최우점" },
    ],
    note: "진해만에서 사계절 가장 흔한 먹이예요. 5월에는 만 전역이 산란장이 되고, 7~8월에는 알과 새끼가 가장 빽빽해져요. 가을에도 최우점이에요.",
    connection: "8월 가덕도 남단의 개체 밀도 최고조와 맞물려요.",
  },
  {
    id: "gizzard",
    name: "전어",
    english: "Gizzard shad",
    color: "#a9743c",
    months: [0, 0, 0, 0, 1, 2, 2, 3, 3, 3, 2, 1],
    zones: [
      { region: "masan", lat: 35.085, lon: 128.545, radius: 5000 },
      { region: "masan", lat: 35.105, lon: 128.505, radius: 3800 },
      { region: "yongwon", lat: 35.06, lon: 128.755, radius: 4200 },
    ],
    arrows: [
      { from: [34.995, 128.72], to: [35.055, 128.56], label: "8~9월 내만 유입" },
      { from: [35.04, 128.6], to: [35.09, 128.535], label: "가을 진동만 집결" },
    ],
    note: "진해수협 위판 기준 8~11월에 집중되고 8~9월이 가장 많아요. 내만으로 들어온 떼를 따라 상괭이도 진동만·마산만 쪽으로 움직여요.",
    connection: "가을 진동만·마산만의 상괭이 출현과 겹쳐요.",
  },
  {
    id: "mullet",
    name: "숭어 · 밀치",
    english: "Mullet",
    color: "#4e8b62",
    months: [3, 3, 3, 3, 2, 1, 0, 0, 1, 2, 3, 3],
    zones: [
      { region: "myeongdong", lat: 35.097, lon: 128.708, radius: 1800 },
      { region: "yongwon", lat: 35.082, lon: 128.803, radius: 2000 },
      { region: "okpo", lat: 34.913, lon: 128.702, radius: 2200 },
      { region: "sokcheon", lat: 35.133, lon: 128.675, radius: 1900 },
    ],
    arrows: [
      { from: [34.975, 128.79], to: [35.08, 128.77], label: "봄 외해 → 연안" },
      { from: [35.07, 128.76], to: [35.1, 128.71], label: "겨울 갯바위 정착" },
    ],
    note: "참숭어(보리숭어)는 3~5월, 4월이 피크예요. 외해에서 용원·명동·옥포 연안으로 들어와요. 밀치(가숭어)는 11~2월 용원·명동·우도 갯바위에 붙어요.",
    connection: "봄과 겨울, 두 계절 모두 상괭이의 먹이가 돼요.",
  },
  {
    id: "halfbeak",
    name: "학꽁치",
    english: "Halfbeak",
    color: "#7768c0",
    months: [0, 0, 1, 2, 2, 2, 1, 1, 2, 3, 1, 0],
    zones: [
      { region: "okpo", lat: 34.912, lon: 128.7, radius: 2000 },
      { region: "myeongdong", lat: 35.092, lon: 128.713, radius: 1500 },
      { region: "sokcheon", lat: 35.13, lon: 128.68, radius: 1500 },
    ],
    arrows: [
      { from: [34.95, 128.74], to: [35.06, 128.72], label: "봄 북상" },
      { from: [35.08, 128.7], to: [34.955, 128.71], label: "가을 남하" },
    ],
    note: "봄(4~7월)과 가을(10월)에 연안에 무리로 나타나요. 옥포만처럼 좁은 만에서 상괭이가 이 떼를 쫓아 수변 가까이 들어오는 장면이 자주 목격돼요.",
    connection: "거제 옥포만에서 상괭이가 방파제 가까이 오는 이유예요.",
  },
  {
    id: "hairtail",
    name: "갈치 · 풀치",
    english: "Hairtail",
    color: "#bb5a6b",
    months: [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 1, 0],
    zones: [
      { region: "gadeok", lat: 35.0, lon: 128.838, radius: 4800 },
      { region: "yongwon", lat: 35.07, lon: 128.815, radius: 2200 },
      { region: "yongwon", lat: 35.055, lon: 128.755, radius: 4200 },
    ],
    arrows: [
      { from: [34.98, 128.86], to: [35.045, 128.8], label: "여름·가을 외해 → 내만" },
    ],
    note: "8~11월 진해 전역에서 잡히는 어종이에요. 주로 밤에 어획되지만, 여름과 가을에는 상괭이의 먹이로도 쓰여요.",
    connection: "여름~가을 가덕 남단과 수로의 상괭이 먹이예요.",
  },
  {
    id: "cephalopod",
    name: "두족류 (꼴뚜기 · 갑오징어 · 호래기)",
    english: "Cephalopods",
    color: "#d18a2c",
    months: [1, 1, 3, 3, 2, 1, 2, 2, 2, 2, 2, 2],
    zones: [
      { region: "myeongdong", lat: 35.094, lon: 128.717, radius: 1400 },
      { region: "okpo", lat: 34.916, lon: 128.706, radius: 1900 },
      { region: "masan", lat: 35.09, lon: 128.55, radius: 3000 },
      { region: "sokcheon", lat: 35.131, lon: 128.678, radius: 1200 },
    ],
    arrows: [
      { from: [35.0, 128.78], to: [35.09, 128.72], label: "산란기 연안 유입" },
    ],
    note: "참꼴뚜기·갑오징어는 3~4월, 화살꼴뚜기는 7월, 호래기는 11월부터 겨울까지예요. 물골과 만 입구에 모여요.",
    connection: "물골 안쪽에서 상괭이가 머무는 이유 중 하나예요.",
  },
  {
    id: "crustacean",
    name: "새우 · 갑각류",
    english: "Shrimp & crustaceans",
    color: "#9a5f86",
    months: [1, 1, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1],
    zones: [
      { region: "sokcheon", lat: 35.13, lon: 128.66, radius: 2400 },
      { region: "masan", lat: 35.1, lon: 128.53, radius: 3400 },
      { region: "masan", lat: 35.1, lon: 128.5, radius: 2400 },
    ],
    arrows: [
      { from: [35.12, 128.64], to: [35.11, 128.57], label: "갯벌 → 만 안쪽" },
    ],
    note: "보리새우와 갑각류는 3~4월과 연중 갯벌 만에서 만날 수 있어요. 큰 떼를 만들지 않아 눈에 덜 띄지만, 상괭이의 '틈새 먹이'예요.",
    connection: "얕은 갯벌 만에서 상괭이가 오래 머무는 이유예요.",
  },
];

const CONFIDENCE_MARGIN: Record<Confidence, number> = { A: 8, B: 14, C: 20 };
const CONFIDENCE_LABEL: Record<Confidence, string> = {
  A: "조사 자료가 여러 해 쌓인 수역",
  B: "계절 조사와 현지 기록이 있는 수역",
  C: "자료가 적거나 접근이 제한된 수역",
};

export function confidenceLabel(confidence: Confidence): string {
  return CONFIDENCE_LABEL[confidence];
}

export function monthLabel(month: number): string {
  return `${month}월`;
}

export function slotById(id: SlotId): Slot {
  return TIME_SLOTS.find((slot) => slot.id === id) ?? TIME_SLOTS[0];
}

export function regionById(id: string): Region {
  return REGIONS.find((region) => region.id === id) ?? REGIONS[0];
}

export function portById(id: string): Port {
  return PORTS.find((port) => port.id === id) ?? PORTS[0];
}

export function preyById(id: string): Prey {
  return PREY.find((item) => item.id === id) ?? PREY[0];
}

/** 두 지점 사이 대권 거리(km). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 개략 항해 시간(분). 실측 항로가 아니라 만의 굴곡을 감안한 추정값이다. */
export function travelMinutes(portId: string, regionId: string): number {
  const port = portById(portId);
  const region = regionById(regionId);
  const distance = distanceKm(port, region) * 1.3;
  return Math.round((distance / 19) * 60 + 6);
}

/** 그 달에 그 수역에서 먹이가 가장 빽빽한 어종 수만큼 확률을 조금 올린다. */
export function preyBonus(regionId: string, month: number): number {
  const index = Math.max(0, Math.min(11, month - 1));
  const peakPrey = PREY.filter(
    (prey) =>
      prey.months[index] >= 3 &&
      prey.zones.some((zone) => zone.region === regionId),
  );
  return Math.min(3, peakPrey.length);
}

export type RankedRegion = {
  region: Region;
  minutes: number;
  reachable: boolean;
  probability: number;
  margin: number;
  confidence: Confidence;
  confidenceNote: string;
  bonus: number;
};

/** 출항지·월·시간대에 따른 수역별 기대 조우 확률 순위. */
export function rankRegions(portId: string, month: number, slotId: SlotId): RankedRegion[] {
  const slot = slotById(slotId);
  const index = Math.max(0, Math.min(11, month - 1));
  return REGIONS.map((region) => {
    const minutes = travelMinutes(portId, region.id);
    const reachable = minutes <= 115;
    const base = region.months[index] * slot.factor;
    const bonus = preyBonus(region.id, month);
    const travelPenalty = reachable ? Math.min(12, Math.max(0, minutes - 25) * 0.12) : 0;
    const raw = base + bonus - travelPenalty;
    const probability = reachable ? Math.max(6, Math.min(95, Math.round(raw))) : 0;
    const margin = CONFIDENCE_MARGIN[region.confidence] + (slotId === "midday" ? 4 : 0);
    return {
      region,
      minutes,
      reachable,
      probability,
      margin,
      confidence: region.confidence,
      confidenceNote: CONFIDENCE_LABEL[region.confidence],
      bonus,
    };
  }).sort((a, b) => {
    if (a.reachable !== b.reachable) return a.reachable ? -1 : 1;
    return b.probability - a.probability;
  });
}

export function bestRegion(portId: string, month: number, slotId: SlotId): RankedRegion {
  return rankRegions(portId, month, slotId)[0];
}

/** 12개월 각각의 최고 기대 확률(선택한 출항지·시간대 기준). */
export function monthlyBest(portId: string, slotId: SlotId): { month: number; probability: number; regionId: string }[] {
  return MONTHS.map((month) => {
    const best = bestRegion(portId, month, slotId);
    return { month, probability: best.probability, regionId: best.region.id };
  });
}

/** 지도에 그릴 개략 항로. 만의 수로를 따라 꺾이도록 안내점을 끼워 넣는다. */
const CORRIDOR: [number, number][] = [
  [35.129, 128.685],
  [35.108, 128.716],
  [35.078, 128.76],
  [35.062, 128.805],
  [35.02, 128.835],
  [34.965, 128.735],
  [35.098, 128.61],
  [35.108, 128.55],
  [34.985, 128.33],
  [34.93, 128.17],
];

function projectOnSegment(point: [number, number], start: [number, number], end: [number, number]) {
  const lat0 = (start[0] + end[0]) / 2;
  const scale = Math.cos((lat0 * Math.PI) / 180);
  const bx = (end[1] - start[1]) * scale;
  const by = end[0] - start[0];
  const px = (point[1] - start[1]) * scale;
  const py = point[0] - start[0];
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared === 0 ? 0 : (px * bx + py * by) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, t));
  const dx = px - bx * clamped;
  const dy = py - by * clamped;
  return { t, distance: Math.sqrt(dx * dx + dy * dy) * 111 };
}

export function routeFor(portId: string, regionId: string): [number, number][] {
  const port = portById(portId);
  const region = regionById(regionId);
  const start: [number, number] = [port.lat, port.lon];
  const end: [number, number] = [region.lat, region.lon];
  const waypoints = CORRIDOR.map((point) => ({ point, ...projectOnSegment(point, start, end) }))
    .filter((item) => item.t >= 0.12 && item.t <= 0.88 && item.distance <= 4500)
    .sort((a, b) => a.t - b.t)
    .map((item) => item.point);
  return [start, ...waypoints, end];
}

/** 대표 항로의 방위(도). 화살표 회전에 쓴다. */
export function bearing(from: [number, number], to: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLon = toRad(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** 선분 위의 한 점(비율 t). 화살표 위치 계산에 쓴다. */
export function pointAlong(path: [number, number][], t: number): [number, number] {
  if (path.length === 1) return path[0];
  const scaled = t * (path.length - 1);
  const index = Math.min(path.length - 2, Math.max(0, Math.floor(scaled)));
  const fraction = scaled - index;
  const a = path[index];
  const b = path[index + 1];
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `약 ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `약 ${hours}시간` : `약 ${hours}시간 ${rest}분`;
}
