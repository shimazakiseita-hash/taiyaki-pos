"use client";

import Image from "next/image";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
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
    const label = String(issued.number);
    return (
      <main className="bg-seigaiha flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center text-white">
        <p className="text-4xl font-black tracking-wider">呼び出し番号</p>
        <div className="relative w-[min(52vh,78vw)]">
          <div className="issued-circle">
            <div className="issued-number tabular-nums" data-digits={label.length}>
              {label}
            </div>
          </div>
          <Image
            src="/brand/character.png"
            alt=""
            width={512}
            height={512}
            className="drift absolute -right-[22%] -bottom-[4%] w-[38%] rounded-full shadow-[0_0.4rem_0_rgb(0_0_0/0.3)]"
          />
        </div>
        <p className="text-3xl font-bold">
          {issued.amount.toLocaleString()}円（金券 {issued.tickets}枚）
        </p>
        <button
          type="button"
          autoFocus
          onClick={next}
          className="press min-h-24 w-full max-w-xl rounded-3xl bg-white text-4xl font-black text-navy shadow-[0_0.4rem_0_rgb(0_0_0/0.3)]"
        >
          次のお客さん
        </button>
      </main>
    );
  }

  return (
    <>
      <AppHeader title="レジ" error={summary.status === null ? null : summary.error || orders.error} />
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
                    aria-label={`${f.name}を1つ追加`}
                    className={`press flex min-h-44 flex-col justify-between rounded-3xl p-4 text-left shadow-[0_0.3rem_0_rgb(0_0_0/0.2)] disabled:opacity-40 ${f.bg} ${f.fg}`}
                  >
                    <span className="text-4xl font-black">{f.name}</span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="text-xl font-bold">{soldOut && "売り切れ"}</span>
                      <span
                        key={cart[f.id]}
                        className={`text-7xl leading-none font-black tabular-nums ${cart[f.id] > 0 ? "pop" : "opacity-40"}`}
                      >
                        {cart[f.id]}
                        <span className="ml-1 text-2xl">個</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sub(f.id)}
                    disabled={cart[f.id] === 0}
                    className={`press min-h-16 rounded-2xl border-4 bg-white text-3xl font-black text-ink active:bg-gray-100 disabled:opacity-30 ${f.border}`}
                    aria-label={`${f.name}を1つ減らす`}
                  >
                    −
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-xl font-bold text-navy">直近の注文</h2>
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
                        className="min-h-16 w-28 rounded-2xl border-2 border-red text-lg font-bold text-red active:bg-red-50"
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

        <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_0.3rem_1rem_rgb(0_0_0/0.08)] lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-2xl font-black text-navy">ご注文</h2>
          <ul className="min-h-28 space-y-1 text-2xl">
            {FLAVORS.filter((f) => cart[f.id] > 0).map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <span className={`h-4 w-4 rounded-full ${f.bg}`} aria-hidden />
                <span className="flex-1 font-bold">{f.name}</span>
                <span className="tabular-nums">× {cart[f.id]}</span>
              </li>
            ))}
            {totalQty === 0 && <li className="text-gray-500">味のボタンを押してください</li>}
          </ul>
          <div className="flex items-baseline justify-between border-t-2 border-paper pt-4 text-2xl">
            <span>
              合計 <span className="font-black tabular-nums">{totalQty}</span>個
              {totalQty >= MAX_ORDER_QTY && <span className="ml-2 text-base font-bold text-red">（上限）</span>}
            </span>
            <span className="text-4xl font-black tabular-nums">{amount.toLocaleString()}円</span>
          </div>
          <div className="rounded-2xl bg-paper px-4 py-3 text-center">
            <p className="text-xl font-bold text-navy">いただく金券</p>
            <p className="text-8xl leading-tight font-black text-navy tabular-nums">
              {tickets}
              <span className="ml-2 text-4xl">枚</span>
            </p>
            <p className="text-base text-gray-600">1個200円・味を問わず3個で500円</p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={totalQty === 0 || submitting}
            className="press min-h-24 w-full rounded-3xl bg-red text-4xl font-black text-white shadow-[0_0.3rem_0_rgb(0_0_0/0.25)] disabled:opacity-40"
          >
            {submitting ? "送信中…" : "確定"}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={totalQty === 0 || submitting}
            className="press min-h-16 rounded-2xl border-2 border-gray-400 text-2xl font-bold active:bg-gray-100 disabled:opacity-30"
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
            <p className="mt-2 font-bold text-red">金券 {calcTickets(cancelTarget.amount)}枚をお客さんに返してください。</p>
          </>
        )}
      </ConfirmDialog>
      <Toast message={toast.message} onClose={toast.clear} />
    </>
  );
}
