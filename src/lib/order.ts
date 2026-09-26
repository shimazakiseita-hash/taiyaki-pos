import { DomainError } from "./errors";
import { FLAVOR_IDS, emptyCounts } from "./menu";
import { MAX_ORDER_QTY, MIN_ORDER_QTY } from "./pricing";
import type { OrderItem } from "./types";

/** 同じ味をまとめ、0個の行を除き、メニュー順に並べる。総個数が範囲外なら INVALID_INPUT */
export function normalizeItems(items: readonly OrderItem[]): { items: OrderItem[]; totalQty: number } {
  const counts = emptyCounts();
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty < 0) {
      throw new DomainError("INVALID_INPUT", "個数が不正です");
    }
    counts[item.flavor] += item.qty;
  }
  const merged = FLAVOR_IDS.filter((id) => counts[id] > 0).map((id) => ({ flavor: id, qty: counts[id] }));
  const totalQty = merged.reduce((acc, i) => acc + i.qty, 0);
  if (totalQty < MIN_ORDER_QTY || totalQty > MAX_ORDER_QTY) {
    throw new DomainError("INVALID_INPUT", `1注文の個数は${MIN_ORDER_QTY}〜${MAX_ORDER_QTY}個です`);
  }
  return { items: merged, totalQty };
}
