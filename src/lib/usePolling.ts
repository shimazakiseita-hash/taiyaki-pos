"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const POLL_INTERVAL_MS = 2000;

/**
 * url を一定間隔で取得する。通信に失敗しても前回のデータは保持し、error を立てる。
 * refresh() で即時に取り直せる（操作の直後など）。
 */
export function usePolling<T>(url: string, intervalMs = POLL_INTERVAL_MS) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  /** サーバー時刻 − 端末時刻（ms）。経過時間を端末の時計のずれに左右されずに出すため */
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const timeout = setTimeout(() => controller.abort(), Math.max(intervalMs * 2, 4000));
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      if (inFlight.current === controller) {
        setData(json);
        setError(false);
        const serverDate = Date.parse(res.headers.get("date") ?? "");
        if (!Number.isNaN(serverDate)) setClockOffsetMs(serverDate - Date.now());
      }
    } catch {
      // 新しいリクエストに置き換えられて中断された場合はエラー扱いにしない
      if (inFlight.current === controller) setError(true);
    } finally {
      clearTimeout(timeout);
    }
  }, [url, intervalMs]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (!stopped) timer = setTimeout(loop, intervalMs);
    };
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
      inFlight.current?.abort();
    };
  }, [refresh, intervalMs]);

  return { data, error, refresh, clockOffsetMs };
}
