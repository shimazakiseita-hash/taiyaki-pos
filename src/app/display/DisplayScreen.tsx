"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import type { Order } from "@/lib/types";
import { usePolling } from "@/lib/usePolling";

const HIGHLIGHT_MS = 6000;

export function DisplayScreen() {
  const orders = usePolling<Order[]>("/api/orders?status=waiting,ready");
  const all = orders.data ?? [];
  const ready = all
    .filter((o) => o.status === "ready")
    .sort((a, b) => Date.parse(b.readyAt ?? "") - Date.parse(a.readyAt ?? ""));
  const waiting = all.filter((o) => o.status === "waiting");

  // 新しく ready になった番号を数秒間ハイライトする（画面を開いた時点の番号は対象外）
  const known = useRef<Set<number> | null>(null);
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const readyKey = ready.map((o) => o.id).join(",");

  useEffect(() => {
    if (!orders.data) return;
    const ids = readyKey ? readyKey.split(",").map(Number) : [];
    if (known.current === null) {
      known.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !known.current!.has(id));
    known.current = new Set(ids);
    if (fresh.length === 0) return;
    setHighlighted((s) => new Set([...s, ...fresh]));
    // 続けて別の番号が ready になっても消えるよう、タイマーは effect のやり直しで止めない
    timers.current.push(
      setTimeout(() => {
        setHighlighted((s) => new Set([...s].filter((id) => !fresh.includes(id))));
      }, HIGHLIGHT_MS),
    );
  }, [readyKey, orders.data]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  return (
    <>
      <ConnectionBanner error={orders.error} />
      <main className="flex flex-1 flex-col gap-4 bg-amber-50 p-4">
        <section className="flex-[3] rounded-3xl border-4 border-green-600 bg-white p-4">
          <h1 className="mb-4 text-center text-4xl font-black text-green-700 md:text-5xl">お呼び出し中</h1>
          {ready.length === 0 ? (
            <p className="py-8 text-center text-2xl text-gray-400">ただいま焼いています</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {ready.map((o) => (
                <li
                  key={o.id}
                  className={`rounded-2xl py-2 text-center text-7xl font-black tabular-nums transition-colors duration-700 md:text-8xl ${
                    highlighted.has(o.id) ? "animate-pulse bg-green-600 text-white" : "bg-green-50 text-green-800"
                  }`}
                >
                  {o.number}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-center text-xl text-gray-600">番号札をお持ちのうえ、受け取り口へお越しください</p>
        </section>

        <section className="flex-[2] rounded-3xl bg-white p-4">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-600">焼いています</h2>
          {waiting.length === 0 ? (
            <p className="text-center text-xl text-gray-400">—</p>
          ) : (
            <ul className="flex flex-wrap justify-center gap-3">
              {waiting.map((o) => (
                <li key={o.id} className="min-w-16 rounded-xl bg-amber-100 px-3 py-1 text-center text-3xl font-bold tabular-nums">
                  {o.number}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
