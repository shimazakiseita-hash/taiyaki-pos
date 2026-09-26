"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { ItemBadges, itemsText } from "@/components/ItemBadges";
import { Toast, useToast } from "@/components/Toast";
import { sendJson, setOrderStatus } from "@/lib/client";
import { FLAVORS, emptyCounts, type FlavorCounts } from "@/lib/menu";
import { MAX_ORDER_QTY, calcAmount, calcTickets } from "@/lib/pricing";
import { STATUS_LABELS } from "@/lib/status";
import { sum, type Summary } from "@/lib/summary";
import type { CreatedOrder, Order } from "@/lib/types";
import { usePolling } from "@/lib/usePolling";

const RECENT_COUNT = 5;

export function RegisterScreen() {
  const summary = usePolling<Summary>("/api/summary");
  const orders = usePolling<Order[]>("/api/orders");
  const toast = useToast();

  const [cart, setCart] = useState<FlavorCounts>(emptyCounts);
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<CreatedOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const totalQty = sum(cart);
  const amount = calcAmount(totalQty);
  const tickets = calcTickets(amount);
  const remaining = summary.data?.remainingByFlavor;

  const add = (id: keyof FlavorCounts) => setCart((c) => ({ ...c, [id]: c[id] + 1 }));
  const sub = (id: keyof FlavorCounts) => setCart((c) => ({ ...c, [id]: Math.max(0, c[id] - 1) }));
  const clear = () => setCart(emptyCounts());

  async function submit() {
    if (submitting || totalQty === 0) return;
    setSubmitting(true);
    const items = FLAVORS.filter((f) => cart[f.id] > 0).map((f) => ({ flavor: f.id, qty: cart[f.id] }));
    const res = await sendJson<CreatedOrder>("POST", "/api/orders", { items });
    setSubmitting(false);
    if (res.ok) {
      setIssued(res.data);
    } else {
      toast.show(res.error);
    }
    summary.refresh();
    orders.refresh();
  }

  function next() {
    setIssued(null);
    clear();
  }

  async function cancelOrder() {
    if (!cancelTarget) return;
    setCancelling(true);
    const res = await setOrderStatus(cancelTarget.id, "cancelled");
    setCancelling(false);
    setCancelTarget(null);
    if (!res.ok) toast.show(res.error);
    else toast.show(`${cancelTarget.number}番を取り消しました`);
    summary.refresh();
    orders.refresh();
  }

  const recent = (orders.data ?? []).slice(-RECENT_COUNT).reverse();

  if (issued) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-amber-50 p-6 text-center">
        <p className="text-4xl font-bold text-gray-700">呼び出し番号</p>
        <p className="text-[min(40vh,28rem)] leading-none font-black tabular-nums text-amber-800">{issued.number}</p>
        <p className="text-3xl font-bold">
          {issued.amount.toLocaleString()}円（金券 {issued.tickets}枚）
        </p>
        <button
          type="button"
          autoFocus
          onClick={next}
          className="min-h-24 w-full max-w-xl rounded-3xl bg-amber-600 text-4xl font-bold text-white shadow-lg active:bg-amber-700"
        >
          次のお客さん
        </button>
      </main>
    );
  }

  return (
    <>
      <ConnectionBanner error={summary.error || orders.error} />
      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {FLAVORS.map((f) => {
              const left = remaining ? remaining[f.id] - cart[f.id] : null;
              const soldOut = remaining ? remaining[f.id] <= 0 : false;
              const canAdd = left !== null && left > 0 && totalQty < MAX_ORDER_QTY;
              return (
                <div key={f.id} className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => add(f.id)}
                    disabled={!canAdd}
                    className={`relative flex min-h-40 flex-col items-center justify-center rounded-3xl text-4xl font-black shadow-md active:scale-[0.98] disabled:opacity-40 ${f.bg} ${f.fg}`}
                  >
                    {f.name}
                    <span className="mt-2 text-xl font-bold">
                      {soldOut ? "売り切れ" : left === null ? "…" : `残り ${Math.max(0, left)}`}
                    </span>
                    {cart[f.id] > 0 && (
                      <span className="absolute top-3 right-3 flex h-14 min-w-14 items-center justify-center rounded-full bg-white px-2 text-3xl font-black text-gray-900 shadow">
                        {cart[f.id]}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => sub(f.id)}
                    disabled={cart[f.id] === 0}
                    className={`min-h-16 rounded-2xl border-4 bg-white text-3xl font-black active:bg-gray-100 disabled:opacity-30 ${f.border}`}
                    aria-label={`${f.name}を1つ減らす`}
                  >
                    −
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-3xl border-2 border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-xl font-bold text-gray-600">直近の注文</h2>
            {recent.length === 0 ? (
              <p className="text-lg text-gray-500">まだ注文はありません</p>
            ) : (
              <ul className="divide-y">
                {recent.map((o) => (
                  <li key={o.id} className="flex min-h-16 items-center gap-4 py-2">
                    <span className="w-16 text-3xl font-black tabular-nums">{o.number}</span>
                    <span className="flex-1">
                      <ItemBadges items={o.items} size="sm" />
                    </span>
                    <span className="text-lg tabular-nums">{o.amount}円</span>
                    <span className={`w-28 text-center text-lg font-bold ${o.status === "cancelled" ? "text-gray-400 line-through" : ""}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                    {o.status === "waiting" ? (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(o)}
                        className="min-h-16 w-28 rounded-2xl border-2 border-red-500 text-lg font-bold text-red-600 active:bg-red-50"
                      >
                        取り消し
                      </button>
                    ) : (
                      <span className="w-28" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-3xl border-2 border-amber-700 bg-white p-6 lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-2xl font-bold">ご注文</h2>
          <ul className="min-h-32 space-y-1 text-2xl">
            {FLAVORS.filter((f) => cart[f.id] > 0).map((f) => (
              <li key={f.id} className="flex justify-between">
                <span className={`font-bold ${f.text}`}>{f.name}</span>
                <span className="tabular-nums">× {cart[f.id]}</span>
              </li>
            ))}
            {totalQty === 0 && <li className="text-gray-400">味のボタンを押してください</li>}
          </ul>
          <div className="flex items-baseline justify-between border-t pt-4 text-2xl">
            <span>合計個数</span>
            <span className="font-bold tabular-nums">
              {totalQty}個{totalQty >= MAX_ORDER_QTY && <span className="ml-2 text-base text-red-600">（上限）</span>}
            </span>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 text-center">
            <p className="text-6xl font-black tabular-nums">{amount.toLocaleString()}円</p>
            <p className="mt-2 text-5xl font-black text-amber-800 tabular-nums">金券 {tickets}枚</p>
            <p className="mt-2 text-base text-gray-600">1個200円・味を問わず3個で500円</p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={totalQty === 0 || submitting}
            className="min-h-24 rounded-3xl bg-amber-600 text-4xl font-black text-white shadow-lg active:bg-amber-700 disabled:opacity-40"
          >
            {submitting ? "送信中…" : "確定"}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={totalQty === 0 || submitting}
            className="min-h-16 rounded-2xl border-2 border-gray-400 text-2xl font-bold active:bg-gray-100 disabled:opacity-30"
          >
            クリア
          </button>
        </section>
      </main>

      <ConfirmDialog
        open={cancelTarget !== null}
        title={`${cancelTarget?.number}番を取り消しますか？`}
        confirmLabel="取り消す"
        busy={cancelling}
        onConfirm={cancelOrder}
        onCancel={() => setCancelTarget(null)}
      >
        {cancelTarget && (
          <>
            <p>{itemsText(cancelTarget.items)}（{cancelTarget.amount}円）</p>
            <p className="mt-2 font-bold text-red-600">金券 {calcTickets(cancelTarget.amount)}枚をお客さんに返してください。</p>
          </>
        )}
      </ConfirmDialog>
      <Toast message={toast.message} onClose={toast.clear} />
    </>
  );
}
