import { FLAVORS, emptyCounts } from "./menu";
import { calcTickets } from "./pricing";
import { STATUS_LABELS } from "./status";
import type { Order } from "./types";

const BOM = "﻿";

/** ISO8601 をサーバーのローカル時刻 "YYYY-MM-DD HH:mm:ss" にする */
export function formatLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function cell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** 1行＝1注文、味別個数を列に持つCSV。Excel で文字化けしないよう BOM 付き */
export function ordersToCsv(orders: readonly Order[]): string {
  const header = [
    "番号",
    "状態",
    ...FLAVORS.map((f) => f.name),
    "個数",
    "金額",
    "金券枚数",
    "注文時刻",
    "完成時刻",
    "受け渡し時刻",
    "取り消し時刻",
  ];
  const rows = orders.map((o) => {
    const counts = emptyCounts();
    for (const i of o.items) counts[i.flavor] += i.qty;
    return [
      o.number,
      STATUS_LABELS[o.status],
      ...FLAVORS.map((f) => counts[f.id]),
      o.totalQty,
      o.amount,
      calcTickets(o.amount),
      formatLocal(o.createdAt),
      formatLocal(o.readyAt),
      formatLocal(o.servedAt),
      formatLocal(o.cancelledAt),
    ];
  });
  return BOM + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
