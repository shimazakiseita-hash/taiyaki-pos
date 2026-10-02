"use client";

import NoSleep from "nosleep.js";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 置きっぱなしの画面用：画面を消さない・音を鳴らせるようにする。
 * どちらもブラウザの決まりで最初に1回タップが必要。http の LAN では Wake Lock API が使えないため、
 * nosleep.js（使えれば Wake Lock、なければ無音の動画を流し続ける）に任せる
 */
export function useKiosk() {
  const [awake, setAwake] = useState(false);
  const noSleep = useRef<NoSleep | null>(null);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    const ns = new NoSleep();
    noSleep.current = ns;
    let wanted = false;

    const enable = () => {
      ns.enable()
        .then(() => setAwake(true))
        .catch(() => setAwake(false));
    };
    // タップの処理の中で同期的に呼ぶ（動画の再生・音の再開はユーザー操作の中でしか許されない）
    const onTap = () => {
      wanted = true;
      if (!ns.isEnabled) enable();
      audio.current ??= new AudioContext();
      if (audio.current.state !== "running") void audio.current.resume();
    };
    // 別のアプリから戻ってきたら、止まっていることがあるのでかけ直す
    const onVisible = () => {
      if (document.visibilityState === "visible" && wanted) enable();
    };

    document.addEventListener("click", onTap);
    document.addEventListener("keydown", onTap);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("click", onTap);
      document.removeEventListener("keydown", onTap);
      document.removeEventListener("visibilitychange", onVisible);
      ns.disable();
      void audio.current?.close();
      audio.current = null;
    };
  }, []);

  /** 「ピンポン」と鳴らす（タップ前は鳴らせないので何もしない） */
  const chime = useCallback(() => {
    const ctx = audio.current;
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    for (const [freq, delay] of [
      [1047, 0],
      [784, 0.3],
    ]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.6, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.75);
    }
  }, []);

  return { awake, chime };
}
