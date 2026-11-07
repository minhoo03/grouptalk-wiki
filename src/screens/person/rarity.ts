import type { Rarity } from "@/types/chat";

export const rarityMeta: Record<
  Rarity,
  { label: string; chip: string; square: string }
> = {
  legend: { label: "전설", chip: "bg-legend text-white", square: "bg-legend" },
  epic: { label: "영웅", chip: "bg-epic text-white", square: "bg-epic" },
  rare: { label: "희귀", chip: "bg-rare text-white", square: "bg-rare" },
  common: { label: "일반", chip: "bg-common text-white", square: "bg-common" },
};
