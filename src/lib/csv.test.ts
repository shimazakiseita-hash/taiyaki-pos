import { describe, expect, it } from "vitest";
import { ordersToCsv } from "./csv";
import type { Order } from "./types";

const order: Order = {
  id: 1,
  number: 7,
  status: "served",
  totalQty: 4,
  amount: 700,
  createdAt: "2026-10-01T03:00:00.000Z",
  readyAt: "2026-10-01T03:05:00.000Z",
  servedAt: "2026-10-01T03:06:00.000Z",
  cancelledAt: null,
  items: [
    { flavor: "anko", qty: 3 },
    { flavor: "choco", qty: 1 },
  ],
};

describe("ordersToCsv", () => {
  const csv = ordersToCsv([order]);
  const lines = csv.slice(1).trimEnd().split("\r\n");

  it("BOM付き・ヘッダー行つき", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(
      "番号,状態,あんこ,カスタード,抹茶,チョコ,個数,金額,金券枚数,注文時刻,完成時刻,受け渡し時刻,取り消し時刻",
    );
  });

  it("1行＝1注文で味別個数を列に持つ", () => {
    const cols = lines[1].split(",");
    expect(cols.slice(0, 9)).toEqual(["7", "受け渡し済み", "3", "0", "0", "1", "4", "700", "7"]);
    expect(cols[9]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(cols[12]).toBe("");
  });
});
