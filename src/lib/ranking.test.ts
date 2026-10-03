import { describe, expect, it } from "vitest";
import {
  SUBMIT_LIMIT,
  SUBMIT_WINDOW_MS,
  allowSubmission,
  containsNgWord,
  isPlausibleScore,
  jstDateKey,
  normalizeName,
  playerTag,
  sortRanking,
  upsertBest,
  type RankingEntry,
} from "./ranking";
import { rankingSubmitSchema } from "./schemas";

const entry = (player: string, score: number, name = `${player}さん`, at = "2026-10-10T03:00:00.000Z"): RankingEntry => ({
  player,
  name,
  score,
  at,
});

describe("normalizeName", () => {
  it("全角英数を半角に、前後の空白を除き、空白をまとめる", () => {
    expect(normalizeName("  ＴＡＩ　ｙａｋｉ  ")).toBe("TAI yaki");
  });

  it("1〜10文字だけ受け付ける（絵文字も1文字）", () => {
    expect(normalizeName("たいやきだいすきくん")).toBe("たいやきだいすきくん");
    expect(normalizeName("たいやきだいすきくんだ")).toBeNull();
    expect(normalizeName("🐟🐟")).toBe("🐟🐟");
    expect(normalizeName("   ")).toBeNull();
  });
});

describe("containsNgWord", () => {
  it("カタカナ・全角・記号はさみでも見つける", () => {
    expect(containsNgWord("シネ")).toBe(true);
    expect(containsNgWord("ｆｕｃｋ")).toBe(true);
    expect(containsNgWord("ば.か")).toBe(true);
  });

  it("ふつうの名前は通す", () => {
    expect(containsNgWord("たいやき名人")).toBe(false);
    expect(containsNgWord("Seita")).toBe(false);
    expect(containsNgWord("カスタード大好き")).toBe(false);
    expect(containsNgWord("skill")).toBe(false);
  });
});

describe("isPlausibleScore", () => {
  it("遊んだ時間に見合う点数だけ通す", () => {
    expect(isPlausibleScore(40, 30_000)).toBe(true);
    expect(isPlausibleScore(380, 30_000)).toBe(true);
    expect(isPlausibleScore(381, 30_000)).toBe(false);
    expect(isPlausibleScore(500, 30_000)).toBe(false);
    expect(isPlausibleScore(-1, 30_000)).toBe(false);
  });
});

describe("upsertBest / sortRanking", () => {
  it("プレイヤーごとに最高点だけ残し、名前は最新にする", () => {
    let board = upsertBest([], entry("aaaa1111", 20, "あ"));
    board = upsertBest(board, entry("aaaa1111", 10, "い"));
    expect(board).toEqual([entry("aaaa1111", 20, "い")]);
    board = upsertBest(board, entry("aaaa1111", 30, "う", "2026-10-10T04:00:00.000Z"));
    expect(board).toEqual([entry("aaaa1111", 30, "う", "2026-10-10T04:00:00.000Z")]);
    expect(upsertBest(board, entry("bbbb2222", 5))).toHaveLength(2);
  });

  it("点数の高い順、同点なら先に出した人が上", () => {
    const board = [entry("p1", 10, "a", "2026-10-10T03:02:00.000Z"), entry("p2", 30), entry("p3", 10, "c", "2026-10-10T03:01:00.000Z")];
    expect(sortRanking(board).map((e) => e.player)).toEqual(["p2", "p3", "p1"]);
  });

  it("表示用のIDは先頭6文字だけ", () => {
    expect(playerTag("abcdef123456")).toBe("abcdef");
  });
});

describe("jstDateKey", () => {
  it("日本時間で日付が変わる", () => {
    expect(jstDateKey(new Date("2026-10-10T14:59:00.000Z"))).toBe("2026-10-10");
    expect(jstDateKey(new Date("2026-10-10T15:00:00.000Z"))).toBe("2026-10-11");
  });
});

describe("rankingSubmitSchema", () => {
  it("プレイヤーID・名前・点数・遊んだ時間を受け付ける（整理券の番号はいらない）", () => {
    expect(rankingSubmitSchema.safeParse({ player: "a1b2c3d4e5f6", name: "たい", score: 5, playMs: 20000 }).success).toBe(true);
    expect(rankingSubmitSchema.safeParse({ player: "short", name: "たい", score: 5, playMs: 20000 }).success).toBe(false);
    expect(rankingSubmitSchema.safeParse({ player: "ABCDEF123456", name: "たい", score: 5, playMs: 20000 }).success).toBe(false);
    expect(rankingSubmitSchema.safeParse({ player: "a1b2c3d4e5f6", name: "x".repeat(41), score: 5, playMs: 20000 }).success).toBe(false);
  });
});

describe("allowSubmission", () => {
  it("10分に20回までは通し、それを超えると断る。古い登録は数えない", () => {
    const now = 1_000_000_000;
    const full = Array.from({ length: SUBMIT_LIMIT }, (_, i) => now - i * 1000);
    expect(allowSubmission(full.slice(1), now).ok).toBe(true);
    expect(allowSubmission(full, now).ok).toBe(false);
    const old = full.map((t) => t - SUBMIT_WINDOW_MS);
    const r = allowSubmission(old, now);
    expect(r).toEqual({ ok: true, times: [now] });
  });
});
