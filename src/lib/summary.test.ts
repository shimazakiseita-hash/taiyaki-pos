import { describe, expect, it } from "vitest";
import { averageWaitSeconds, computeSummary } from "./summary";
import type { Order, OrderItem } from "./types";
import type { OrderStatus } from "./status";
import { calcAmount } from "./pricing";

let seq = 0;
function order(status: OrderStatus, items: OrderItem[], opts: Partial<Order> = {}): Order {
  seq++;
  const totalQty = items.reduce((a, i) => a + i.qty, 0);
  return {
    id: seq,
    number: seq,
    status,
    totalQty,
    amount: calcAmount(totalQty),
    createdAt: "2026-10-01T03:00:00.000Z",
    readyAt: null,
    servedAt: null,
    cancelledAt: null,
    items,
    ...opts,
  };
}

const settings = { targetQty: 300 };

describe("computeSummary", () => {
  const orders = [
    order("waiting", [{ flavor: "anko", qty: 2 }, { flavor: "matcha", qty: 1 }]), // 3個 500円
    order("ready", [{ flavor: "custard", qty: 1 }]), // 1個 200円
    order("served", [{ flavor: "anko", qty: 4 }], { servedAt: "2026-10-01T03:05:00.000Z" }), // 4個 700円
    order("cancelled", [{ flavor: "choco", qty: 5 }]), // 除外
    order("waiting", [{ flavor: "anko", qty: 1 }]), // 1個 200円
  ];
  const s = computeSummary(orders, settings);

  it("cancelled を除いた販売数・売上・金券枚数", () => {
    expect(s.soldTotal).toBe(9);
    expect(s.soldByFlavor).toEqual({ anko: 7, custard: 1, matcha: 1, choco: 0 });
    expect(s.revenue).toBe(1600);
    expect(s.tickets).toBe(16);
  });

  it("焼くべき数は waiting のみ", () => {
    expect(s.toBakeByFlavor).toEqual({ anko: 3, custard: 0, matcha: 1, choco: 0 });
    expect(s.toBakeTotal).toBe(4);
    expect(s.waitingCount).toBe(2);
    expect(s.readyCount).toBe(1);
  });
});

describe("averageWaitSeconds", () => {
  it("served が無ければ null", () => {
    expect(averageWaitSeconds([order("waiting", [{ flavor: "anko", qty: 1 }])])).toBeNull();
  });

  it("直近10件の served の平均（served_at が新しい順）", () => {
    const base = Date.parse("2026-10-01T03:00:00.000Z");
    const orders: Order[] = [];
    // 古い5件は待ち時間 1000秒、新しい10件は 60〜600秒
    for (let i = 0; i < 5; i++) {
      orders.push(
        order("served", [{ flavor: "anko", qty: 1 }], {
          createdAt: new Date(base + i * 1000).toISOString(),
          servedAt: new Date(base + i * 1000 + 1000_000).toISOString(),
        }),
      );
    }
    for (let i = 1; i <= 10; i++) {
      const created = base + 2_000_000 + i * 1000;
      orders.push(
        order("served", [{ flavor: "anko", qty: 1 }], {
          createdAt: new Date(created).toISOString(),
          servedAt: new Date(created + i * 60_000).toISOString(),
        }),
      );
    }
    orders.push(order("ready", [{ flavor: "anko", qty: 1 }]));
    expect(averageWaitSeconds(orders)).toBe(330);
  });
});
