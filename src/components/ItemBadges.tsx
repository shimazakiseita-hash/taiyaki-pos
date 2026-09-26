import { FLAVOR_BY_ID } from "@/lib/menu";
import type { OrderItem } from "@/lib/types";

/** 味ごとの個数を色付きバッジで並べる */
export function ItemBadges({ items, size = "md" }: { items: readonly OrderItem[]; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "px-2 py-0.5 text-base", md: "px-3 py-1 text-xl", lg: "px-4 py-2 text-3xl" }[size];
  return (
    <span className="flex flex-wrap gap-2">
      {items.map((i) => {
        const f = FLAVOR_BY_ID[i.flavor];
        return (
          <span key={i.flavor} className={`rounded-xl font-bold ${f.bg} ${f.fg} ${cls}`}>
            {f.name} {i.qty}
          </span>
        );
      })}
    </span>
  );
}

export function itemsText(items: readonly OrderItem[]): string {
  return items.map((i) => `${FLAVOR_BY_ID[i.flavor].name}${i.qty}`).join("・");
}
