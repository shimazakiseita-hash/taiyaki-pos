# 実装タスク

各フェーズの最後に「受け入れ条件」を満たしていることを確認し、`npm test` を通してからコミットする。
仕様は `docs/spec.md` を参照。

## フェーズ0：プロジェクト作成（目安：30分）
- [x] `create-next-app`（TypeScript / App Router / Tailwind / `src/` ディレクトリ / ESLint）
- [x] `better-sqlite3` `zod` を追加、`vitest` `@types/better-sqlite3` を devDependencies に追加
- [x] `package.json` の scripts：`dev`・`start` に `-H 0.0.0.0`、`test`、`db:reset`
- [x] `next.config` で `serverExternalPackages: ['better-sqlite3']`
- [x] Google Fonts など外部読み込みを `layout.tsx` から削除し、システムフォントにする
- [x] `data/` を `.gitignore` に追加
- [x] git init → 初回コミット

**受け入れ条件**：`npm run dev` で起動し、同じLANの別端末から `http://<IP>:3000` が開ける

## フェーズ1：ドメインロジックとDB（目安：半日）
- [x] `src/lib/menu.ts`：味の定義（id・表示名・色）
- [x] `src/lib/pricing.ts`：`calcAmount(totalQty)`、`calcTickets(amount)`
- [x] `src/lib/status.ts`：`canTransition(from, to)`（spec 3章）
- [x] `src/lib/summary.ts`：注文配列から集計を計算する純粋関数（spec 5章）
- [x] `src/lib/db.ts`：接続（WAL）、スキーマ作成、settings初期値、`createOrder`（採番込みトランザクション・上限チェック）、`listOrders`、`updateStatus`、`getSettings`、`putSettings`
- [x] `scripts/db-reset.ts`（確認プロンプト後にDBファイルを削除）
- [x] テスト：料金（1〜7個、20個）、状態遷移の全組み合わせ、集計（cancelledの除外、上限の残数）、連番が重複しないこと

**受け入れ条件**：`npm test` がすべて通る

## フェーズ2：API（目安：半日）
- [x] spec 7章のRoute Handlersを実装。入力は zod で検証
- [x] エラー形式を `{ error: string }` に統一（400：入力不正、404：注文なし、409：不正遷移・上限超過）
- [x] `/api/server-info`：`os.networkInterfaces()` から内部でないIPv4を返す
- [x] `src/lib/usePolling.ts`：2秒ごとにfetchするクライアント用フック（通信失敗時は前回データを保持し「接続エラー」フラグを立てる）

**受け入れ条件**：curl で注文作成 → 状態変更 → 集計が仕様どおり返る。不正遷移で409

## フェーズ3：レジ画面 `/register`（目安：1日）
- [x] spec 6.1 の実装
- [x] 確定ボタンの二重送信防止（送信中は無効化）
- [x] 通信エラー時は画面上部に赤帯で表示

**受け入れ条件**：注文を入れて番号が1,2,3…と発行される。売り切れの味は押せない。取り消しができる

## フェーズ4：キッチン画面 `/kitchen` と呼び出し表示 `/display`（目安：1日）
- [x] spec 6.2、6.3 の実装
- [x] 別端末でレジから注文 → 2秒以内にキッチンに出る → 完成 → 呼び出し表示に出る

**受け入れ条件**：レジ・キッチン・呼び出しの3画面を別端末で開き、1件の注文が最後まで流れる。押し間違いを戻せる

## フェーズ5：管理画面 `/admin`（目安：半日）
- [x] spec 6.4 の実装（スマホ縦画面で見やすく）
- [x] CSVダウンロード（Excelで開いても文字化けしないようBOM付きUTF-8）

**受け入れ条件**：集計値が手計算と一致する。仕込み上限を変えるとレジの残数に反映される

## フェーズ6：本番想定テスト（目安：半日〜1日）
- [ ] スマホのテザリング（モバイルデータOFF）で全端末を接続して動作確認
- [x] `npm run build && npm run start` で起動確認
- [x] 負荷確認：スクリプトで注文を100件連続作成し、画面が重くならないこと（`npm run load-test`）
- [x] サーバーを途中で停止 → 再起動してデータが残ること
- [ ] 実際の係の人に触ってもらい、分かりにくい点を修正
- [ ] `docs/event-day.md` を実際の手順に合わせて更新

## フェーズ7：お客さん向け呼び出し状況ページ（spec 6.5）
- [x] `src/lib/publicStatus.ts`：注文一覧 → 公開用の番号リスト、番号ごとの「前にあと◯件」（テストつき）
- [x] `cloud/`：Cloudflare Workers（Durable Object に最新の状況を1件保存）＋お客さん向けページ。書き込みはトークン必須
- [x] `scripts/public-sync.ts`（`npm run public-sync`）：レジPCから番号だけを送る。失敗しても再試行し続け、レジには影響しない
- [x] ローカル（`wrangler dev`）で、注文 → 完成 → ページに反映されることを確認
- [ ] Cloudflare に公開し、固定URLのQRコードを作って印刷
- [ ] テザリング（モバイルデータON）で、お客さん役のスマホから見えることを確認

**受け入れ条件**：レジで注文・完成させると数秒でお客さん用ページに反映される。`public-sync` やネットを止めてもレジ・キッチン・呼び出し表示は動き続け、ページには「更新されていません」が出る
