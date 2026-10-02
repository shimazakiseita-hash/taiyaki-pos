import type { Summary } from "./summary";
import type { Order } from "./types";

/** お客さん向けに公開する呼び出し状況（番号と待ち時間の目安だけ。金額・味は含めない） */
export type PublicStatus = {
  ready: number[]; // 新しく呼んだ順
  waiting: number[]; // 番号の小さい順
  avgWaitSeconds: number | null; // 直近の注文から受け取りまでの平均（秒）
  secondsPerOrder: number | null; // 完成のペース（1件あたり秒）
};

export type NumberLookup =
  | { state: "ready" }
  | { state: "waiting"; ahead: number; etaSeconds: number | null }
  | { state: "notFound" };

export function toPublicStatus(
  orders: Order[],
  { avgWaitSeconds, secondsPerOrder }: Pick<Summary, "avgWaitSeconds" | "secondsPerOrder">,
): PublicStatus {
  const ready = orders
    .filter((o) => o.status === "ready")
    .sort((a, b) => Date.parse(b.readyAt ?? "") - Date.parse(a.readyAt ?? ""))
    .map((o) => o.number);
  const waiting = orders
    .filter((o) => o.status === "waiting")
    .map((o) => o.number)
    .sort((a, b) => a - b);
  return { ready, waiting, avgWaitSeconds, secondsPerOrder };
}

/** 番号の状態と、焼き待ちなら前に何件あるか・できあがりまでの目安（自分の分も含めた件数 × 完成のペース） */
export function lookupNumber(status: PublicStatus, n: number): NumberLookup {
  if (status.ready.includes(n)) return { state: "ready" };
  if (status.waiting.includes(n)) {
    const ahead = status.waiting.filter((w) => w < n).length;
    const etaSeconds = status.secondsPerOrder === null ? null : (ahead + 1) * status.secondsPerOrder;
    return { state: "waiting", ahead, etaSeconds };
  }
  return { state: "notFound" };
}
