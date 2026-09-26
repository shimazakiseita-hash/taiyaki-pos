import { FLAVORS, FLAVOR_IDS, emptyCounts, type FlavorCounts, type FlavorId } from "./menu";
import { calcTickets } from "./pricing";
import type { Order, OrderItem, Settings } from "./types";

const AVG_WAIT_SAMPLE = 10;

export type Summary = {
  /** 販売数（cancelled 以外） */
  soldTotal: number;
  soldByFlavor: FlavorCounts;
  /** 売上（円）と金券枚数 */
  revenue: number;
  tickets: number;
  /** 焼くべき数（waiting の個数） */
  toBakeTotal: number;
  toBakeByFlavor: FlavorCounts;
  /** 残り販売可能数（仕込み上限 − 販売数）。上限を下げた場合は負になりうる */
  remainingByFlavor: FlavorCounts;
  waitingCount: number;
  readyCount: number;
  /** 直近10件の served の平均待ち時間（秒）。served が無ければ null */
  avgWaitSeconds: number | null;
  targetQty: number;
  capacity: FlavorCounts;
};

function addItems(counts: FlavorCounts, items: readonly OrderItem[]): void {
  for (const item of items) counts[item.flavor] += item.qty;
}

/** 味別の販売数（cancelled 以外） */
export function soldByFlavor(orders: readonly Order[]): FlavorCounts {
  const counts = emptyCounts();
  for (const o of orders) if (o.status !== "cancelled") addItems(counts, o.items);
  return counts;
}

export function computeSummary(orders: readonly Order[], settings: Settings): Summary {
  const sold = soldByFlavor(orders);
  const toBake = emptyCounts();
  let revenue = 0;
  let waitingCount = 0;
  let readyCount = 0;

  for (const o of orders) {
    if (o.status === "cancelled") continue;
    revenue += o.amount;
    if (o.status === "waiting") {
      waitingCount++;
      addItems(toBake, o.items);
    } else if (o.status === "ready") {
      readyCount++;
    }
  }

  const remaining = emptyCounts();
  for (const id of FLAVOR_IDS) remaining[id] = settings.capacity[id] - sold[id];

  return {
    soldTotal: sum(sold),
    soldByFlavor: sold,
    revenue,
    tickets: calcTickets(revenue),
    toBakeTotal: sum(toBake),
    toBakeByFlavor: toBake,
    remainingByFlavor: remaining,
    waitingCount,
    readyCount,
    avgWaitSeconds: averageWaitSeconds(orders),
    targetQty: settings.targetQty,
    capacity: settings.capacity,
  };
}

export function averageWaitSeconds(orders: readonly Order[], sample = AVG_WAIT_SAMPLE): number | null {
  const recent = orders
    .filter((o): o is Order & { servedAt: string } => o.status === "served" && o.servedAt !== null)
    .sort((a, b) => Date.parse(b.servedAt) - Date.parse(a.servedAt))
    .slice(0, sample);
  if (recent.length === 0) return null;
  const total = recent.reduce((acc, o) => acc + (Date.parse(o.servedAt) - Date.parse(o.createdAt)), 0);
  return Math.round(total / recent.length / 1000);
}

/** 追加注文で仕込み上限を超える味を返す（超えなければ空配列） */
export function findOverCapacity(
  sold: FlavorCounts,
  capacity: FlavorCounts,
  items: readonly OrderItem[],
): { flavor: FlavorId; remaining: number }[] {
  return items
    .map((i) => ({ flavor: i.flavor, qty: i.qty, remaining: capacity[i.flavor] - sold[i.flavor] }))
    .filter((x) => x.qty > x.remaining)
    .map(({ flavor, remaining }) => ({ flavor, remaining: Math.max(0, remaining) }));
}

export function sum(counts: FlavorCounts): number {
  return FLAVORS.reduce((acc, f) => acc + counts[f.id], 0);
}
