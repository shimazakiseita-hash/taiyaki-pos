/**
 * ミニゲームのランキングを見る・消す（スタッフ用。.env.public の URL と合言葉を使う）。
 * 使い方: npm run ranking（きょう） / npm run ranking -- all（れきだい） / npm run ranking -- event（寮祭の日）
 *         npm run ranking -- 2026-10-04（その日） / npm run ranking -- remove a1b2c3（そのIDの記録を、きょう・れきだい・過去の日すべてから消す）
 */
type Row = { rank: number; name: string; tag: string; score: number };

const LABELS: Record<string, string> = { today: "きょう", all: "れきだい", event: "寮祭の日" };

try {
  process.loadEnvFile(".env.public");
} catch {
  // 環境変数で直接渡してもよい
}

const base = process.env.PUBLIC_STATUS_URL?.replace(/\/$/, "");
const token = process.env.PUBLIC_STATUS_TOKEN;
const headers = { Authorization: `Bearer ${token}` };

async function main() {
  if (!base || !token) {
    console.error(".env.public に PUBLIC_STATUS_URL と PUBLIC_STATUS_TOKEN を設定してください");
    process.exit(1);
  }
  const [command, arg] = process.argv.slice(2);

  if (command === "remove") {
    if (!arg || !/^[a-z0-9]{1,12}$/.test(arg)) {
      console.error("消す記録のIDを指定してください（一覧の「ID」の列。例：npm run ranking -- remove a1b2c3）");
      process.exit(1);
    }
    const res = await fetch(`${base}/api/ranking?tag=${arg}`, { method: "DELETE", headers });
    const body = (await res.json()) as { removed?: number; error?: string };
    console.log(body.error ?? (body.removed ? `ID ${arg} の記録を消しました（${body.removed}件）` : `ID ${arg} の記録はありません`));
    return;
  }

  const board = command ?? "today";
  if (!/^(today|all|event|\d{4}-\d{2}-\d{2})$/.test(board)) {
    console.error("today・all・event か、日付（例：2026-10-04）を指定してください");
    process.exit(1);
  }
  const res = await fetch(`${base}/api/ranking?all=1&board=${board}`, { headers });
  const body = (await res.json()) as { rows?: Row[]; error?: string };
  if (!body.rows) {
    console.error(body.error ?? `取得できませんでした（${res.status}）`);
    process.exit(1);
  }
  console.log(`【${LABELS[board] ?? board}】`);
  if (body.rows.length === 0) console.log("記録はまだありません");
  for (const r of body.rows) console.log(`${String(r.rank).padStart(3)}位  ${String(r.score).padStart(4)}点  ID ${r.tag}  ${r.name}`);
}

main();
