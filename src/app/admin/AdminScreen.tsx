"use client";

import { useState } from "react";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Toast, useToast } from "@/components/Toast";
import { sendJson } from "@/lib/client";
import { FLAVORS, type FlavorCounts, type FlavorId } from "@/lib/menu";
import type { ServerInfo } from "@/lib/serverInfo";
import type { Summary } from "@/lib/summary";
import type { Settings } from "@/lib/types";
import { usePolling } from "@/lib/usePolling";

const PAGES = [
  { path: "/register", label: "レジ" },
  { path: "/kitchen", label: "キッチン" },
  { path: "/display", label: "呼び出し表示" },
  { path: "/admin", label: "管理" },
] as const;

function formatWait(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-600">{title}</h2>
      {children}
    </section>
  );
}

export function AdminScreen() {
  const summary = usePolling<Summary>("/api/summary");
  const server = usePolling<ServerInfo>("/api/server-info", 10_000);
  const toast = useToast();
  const s = summary.data;

  // 編集中の値。未編集の味はサーバーの値を表示する
  const [draft, setDraft] = useState<Partial<Record<FlavorId, string>>>({});
  const [saving, setSaving] = useState(false);

  async function saveCapacity() {
    const capacity: Partial<FlavorCounts> = {};
    for (const f of FLAVORS) {
      const raw = draft[f.id];
      if (raw === undefined) continue;
      const n = Number(raw);
      if (raw.trim() === "" || !Number.isInteger(n) || n < 0) {
        toast.show(`${f.name}の仕込み上限は0以上の整数で入力してください`);
        return;
      }
      capacity[f.id] = n;
    }
    if (Object.keys(capacity).length === 0) return;
    setSaving(true);
    const res = await sendJson<Settings>("PUT", "/api/settings", { capacity });
    setSaving(false);
    if (res.ok) {
      setDraft({});
      toast.show("仕込み上限を保存しました");
      summary.refresh();
    } else {
      toast.show(res.error);
    }
  }

  const progress = s ? Math.min(100, (s.soldTotal / s.targetQty) * 100) : 0;
  const dirty = Object.keys(draft).length > 0;

  return (
    <>
      <ConnectionBanner error={summary.error} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        <h1 className="text-2xl font-black">管理</h1>

        <Card title="売上">
          <p className="text-5xl font-black tabular-nums">{s ? `${s.revenue.toLocaleString()}円` : "…"}</p>
          <p className="mt-1 text-3xl font-bold text-amber-800 tabular-nums">金券 {s?.tickets ?? "…"}枚</p>
          <p className="mt-2 text-sm text-gray-500">閉店後、実際の金券の枚数と照合してください</p>
        </Card>

        <Card title="販売数">
          <p className="text-4xl font-black tabular-nums">
            {s?.soldTotal ?? "…"}
            <span className="text-xl font-bold text-gray-500"> / 目標 {s?.targetQty ?? "…"}個</span>
          </p>
          <div className="mt-3 h-6 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-amber-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-right text-sm text-gray-600 tabular-nums">{progress.toFixed(0)}%</p>

          <table className="mt-3 w-full text-lg">
            <thead>
              <tr className="text-left text-sm text-gray-500">
                <th className="py-1 font-normal">味</th>
                <th className="py-1 text-right font-normal">販売数</th>
                <th className="py-1 text-right font-normal">残り</th>
                <th className="py-1 text-right font-normal">上限</th>
              </tr>
            </thead>
            <tbody>
              {FLAVORS.map((f) => {
                const left = s?.remainingByFlavor[f.id];
                return (
                  <tr key={f.id} className="border-t">
                    <td className={`py-2 font-bold ${f.text}`}>{f.name}</td>
                    <td className="py-2 text-right tabular-nums">{s?.soldByFlavor[f.id] ?? "…"}</td>
                    <td className={`py-2 text-right font-bold tabular-nums ${left !== undefined && left <= 5 ? "text-red-600" : ""}`}>
                      {left === undefined ? "…" : left <= 0 ? "売り切れ" : left}
                    </td>
                    <td className="py-2 text-right text-gray-500 tabular-nums">{s?.capacity[f.id] ?? "…"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="待ち状況">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-sm text-gray-500">焼き待ち</dt>
              <dd className="text-3xl font-black tabular-nums">{s?.waitingCount ?? "…"}件</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">呼び出し中</dt>
              <dd className="text-3xl font-black tabular-nums">{s?.readyCount ?? "…"}件</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">平均待ち時間</dt>
              <dd className="text-2xl font-black tabular-nums">{s ? formatWait(s.avgWaitSeconds) : "…"}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-gray-500">平均待ち時間：直近10件の、注文から受け渡しまで</p>
        </Card>

        <Card title="仕込み上限">
          <div className="grid grid-cols-2 gap-3">
            {FLAVORS.map((f) => {
              const value = draft[f.id] ?? (s ? String(s.capacity[f.id]) : "");
              const n = Number(value);
              const belowSold = s && draft[f.id] !== undefined && n < s.soldByFlavor[f.id];
              return (
                <label key={f.id} className="flex flex-col gap-1">
                  <span className={`font-bold ${f.text}`}>{f.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={value}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                    className={`min-h-16 rounded-2xl border-2 px-3 text-2xl font-bold tabular-nums ${
                      draft[f.id] !== undefined ? "border-amber-600 bg-amber-50" : "border-gray-300"
                    }`}
                  />
                  {belowSold && <span className="text-sm text-red-600">販売数（{s.soldByFlavor[f.id]}）より少ない値です</span>}
                </label>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-[1fr_2fr] gap-3">
            <button
              type="button"
              onClick={() => setDraft({})}
              disabled={!dirty || saving}
              className="min-h-16 rounded-2xl border-2 border-gray-400 text-xl font-bold active:bg-gray-100 disabled:opacity-30"
            >
              元に戻す
            </button>
            <button
              type="button"
              onClick={saveCapacity}
              disabled={!dirty || saving}
              className="min-h-16 rounded-2xl bg-amber-600 text-xl font-black text-white active:bg-amber-700 disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </Card>

        <Card title="バックアップ">
          <a
            href="/api/export.csv"
            download
            className="flex min-h-16 items-center justify-center rounded-2xl bg-gray-900 text-xl font-bold text-white active:bg-gray-700"
          >
            全注文をCSVでダウンロード
          </a>
          <p className="mt-2 text-sm text-gray-500">営業中は1時間ごとにダウンロードしてください</p>
        </Card>

        <Card title="他の端末をつなぐとき">
          {!server.data ? (
            <p className="text-gray-500">…</p>
          ) : server.data.urls.length === 0 ? (
            <p className="text-red-600">LANのIPアドレスが見つかりません。テザリングに接続しているか確認してください</p>
          ) : (
            server.data.urls.map((url) => (
              <div key={url} className="mb-3">
                <p className="mb-2 text-2xl font-black break-all">{url}</p>
                <ul className="flex flex-col gap-1 text-base">
                  {PAGES.map((p) => (
                    <li key={p.path} className="flex gap-2">
                      <span className="w-28 shrink-0 text-gray-600">{p.label}</span>
                      <span className="font-mono break-all">
                        {url}
                        {p.path}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <p className="mt-1 text-sm text-gray-500">各端末で同じWi-Fi（テザリング）につないでから開いてください</p>
        </Card>
      </main>
      <Toast message={toast.message} onClose={toast.clear} />
    </>
  );
}
