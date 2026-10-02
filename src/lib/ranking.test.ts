import { describe, expect, it } from "vitest";
import {
  containsNgWord,
  isPlausibleScore,
  jstDateKey,
  normalizeName,
  sortRanking,
  upsertBest,
  type RankingEntry,
} from "./ranking";
import { rankingSubmitSchema } from "./schemas";

const entry = (number: number, score: number, name = `${number}さん`, at = "2026-10-10T03:00:00.000Z"): RankingEntry => ({
  number,
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
    expect(isPlausibleScore(250, 30_000)).toBe(true);
    expect(isPlausibleScore(251, 30_000)).toBe(false);
    expect(isPlausibleScore(500, 30_000)).toBe(false);
    expect(isPlausibleScore(-1, 30_000)).toBe(false);
  });
});

describe("upsertBest / sortRanking", () => {
  it("番号ごとに最高点だけ残し、名前は最新にする", () => {
    let board = upsertBest([], entry(3, 20, "あ"));
    board = upsertBest(board, entry(3, 10, "い"));
    expect(board).toEqual([entry(3, 20, "い")]);
    board = upsertBest(board, entry(3, 30, "う", "2026-10-10T04:00:00.000Z"));
    expect(board).toEqual([entry(3, 30, "う", "2026-10-10T04:00:00.000Z")]);
  });

  it("点数の高い順、同点なら先に出した人が上", () => {
    const board = [entry(1, 10, "a", "2026-10-10T03:02:00.000Z"), entry(2, 30), entry(3, 10, "c", "2026-10-10T03:01:00.000Z")];
    expect(sortRanking(board).map((e) => e.number)).toEqual([2, 3, 1]);
  });
});

describe("jstDateKey", () => {
  it("日本時間で日付が変わる", () => {
    expect(jstDateKey(new Date("2026-10-10T14:59:00.000Z"))).toBe("2026-10-10");
    expect(jstDateKey(new Date("2026-10-10T15:00:00.000Z"))).toBe("2026-10-11");
  });
});

describe("rankingSubmitSchema", () => {
  it("番号・名前・点数・遊んだ時間を受け付ける", () => {
    expect(rankingSubmitSchema.safeParse({ number: 12, name: "たい", score: 5, playMs: 20000 }).success).toBe(true);
    expect(rankingSubmitSchema.safeParse({ number: 0, name: "たい", score: 5, playMs: 20000 }).success).toBe(false);
    expect(rankingSubmitSchema.safeParse({ number: 1, name: "x".repeat(41), score: 5, playMs: 20000 }).success).toBe(false);
  });
});
