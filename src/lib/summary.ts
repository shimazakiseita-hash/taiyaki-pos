import { FLAVORS, emptyCounts, type FlavorCounts } from "./menu";
import { calcTickets } from "./pricing";
import type { Order, OrderItem, Settings } from "./types";

const AVG_WAIT_SAMPLE = 10;
const PACE_SAMPLE = 10;
const PACE_MIN_SAMPLES = 3;

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
  waitingCount: number;
  readyCount: number;
  /** 直近10件の served の平均待ち時間（秒）。served が無ければ null */
  avgWaitSeconds: number | null;
  /** 完成のペース（1件あたり秒）。お客さん向けの「あと約◯分」に使う。完成が3件未満なら null */
  secondsPerOrder: number | null;
  targetQty: number;
};

function addItems(counts: FlavorCounts, items: readonly OrderItem[]): void {
  for (const item of items) counts[item.flavor] += item.qty;
}

/** 注文群の味別個数 */
export function countByFlavor(orders: readonly Order[]): FlavorCounts {
  const counts = emptyCounts();
  for (const o of orders) addItems(counts, o.items);
  return counts;
}

/** 味別の販売数（cancelled 以外） */
export function soldByFlavor(orders: readonly Order[]): FlavorCounts {
  return countByFlavor(orders.filter((o) => o.status !== "cancelled"));
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

  return {
    soldTotal: sum(sold),
    soldByFlavor: sold,
    revenue,
    tickets: calcTickets(revenue),
    toBakeTotal: sum(toBake),
    toBakeByFlavor: toBake,
    waitingCount,
    readyCount,
    avgWaitSeconds: averageWaitSeconds(orders),
    secondsPerOrder: secondsPerOrder(orders),
    targetQty: settings.targetQty,
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

/** 直近10件の完成（ready_at）の間隔の平均（秒）。まとめて焼いて一度に完成する分もならして扱う */
export function secondsPerOrder(orders: readonly Order[], sample = PACE_SAMPLE): number | null {
  const times = orders
    .filter((o) => (o.status === "ready" || o.status === "served") && o.readyAt !== null)
    .map((o) => Date.parse(o.readyAt!))
    .sort((a, b) => b - a)
    .slice(0, sample);
  if (times.length < PACE_MIN_SAMPLES) return null;
  return Math.round((times[0] - times[times.length - 1]) / (times.length - 1) / 1000);
}

export function sum(counts: FlavorCounts): number {
  return FLAVORS.reduce((acc, f) => acc + counts[f.id], 0);
}
