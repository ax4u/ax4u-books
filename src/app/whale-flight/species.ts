export type WhaleSpeciesId = "blue" | "humpback" | "sperm" | "orca" | "porpoise";
export type WhaleSpecies = {
  id: WhaleSpeciesId; name: string; english: string; scientific: string;
  length: number; model: "gltf" | "original"; asset?: string; clip?: string;
};
/** Internal production metadata, not a species information UI.
 * Twenty independent animals per species. Lengths are representative individuals,
 * not population means or maximum records. Porpoise taxonomy is recorded in credits.
 */
export const ANIMALS_PER_SPECIES = 20;
export const WHALE_SPECIES: readonly WhaleSpecies[] = [
  {id:"blue",name:"대왕고래",english:"Blue whale",scientific:"Balaenoptera musculus",length:24,model:"gltf",asset:"/whale-flight/blue-whale.glb",clip:"Swimming"},
  {id:"humpback",name:"혹등고래",english:"Humpback whale",scientific:"Megaptera novaeangliae",length:14.5,model:"gltf",asset:"/whale-flight/humpback-whale.glb",clip:"Armature|ArmatureAction"},
  {id:"sperm",name:"향고래",english:"Sperm whale",scientific:"Physeter macrocephalus",length:16,model:"gltf",asset:"/whale-flight/sperm-whale.glb",clip:"Armature|ArmatureAction"},
  {id:"orca",name:"범고래",english:"Orca",scientific:"Orcinus orca",length:7,model:"gltf",asset:"/whale-flight/orca.glb",clip:"Take 001"},
  {id:"porpoise",name:"상괭이",english:"Narrow-ridged finless porpoise",scientific:"Neophocaena asiaeorientalis",length:1.8,model:"original"},
];
export const ANIMAL_COUNT = WHALE_SPECIES.length * ANIMALS_PER_SPECIES;
