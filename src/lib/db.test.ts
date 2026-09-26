import { beforeEach, describe, expect, it } from "vitest";
import { createOrder, getSettings, listOrders, openDb, putSettings, updateStatus, type DB } from "./db";
import { DomainError } from "./errors";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
});

function expectDomainError(fn: () => unknown, code: DomainError["code"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error("例外が発生しませんでした");
}

describe("createOrder", () => {
  it("金額・金券枚数を計算し、同じ味をまとめて保存する", () => {
    const r = createOrder(db, [
      { flavor: "anko", qty: 2 },
      { flavor: "choco", qty: 1 },
      { flavor: "anko", qty: 1 },
    ]);
    expect(r).toMatchObject({ number: 1, amount: 700, tickets: 7 });
    const [o] = listOrders(db);
    expect(o.status).toBe("waiting");
    expect(o.totalQty).toBe(4);
    expect(o.items).toEqual([
      { flavor: "anko", qty: 3 },
      { flavor: "choco", qty: 1 },
    ]);
  });

  it("呼び出し番号は1からの連番で重複しない（取り消し後も続きから）", () => {
    const numbers: number[] = [];
    for (let i = 0; i < 50; i++) {
      const r = createOrder(db, [{ flavor: "anko", qty: 1 }]);
      numbers.push(r.number);
      if (i % 7 === 0) updateStatus(db, r.id, "cancelled");
    }
    expect(numbers).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(new Set(listOrders(db).map((o) => o.number)).size).toBe(50);
  });

  it("個数が 0 や 21 以上なら INVALID_INPUT", () => {
    expectDomainError(() => createOrder(db, []), "INVALID_INPUT");
    expectDomainError(() => createOrder(db, [{ flavor: "anko", qty: 21 }]), "INVALID_INPUT");
  });

  it("仕込み上限を超えると OVER_CAPACITY で、番号を消費しない", () => {
    putSettings(db, { capacity: { matcha: 3 } });
    createOrder(db, [{ flavor: "matcha", qty: 2 }]);
    expectDomainError(() => createOrder(db, [{ flavor: "matcha", qty: 2 }]), "OVER_CAPACITY");
    expect(createOrder(db, [{ flavor: "matcha", qty: 1 }]).number).toBe(2);
    expectDomainError(() => createOrder(db, [{ flavor: "matcha", qty: 1 }]), "OVER_CAPACITY");
  });

  it("取り消した分は再び販売できる", () => {
    putSettings(db, { capacity: { choco: 2 } });
    const r = createOrder(db, [{ flavor: "choco", qty: 2 }]);
    updateStatus(db, r.id, "cancelled");
    expect(createOrder(db, [{ flavor: "choco", qty: 2 }]).number).toBe(2);
  });
});

describe("updateStatus", () => {
  it("waiting → ready → served → ready → waiting とタイムスタンプ", () => {
    const { id } = createOrder(db, [{ flavor: "anko", qty: 1 }]);
    const t1 = new Date("2026-10-01T03:01:00.000Z");
    const t2 = new Date("2026-10-01T03:02:00.000Z");

    let o = updateStatus(db, id, "ready", t1);
    expect(o).toMatchObject({ status: "ready", readyAt: t1.toISOString(), servedAt: null });
    o = updateStatus(db, id, "served", t2);
    expect(o).toMatchObject({ status: "served", readyAt: t1.toISOString(), servedAt: t2.toISOString() });
    o = updateStatus(db, id, "ready");
    expect(o).toMatchObject({ status: "ready", readyAt: t1.toISOString(), servedAt: null });
    o = updateStatus(db, id, "waiting");
    expect(o).toMatchObject({ status: "waiting", readyAt: null });
  });

  it("不正な遷移は INVALID_TRANSITION、存在しない注文は NOT_FOUND", () => {
    const { id } = createOrder(db, [{ flavor: "anko", qty: 1 }]);
    expectDomainError(() => updateStatus(db, id, "served"), "INVALID_TRANSITION");
    updateStatus(db, id, "cancelled");
    expectDomainError(() => updateStatus(db, id, "waiting"), "INVALID_TRANSITION");
    expectDomainError(() => updateStatus(db, 999, "ready"), "NOT_FOUND");
  });
});

describe("listOrders", () => {
  it("状態で絞り込める", () => {
    const a = createOrder(db, [{ flavor: "anko", qty: 1 }]);
    createOrder(db, [{ flavor: "custard", qty: 2 }]);
    updateStatus(db, a.id, "ready");
    expect(listOrders(db, ["ready"]).map((o) => o.number)).toEqual([1]);
    expect(listOrders(db, ["waiting", "ready"]).map((o) => o.number)).toEqual([1, 2]);
    expect(listOrders(db, ["waiting"])[0].items).toEqual([{ flavor: "custard", qty: 2 }]);
  });
});

describe("settings", () => {
  it("初期値と部分更新", () => {
    expect(getSettings(db)).toEqual({ capacity: { anko: 150, custard: 50, matcha: 50, choco: 50 }, targetQty: 300 });
    const s = putSettings(db, { capacity: { anko: 120 }, targetQty: 280 });
    expect(s).toEqual({ capacity: { anko: 120, custard: 50, matcha: 50, choco: 50 }, targetQty: 280 });
  });
});
