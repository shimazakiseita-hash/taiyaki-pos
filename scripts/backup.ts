/**
 * いますぐバックアップを取る（全注文のCSVとDBのコピー）。
 * 使い方: npm run backup（保存先は backups/。BACKUP_DIR=/media/usb/... で変えられる）
 */
import { defaultBackupOptions, takeBackup } from "./lib/backup";

async function main() {
  const r = await takeBackup(defaultBackupOptions());
  if (r.csv) console.log(`CSV: ${r.csv}（注文 ${r.orders}件）`);
  if (r.db) console.log(`DB : ${r.db}`);
  for (const e of r.errors) console.error(`失敗 ${e}`);
  if (r.errors.length) process.exitCode = 1;
}

main();
