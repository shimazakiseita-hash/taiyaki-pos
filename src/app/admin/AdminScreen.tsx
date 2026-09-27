"use client";

import { AppHeader } from "@/components/AppHeader";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { FLAVORS } from "@/lib/menu";
import type { ServerInfo } from "@/lib/serverInfo";
import type { Summary } from "@/lib/summary";
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
  const s = summary.data;

  const progress = s ? Math.min(100, (s.soldTotal / s.targetQty) * 100) : 0;

  return (
    <>
      <AppHeader title="管理" error={summary.status} />
      <ConnectionBanner error={summary.error} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
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
              </tr>
            </thead>
            <tbody>
              {FLAVORS.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className={`py-2 font-bold ${f.text}`}>{f.name}</td>
                  <td className="py-2 text-right tabular-nums">{s?.soldByFlavor[f.id] ?? "…"}</td>
                </tr>
              ))}
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
    </>
  );
}
