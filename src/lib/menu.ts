export const FLAVOR_IDS = ["anko", "custard", "matcha", "choco"] as const;
export type FlavorId = (typeof FLAVOR_IDS)[number];

export type Flavor = {
  id: FlavorId;
  name: string;
  /** ボタンなど塗りつぶし用（Tailwind クラス） */
  bg: string;
  /** 塗りつぶしの上に載せる文字色 */
  fg: string;
  /** 枠線・文字のアクセント用 */
  border: string;
  text: string;
};

export const FLAVORS: readonly Flavor[] = [
  { id: "anko", name: "あんこ", bg: "bg-anko", fg: "text-white", border: "border-anko", text: "text-anko" },
  { id: "custard", name: "カスタード", bg: "bg-custard", fg: "text-ink", border: "border-custard", text: "text-amber-700" },
  { id: "matcha", name: "抹茶", bg: "bg-matcha", fg: "text-white", border: "border-matcha", text: "text-matcha" },
  { id: "choco", name: "チョコ", bg: "bg-choco", fg: "text-white", border: "border-choco", text: "text-choco" },
];

export const FLAVOR_BY_ID: Record<FlavorId, Flavor> = Object.fromEntries(
  FLAVORS.map((f) => [f.id, f]),
) as Record<FlavorId, Flavor>;

export type FlavorCounts = Record<FlavorId, number>;

export function emptyCounts(): FlavorCounts {
  return { anko: 0, custard: 0, matcha: 0, choco: 0 };
}

export const DEFAULT_CAPACITY: FlavorCounts = { anko: 150, custard: 50, matcha: 50, choco: 50 };
export const DEFAULT_TARGET_QTY = 300;
