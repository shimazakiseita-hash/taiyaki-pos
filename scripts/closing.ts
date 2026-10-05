/**
 * お客さん向けページを営業終了の表示にする・戻す（スタッフ用。.env.public の URL と合言葉を使う）。
 * 使い方: npm run closing（いまの設定を見る）
 *         npm run closing -- on 2026-10-04（営業終了にする。日付は寮祭の日。その日とれきだいのランキングを backups/ に保存）
 *         npm run closing -- off（番号の表示に戻す。寮祭の日付はそのまま）
 * 営業終了のあとも、ミニゲームとランキング（きょう・れきだい・寮祭の日）は使える
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Config = { closed: boolean; eventDate: string | null };

try {
  process.loadEnvFile(".env.public");
} catch {
  // 環境変数で直接渡してもよい
}

const base = process.env.PUBLIC_STATUS_URL?.replace(/\/$/, "");
const token = process.env.PUBLIC_STATUS_TOKEN;
const auth = { Authorization: `Bearer ${token}` };

async function getConfig(): Promise<Config> {
  return (await (await fetch(`${base}/api/config`)).json()) as Config;
}

async function putConfig(config: Config): Promise<void> {
  const res = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`設定を変えられませんでした（${res.status} ${await res.text()}）`);
}

/** 念のため、ランキングをこのPCにも残す */
async function saveRanking(board: string, file: string): Promise<number> {
  const res = await fetch(`${base}/api/ranking?all=1&board=${board}`, { headers: auth });
  const body = (await res.json()) as { rows?: unknown[]; error?: string };
  if (!body.rows) throw new Error(body.error ?? `ランキングを取得できませんでした（${res.status}）`);
  const dir = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, file), JSON.stringify(body.rows, null, 2) + "\n");
  return body.rows.length;
}

async function main() {
  if (!base || !token) {
    console.error(".env.public に PUBLIC_STATUS_URL と PUBLIC_STATUS_TOKEN を設定してください");
    process.exit(1);
  }
  const [command, date] = process.argv.slice(2);
  const current = await getConfig();

  if (command === "on") {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error("寮祭の日付を指定してください（例：npm run closing -- on 2026-10-04）");
      process.exit(1);
    }
    const day = await saveRanking(date, `ranking-${date}.json`);
    const all = await saveRanking("all", `ranking-all-${new Date().toISOString().slice(0, 10)}.json`);
    await putConfig({ closed: true, eventDate: date });
    console.log(`営業終了の表示にしました（寮祭の日：${date}）`);
    console.log(`ランキングを backups/ に保存しました（寮祭の日 ${day}件・れきだい ${all}件）`);
    return;
  }
  if (command === "off") {
    await putConfig({ closed: false, eventDate: current.eventDate });
    console.log("番号の表示に戻しました");
    return;
  }
  console.log(`いまの設定：${current.closed ? "営業終了の表示" : "番号の表示"}／寮祭の日：${current.eventDate ?? "（未設定）"}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
