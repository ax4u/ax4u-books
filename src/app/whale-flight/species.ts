export type WhaleSpeciesId = "blue" | "fin" | "sperm" | "humpback" | "gray" | "minke" | "orca" | "narwhal" | "beluga" | "bottlenose";
export type SpeciesOrder = "size" | "familiar";
export type FlightView = "flight" | "compare";
export type WhaleSpecies = {
  id: WhaleSpeciesId; name: string; english: string; scientific: string;
  length: number; lengthNote: string; feature: string; familiarRank: number;
  source: string; model: "gltf" | "original"; asset?: string; clip?: string;
};
/** Curated representative individuals, not species means or maximum records.
 * All lengths are body length; a narwhal's tusk is additional. Verified 2026-09-08.
 * familiarRank is an editorial introduction order, NOT a measured popularity ranking.
 */
export const WHALE_SPECIES: readonly WhaleSpecies[] = [
  { id: "blue", name: "대왕고래", english: "Blue whale", scientific: "Balaenoptera musculus", length: 24, lengthNote: "북반구 크기 안내를 참고한 비교값", feature: "가장 거대한 몸 · 청회색 얼룩", familiarRank: 1, source: "https://www.acsonline.org/blue-whale", model: "gltf", asset: "/whale-flight/blue-whale.glb", clip: "Swimming" },
  { id: "fin", name: "참고래", english: "Fin whale", scientific: "Balaenoptera physalus", length: 21, lengthNote: "북반구 일반 크기 18–22m 참고", feature: "길고 날렵한 몸 · 비대칭 흰 아래턱", familiarRank: 8, source: "https://www.firmm.org/en/whales-dolphins/fin-whale", model: "original" },
  { id: "sperm", name: "향고래", english: "Sperm whale", scientific: "Physeter macrocephalus", length: 16, lengthNote: "성체 수컷 비교값 · 암컷은 더 작음", feature: "커다란 사각 머리 · 가느다란 아래턱", familiarRank: 3, source: "https://www.acsonline.org/sperm-whale", model: "gltf", asset: "/whale-flight/sperm-whale.glb", clip: "Armature|ArmatureAction" },
  { id: "humpback", name: "혹등고래", english: "Humpback whale", scientific: "Megaptera novaeangliae", length: 14.5, lengthNote: "성체 크기 안내 12.2–15.2m 참고", feature: "긴 가슴지느러미 · 머리의 돌기", familiarRank: 2, source: "https://www.acsonline.org/humpback-whale", model: "gltf", asset: "/whale-flight/humpback-whale.glb", clip: "Armature|ArmatureAction" },
  { id: "gray", name: "귀신고래", english: "Gray whale", scientific: "Eschrichtius robustus", length: 14, lengthNote: "성체 수컷 안내를 참고한 비교값", feature: "회색 반점 · 등지느러미 대신 낮은 등혹", familiarRank: 9, source: "https://www.acsonline.org/gray-whale", model: "original" },
  { id: "minke", name: "밍크고래", english: "Common minke whale", scientific: "Balaenoptera acutorostrata", length: 8.5, lengthNote: "일반적인 몸길이 약 8–9m 참고", feature: "뾰족한 주둥이 · 가슴지느러미 흰 띠", familiarRank: 10, source: "https://uk.whales.org/whales-dolphins/species-guide/common-minke-whale/", model: "original" },
  { id: "orca", name: "범고래", english: "Orca", scientific: "Orcinus orca", length: 7, lengthNote: "성체 수컷 비교값 · 성별·생태형에 따라 다름", feature: "검정과 흰 무늬 · 높은 등지느러미", familiarRank: 4, source: "https://wdfw.wa.gov/sites/default/files/2024-03/10-orca-psr-31524.pdf", model: "gltf", asset: "/whale-flight/orca.glb", clip: "Take 001" },
  { id: "narwhal", name: "일각고래", english: "Narwhal", scientific: "Monodon monoceros", length: 4.5, lengthNote: "몸길이 비교값 · 수컷의 엄니는 별도", feature: "나선형 엄니 · 삼각형 등지느러미 없음", familiarRank: 6, source: "https://www.arcticwwf.org/wildlife/narwhal/", model: "original" },
  { id: "beluga", name: "흰고래", english: "Beluga", scientific: "Delphinapterus leucas", length: 4, lengthNote: "일반 크기 3.5–5.5m를 참고한 비교값", feature: "하얀 몸 · 둥근 이마 · 등지느러미 없음", familiarRank: 5, source: "https://www.arcticwwf.org/wildlife/beluga-whale/", model: "original" },
  { id: "bottlenose", name: "큰돌고래", english: "Bottlenose dolphin", scientific: "Tursiops truncatus", length: 3, lengthNote: "성체 크기 2.5–3.8m 참고", feature: "돌출된 부리 · 낫 모양 등지느러미", familiarRank: 7, source: "https://www.acsonline.org/bottlenose-dolphin", model: "gltf", asset: "/whale-flight/bottlenose-dolphin.glb", clip: "Scene" },
];
export function orderedSpecies(order: SpeciesOrder): WhaleSpecies[] {
  return [...WHALE_SPECIES].sort((a, b) => order === "size" ? b.length - a.length : a.familiarRank - b.familiarRank);
}
export function speciesById(id: WhaleSpeciesId): WhaleSpecies {
  const species = WHALE_SPECIES.find(item => item.id === id);
  if (!species) throw new Error(`Unknown whale species: ${id}`);
  return species;
}
