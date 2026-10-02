import type { Order } from "./types";

/** お客さん向けに公開する呼び出し状況（番号だけ。金額・味は含めない） */
export type PublicStatus = {
  ready: number[]; // 新しく呼んだ順
  waiting: number[]; // 番号の小さい順
};

export type NumberLookup = { state: "ready" } | { state: "waiting"; ahead: number } | { state: "notFound" };

export function toPublicStatus(orders: Order[]): PublicStatus {
  const ready = orders
    .filter((o) => o.status === "ready")
    .sort((a, b) => Date.parse(b.readyAt ?? "") - Date.parse(a.readyAt ?? ""))
    .map((o) => o.number);
  const waiting = orders
    .filter((o) => o.status === "waiting")
    .map((o) => o.number)
    .sort((a, b) => a - b);
  return { ready, waiting };
}

/** 番号の状態と、焼き待ちなら前に何件あるか */
export function lookupNumber(status: PublicStatus, n: number): NumberLookup {
  if (status.ready.includes(n)) return { state: "ready" };
  if (status.waiting.includes(n)) {
    return { state: "waiting", ahead: status.waiting.filter((w) => w < n).length };
  }
  return { state: "notFound" };
}
