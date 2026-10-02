import { describe, expect, it } from "vitest";
import { lookupNumber, toPublicStatus } from "./publicStatus";
import { publicStatusSchema } from "./schemas";
import type { Order } from "./types";
import type { OrderStatus } from "./status";

function order(number: number, status: OrderStatus, readyAt: string | null = null): Order {
  return {
    id: number,
    number,
    status,
    totalQty: 1,
    amount: 200,
    createdAt: "2026-10-01T03:00:00.000Z",
    readyAt,
    servedAt: null,
    cancelledAt: null,
    items: [{ flavor: "anko", qty: 1 }],
  };
}

describe("toPublicStatus", () => {
  it("呼び出し中は新しく呼んだ順、焼き待ちは番号順で、それ以外は含めない", () => {
    const s = toPublicStatus([
      order(5, "waiting"),
      order(1, "ready", "2026-10-01T03:05:00.000Z"),
      order(2, "ready", "2026-10-01T03:07:00.000Z"),
      order(3, "served"),
      order(4, "cancelled"),
      order(6, "waiting"),
      order(7, "waiting"),
    ], 300);
    expect(s).toEqual({ ready: [2, 1], waiting: [5, 6, 7], avgWaitSeconds: 300 });
  });

  it("番号以外の情報（金額・味）は含めない", () => {
    expect(Object.keys(toPublicStatus([order(1, "waiting")], null))).toEqual(["ready", "waiting", "avgWaitSeconds"]);
  });
});

describe("lookupNumber", () => {
  const s = { ready: [3], waiting: [4, 6, 9], avgWaitSeconds: null };

  it("呼び出し中の番号", () => {
    expect(lookupNumber(s, 3)).toEqual({ state: "ready" });
  });

  it("焼き待ちなら、自分より小さい焼き待ち番号の数が前の件数", () => {
    expect(lookupNumber(s, 4)).toEqual({ state: "waiting", ahead: 0 });
    expect(lookupNumber(s, 9)).toEqual({ state: "waiting", ahead: 2 });
  });

  it("どちらにもない番号（受け渡し済み・取り消し・番号違い）", () => {
    expect(lookupNumber(s, 1)).toEqual({ state: "notFound" });
  });
});

describe("publicStatusSchema", () => {
  it("番号の配列だけを受け付ける", () => {
    expect(publicStatusSchema.safeParse({ ready: [1], waiting: [2, 3], avgWaitSeconds: 240 }).success).toBe(true);
    expect(publicStatusSchema.safeParse({ ready: [], waiting: [], avgWaitSeconds: null }).success).toBe(true);
    expect(publicStatusSchema.safeParse({ ready: [0], waiting: [], avgWaitSeconds: null }).success).toBe(false);
    expect(publicStatusSchema.safeParse({ ready: ["1"], waiting: [], avgWaitSeconds: null }).success).toBe(false);
    expect(publicStatusSchema.safeParse({ ready: [], waiting: [], avgWaitSeconds: -1 }).success).toBe(false);
    expect(publicStatusSchema.safeParse({ ready: [] }).success).toBe(false);
  });
});
