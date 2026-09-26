"use client";

import { AppHeader } from "@/components/AppHeader";
import { useState } from "react";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { ItemBadges } from "@/components/ItemBadges";
import { Toast, useToast } from "@/components/Toast";
import { setOrderStatus } from "@/lib/client";
import { FLAVORS } from "@/lib/menu";
import type { OrderStatus } from "@/lib/status";
import { countByFlavor, sum } from "@/lib/summary";
import type { Order } from "@/lib/types";
import { formatElapsed, useNow } from "@/lib/useNow";
import { usePolling } from "@/lib/usePolling";

const LATE_MS = 10 * 60 * 1000;
const RECENT_SERVED = 3;

export function KitchenScreen() {
  const orders = usePolling<Order[]>("/api/orders?status=waiting,ready,served");
  const now = useNow(orders.clockOffsetMs);
  const toast = useToast();
  const [pending, setPending] = useState<Set<number>>(new Set());

  const all = orders.data ?? [];
  const waiting = all.filter((o) => o.status === "waiting");
  const ready = all
    .filter((o) => o.status === "ready")
    .sort((a, b) => Date.parse(a.readyAt ?? a.createdAt) - Date.parse(b.readyAt ?? b.createdAt));
  const served = all
    .filter((o) => o.status === "served")
    .sort((a, b) => Date.parse(b.servedAt ?? "") - Date.parse(a.servedAt ?? ""))
    .slice(0, RECENT_SERVED);
  const toBake = countByFlavor(waiting);

  async function move(order: Order, to: OrderStatus) {
    setPending((s) => new Set(s).add(order.id));
    const res = await setOrderStatus(order.id, to);
    if (!res.ok) toast.show(res.error);
    await orders.refresh();
    setPending((s) => {
      const next = new Set(s);
      next.delete(order.id);
      return next;
    });
  }

  return (
    <>
      <AppHeader title="キッチン" error={orders.status} />
      <ConnectionBanner error={orders.error} />
      <header className="grid grid-cols-5 gap-3 border-b-2 border-amber-800 bg-white p-3">
        {FLAVORS.map((f) => (
          <div key={f.id} className={`rounded-2xl p-3 text-center ${f.bg} ${f.fg}`}>
            <div className="text-xl font-bold">{f.name}</div>
            <div className="text-6xl leading-tight font-black tabular-nums">{toBake[f.id]}</div>
          </div>
        ))}
        <div className="rounded-2xl bg-gray-900 p-3 text-center text-white">
          <div className="text-xl font-bold">焼くべき数 合計</div>
          <div className="text-6xl leading-tight font-black tabular-nums">{sum(toBake)}</div>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-[2fr_1fr] gap-4 p-4">
        <section>
          <h2 className="mb-3 text-2xl font-bold">
            焼き待ち <span className="tabular-nums">{waiting.length}</span>件
            <span className="ml-3 text-base font-normal text-gray-600">古い順</span>
          </h2>
          {waiting.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-2xl text-gray-400">焼き待ちの注文はありません</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {waiting.map((o) => {
                const elapsed = now - Date.parse(o.createdAt);
                const late = elapsed >= LATE_MS;
                return (
                  <li
                    key={o.id}
                    className={`flex flex-col gap-3 rounded-3xl border-4 p-4 shadow-sm ${
                      late ? "border-red-600 bg-red-50" : "border-amber-200 bg-white"
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-6xl font-black tabular-nums">{o.number}</span>
                      <span className={`text-2xl font-bold tabular-nums ${late ? "text-red-600" : "text-gray-600"}`}>
                        {late && "⚠ "}
                        {formatElapsed(elapsed)}
                      </span>
                    </div>
                    <ItemBadges items={o.items} size="lg" />
                    <button
                      type="button"
                      onClick={() => move(o, "ready")}
                      disabled={pending.has(o.id)}
                      className="min-h-20 rounded-2xl bg-amber-600 text-3xl font-black text-white active:bg-amber-700 disabled:opacity-40"
                    >
                      完成
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-3xl border-4 border-green-600 bg-white p-4">
            <h2 className="mb-3 text-2xl font-bold text-green-700">
              呼び出し中 <span className="tabular-nums">{ready.length}</span>件
            </h2>
            {ready.length === 0 ? (
              <p className="text-xl text-gray-400">なし</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {ready.map((o) => (
                  <li key={o.id} className="rounded-2xl bg-green-50 p-3">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-5xl font-black tabular-nums">{o.number}</span>
                      <ItemBadges items={o.items} size="sm" />
                    </div>
                    <div className="grid grid-cols-[2fr_1fr] gap-2">
                      <button
                        type="button"
                        onClick={() => move(o, "served")}
                        disabled={pending.has(o.id)}
                        className="min-h-16 rounded-2xl bg-green-600 text-2xl font-black text-white active:bg-green-700 disabled:opacity-40"
                      >
                        渡した
                      </button>
                      <button
                        type="button"
                        onClick={() => move(o, "waiting")}
                        disabled={pending.has(o.id)}
                        className="min-h-16 rounded-2xl border-2 border-gray-400 bg-white text-xl font-bold active:bg-gray-100 disabled:opacity-40"
                      >
                        戻す
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border-2 border-gray-300 bg-white p-4">
            <h2 className="mb-2 text-xl font-bold text-gray-600">最近渡した注文</h2>
            {served.length === 0 ? (
              <p className="text-lg text-gray-400">なし</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {served.map((o) => (
                  <li key={o.id} className="flex items-center gap-3">
                    <span className="w-16 text-3xl font-black text-gray-500 tabular-nums">{o.number}</span>
                    <span className="flex-1">
                      <ItemBadges items={o.items} size="sm" />
                    </span>
                    <button
                      type="button"
                      onClick={() => move(o, "ready")}
                      disabled={pending.has(o.id)}
                      className="min-h-16 w-24 rounded-2xl border-2 border-gray-400 text-xl font-bold active:bg-gray-100 disabled:opacity-40"
                    >
                      戻す
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
      <Toast message={toast.message} onClose={toast.clear} />
    </>
  );
}
