/** お客さん向けミニゲーム「およげない？たいやきくん」の今日のランキング */

export const NAME_MAX = 10;
export const RANKING_SIZE = 10;

export type RankingEntry = { number: number; name: string; score: number; at: string };

/** 表示名に使わせない言葉（ひらがな・小文字にそろえてから部分一致で見る）。「かす」（カスタード）のように普通の名前に含まれる語は入れない。最後の砦はスタッフの削除 */
const NG_WORDS = [
  "しね", "ころす", "ころせ", "きもい", "うざい", "くず", "ばか", "あほ", "ちんこ", "ちんぽ", "まんこ",
  "うんこ", "せっくす", "えっち", "おっぱい", "れいぷ", "ぶす", "でぶ", "がいじ", "きちがい", "ふぁっく",
  "fuck", "shit", "sex", "porn", "dick", "pussy", "bitch", "nigger",
];

function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 全角英数を半角に、空白をまとめ、制御文字を除く。1〜10文字でなければ null */
export function normalizeName(raw: string): string | null {
  const name = raw
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX ? name : null;
}

export function containsNgWord(name: string): boolean {
  const key = toHiragana(name.normalize("NFKC").toLowerCase()).replace(/[\s\p{P}\p{S}ー]/gu, "");
  return NG_WORDS.some((w) => key.includes(w));
}

/**
 * 遊んだ時間に対してありえない点数を弾く。最高速で障害物が1秒に約1.5個、
 * 金の浮き輪10点・クラゲ5点も見込んで、1秒12点＋20点が上限（余裕をもたせている）
 */
export function isPlausibleScore(score: number, playMs: number): boolean {
  return score >= 0 && playMs >= 0 && score <= Math.ceil((playMs / 1000) * 12) + 20;
}

/** 番号ごとに1件。点数が上がったときだけ記録を更新し、名前はいつでも最新にする */
export function upsertBest(entries: readonly RankingEntry[], entry: RankingEntry): RankingEntry[] {
  const current = entries.find((e) => e.number === entry.number);
  const others = entries.filter((e) => e.number !== entry.number);
  if (!current || entry.score > current.score) return [...others, entry];
  return [...others, { ...current, name: entry.name }];
}

/** 点数の高い順（同点なら先に出した人が上） */
export function sortRanking(entries: readonly RankingEntry[]): RankingEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || Date.parse(a.at) - Date.parse(b.at));
}

/** 日本時間の日付（ランキングは日ごとに分ける） */
export function jstDateKey(date = new Date()): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
