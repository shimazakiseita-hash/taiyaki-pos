# 実装タスク

各フェーズの最後に「受け入れ条件」を満たしていることを確認し、`npm test` を通してからコミットする。
仕様は `docs/spec.md` を参照。

## フェーズ0：プロジェクト作成（目安：30分）
- [ ] `create-next-app`（TypeScript / App Router / Tailwind / `src/` ディレクトリ / ESLint）
- [ ] `better-sqlite3` `zod` を追加、`vitest` `@types/better-sqlite3` を devDependencies に追加
- [ ] `package.json` の scripts：`dev`・`start` に `-H 0.0.0.0`、`test`、`db:reset`
- [ ] `next.config` で `serverExternalPackages: ['better-sqlite3']`
- [ ] Google Fonts など外部読み込みを `layout.tsx` から削除し、システムフォントにする
- [ ] `data/` を `.gitignore` に追加
- [ ] git init → 初回コミット

**受け入れ条件**：`npm run dev` で起動し、同じLANの別端末から `http://<IP>:3000` が開ける

## フェーズ1：ドメインロジックとDB（目安：半日）
- [ ] `src/lib/menu.ts`：味の定義（id・表示名・色）
- [ ] `src/lib/pricing.ts`：`calcAmount(totalQty)`、`calcTickets(amount)`
- [ ] `src/lib/status.ts`：`canTransition(from, to)`（spec 3章）
- [ ] `src/lib/summary.ts`：注文配列から集計を計算する純粋関数（spec 5章）
- [ ] `src/lib/db.ts`：接続（WAL）、スキーマ作成、settings初期値、`createOrder`（採番込みトランザクション・上限チェック）、`listOrders`、`updateStatus`、`getSettings`、`putSettings`
- [ ] `scripts/db-reset.ts`（確認プロンプト後にDBファイルを削除）
- [ ] テスト：料金（1〜7個、20個）、状態遷移の全組み合わせ、集計（cancelledの除外、上限の残数）、連番が重複しないこと

**受け入れ条件**：`npm test` がすべて通る

## フェーズ2：API（目安：半日）
- [ ] spec 7章のRoute Handlersを実装。入力は zod で検証
- [ ] エラー形式を `{ error: string }` に統一（400：入力不正、404：注文なし、409：不正遷移・上限超過）
- [ ] `/api/server-info`：`os.networkInterfaces()` から内部でないIPv4を返す
- [ ] `src/lib/usePolling.ts`：2秒ごとにfetchするクライアント用フック（通信失敗時は前回データを保持し「接続エラー」フラグを立てる）

**受け入れ条件**：curl で注文作成 → 状態変更 → 集計が仕様どおり返る。不正遷移で409

## フェーズ3：レジ画面 `/register`（目安：1日）
- [ ] spec 6.1 の実装
- [ ] 確定ボタンの二重送信防止（送信中は無効化）
- [ ] 通信エラー時は画面上部に赤帯で表示

**受け入れ条件**：注文を入れて番号が1,2,3…と発行される。売り切れの味は押せない。取り消しができる

## フェーズ4：キッチン画面 `/kitchen` と呼び出し表示 `/display`（目安：1日）
- [ ] spec 6.2、6.3 の実装
- [ ] 別端末でレジから注文 → 2秒以内にキッチンに出る → 完成 → 呼び出し表示に出る

**受け入れ条件**：レジ・キッチン・呼び出しの3画面を別端末で開き、1件の注文が最後まで流れる。押し間違いを戻せる

## フェーズ5：管理画面 `/admin`（目安：半日）
- [ ] spec 6.4 の実装（スマホ縦画面で見やすく）
- [ ] CSVダウンロード（Excelで開いても文字化けしないようBOM付きUTF-8）

**受け入れ条件**：集計値が手計算と一致する。仕込み上限を変えるとレジの残数に反映される

## フェーズ6：本番想定テスト（目安：半日〜1日）
- [ ] スマホのテザリング（モバイルデータOFF）で全端末を接続して動作確認
- [ ] `npm run build && npm run start` で起動確認
- [ ] 負荷確認：スクリプトで注文を100件連続作成し、画面が重くならないこと
- [ ] サーバーを途中で停止 → 再起動してデータが残ること
- [ ] 実際の係の人に触ってもらい、分かりにくい点を修正
- [ ] `docs/event-day.md` を実際の手順に合わせて更新
